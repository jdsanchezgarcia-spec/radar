function puedeTransicionar(desde, hacia) {
  const permitidas = CFG.TRANSICIONES[desde];
  return !!permitidas && permitidas.indexOf(hacia) !== -1;
}

function buscarAccion(idAccion) {
  const id = normalizarTexto(idAccion);
  const filas = leerTabla(CFG.HOJAS.PLANES);
  for (let i = 0; i < filas.length; i++) {
    if (normalizarTexto(filas[i]['ID_Acción']) === id) return filas[i];
  }
  return null;
}

function cambiarEstado(idAccion, nuevoEstado, detalle) {
  detalle = detalle || {};
  const reg = buscarAccion(idAccion);
  if (!reg) throw new Error('No existe la acción "' + idAccion + '".');

  const actual = normalizarTexto(reg['Estado']);
  if (actual === nuevoEstado) {
    throw new Error('La acción ' + idAccion + ' ya se encuentra en estado "' + nuevoEstado + '".');
  }
  if (nuevoEstado === CFG.ESTADOS.VERIFICADA && esEstadoFinal(actual)) {
    throw new Error('La acción ' + idAccion + ' ya fue verificada y no puede modificarse.');
  }
  if (!puedeTransicionar(actual, nuevoEstado)) {
    const permitidas = (CFG.TRANSICIONES[actual] || []).join(', ') || 'ninguna (estado final)';
    throw new Error('Transición no permitida: "' + actual + '" → "' + nuevoEstado + '". Permitidas desde "' + actual + '": ' + permitidas + '.');
  }

  const campos = {
    Estado: nuevoEstado,
    'Última actualización': new Date()
  };
  const evidencias = numeroDe(reg['N° evidencias']);
  const id = normalizarTexto(reg['ID_Acción']);

  if (nuevoEstado === CFG.ESTADOS.EJECUCION) {
    campos['% Avance'] = Math.max(numeroDe(reg['% Avance']), 0);
  }

  if (nuevoEstado === CFG.ESTADOS.REPORTADA) {
    if (evidencias <= 0) {
      throw new Error(
        'No se puede reportar la acción ' + id + ' como finalizada sin evidencia. ' +
        'Primero sube al menos un archivo (acta, informe, foto, documento) a la carpeta de evidencias.'
      );
    }
    const avance = detalle.avance === undefined || detalle.avance === '' ? 100 : numeroDe(detalle.avance);
    if (avance < 100) {
      throw new Error('Para reportar la acción ' + id + ' como finalizada el avance debe ser 100%.');
    }
    campos['% Avance'] = 100;
    campos['Fecha reporte'] = aFecha(detalle.fechaReporte) || new Date();
  }

  if (nuevoEstado === CFG.ESTADOS.VERIFICADA) {
    const verificador = normalizarTexto(detalle.verificador);
    const responde = normalizarTexto(detalle.responde);
    const efectiva = normalizarTexto(detalle.efectiva);
    if (evidencias <= 0) {
      throw new Error('No se puede verificar la acción ' + id + ' sin evidencia que la respalde.');
    }
    if (!verificador) throw new Error('Indica quién realiza la verificación.');
    if (responde !== 'Sí') {
      throw new Error(
        'La acción ' + id + ' no responde al hallazgo que la originó. ' +
        'Úsala en "Rechazar" para devolverla al responsable con observaciones.'
      );
    }
    if (efectiva !== 'Sí') {
      throw new Error(
        'Si la efectividad no es "Sí", la acción ' + id + ' no puede darse por verificada. ' +
        'Regístrala como "Rechazada" con el motivo.'
      );
    }
    if (!normalizarTexto(reg['Hallazgo identificado']) || !normalizarTexto(reg['Acción propuesta'])) {
      throw new Error('La acción ' + id + ' no tiene hallazgo o acción propuesta definidos; corrígelos antes de verificar.');
    }
    campos['% Avance'] = 100;
    campos['Fecha verificación'] = aFecha(detalle.fechaVerificacion) || new Date();
    campos['Verificador'] = verificador;
    campos['¿Responde al hallazgo?'] = 'Sí';
    campos['¿Efectiva?'] = 'Sí';
    campos['Observaciones de verificación'] = normalizarTexto(detalle.observaciones);
    registrarVerificacion(id, verificador, CFG.ESTADOS.VERIFICADA, 'Sí', 'Sí', detalle.observaciones);
  }

  if (nuevoEstado === CFG.ESTADOS.RECHAZADA) {
    const observaciones = normalizarTexto(detalle.observaciones);
    const verificador = normalizarTexto(detalle.verificador) || 'Equipo de seguimiento';
    const responde = normalizarTexto(detalle.responde) || 'No';
    if (!observaciones) {
      throw new Error('Debes indicar el motivo del rechazo de la acción ' + id + ' en las observaciones.');
    }
    campos['Fecha verificación'] = new Date();
    campos['Verificador'] = verificador;
    campos['¿Responde al hallazgo?'] = responde;
    campos['¿Efectiva?'] = 'No';
    campos['Observaciones de verificación'] = observaciones;
    registrarVerificacion(id, verificador, CFG.ESTADOS.RECHAZADA, responde, 'No', observaciones);
  }

  escribirCampos(CFG.HOJAS.PLANES, COL.PLANES, reg._fila, campos);
  return id + ' → ' + nuevoEstado;
}

function registrarVerificacion(idAccion, verificador, decision, responde, efectiva, observaciones) {
  const h = hojaPorNombre(CFG.HOJAS.VERIFICACIONES);
  h.appendRow([
    new Date(),
    idAccion,
    verificador,
    decision,
    responde,
    efectiva,
    normalizarTexto(observaciones)
  ]);
}

function iniciarAccion(idAccion) {
  return cambiarEstado(idAccion, CFG.ESTADOS.EJECUCION, {});
}

function reportarAccion(idAccion, detalle) {
  return cambiarEstado(idAccion, CFG.ESTADOS.REPORTADA, detalle || {});
}

function verificarAccion(idAccion, detalle) {
  return cambiarEstado(idAccion, CFG.ESTADOS.VERIFICADA, detalle || {});
}

function rechazarAccion(idAccion, detalle) {
  return cambiarEstado(idAccion, CFG.ESTADOS.RECHAZADA, detalle || {});
}

function reanudarAccion(idAccion) {
  return cambiarEstado(idAccion, CFG.ESTADOS.EJECUCION, {});
}
