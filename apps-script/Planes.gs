function registrarAccion(datos) {
  const requeridos = [
    ['institucion', 'la institución responsable'],
    ['responsable', 'el responsable asignado'],
    ['hallazgo', 'el hallazgo identificado'],
    ['accion', 'la acción propuesta'],
    ['fechaLimite', 'la fecha límite']
  ];
  requeridos.forEach(function (r) {
    if (!normalizarTexto(datos[r[0]])) throw new Error('Falta ' + r[1] + '.');
  });

  const fechaLimite = aFecha(datos.fechaLimite);
  if (!fechaLimite) throw new Error('La fecha límite no es válida (usa el calendario del formulario).');

  let prioridad = normalizarTexto(datos.prioridad);
  const prioValida = CFG.PRIORIDADES.filter(function (p) {
    return p.toLowerCase() === prioridad.toLowerCase();
  })[0];
  prioridad = prioValida || 'Media';

  const idEvento = normalizarTexto(datos.idEvento);
  if (idEvento) {
    const eventos = leerTabla(CFG.HOJAS.EVENTOS);
    const existe = eventos.some(function (e) {
      return normalizarTexto(e['ID_Evento']) === idEvento;
    });
    if (!existe) {
      throw new Error('El evento "' + idEvento + '" no existe. Verifica el código o déjalo vacío.');
    }
  }

  const id = generarId('PM-', CFG.HOJAS.PLANES, 1);
  const h = hojaPorNombre(CFG.HOJAS.PLANES);
  h.appendRow([
    id,
    idEvento,
    normalizarTexto(datos.institucion),
    normalizarTexto(datos.responsable),
    normalizarTexto(datos.hallazgo),
    normalizarTexto(datos.accion),
    fechaLimite,
    normalizarTexto(datos.indicador),
    prioridad,
    CFG.ESTADOS.PENDIENTE,
    0,
    '',
    '',
    0,
    '',
    '',
    'Pendiente',
    'Pendiente',
    '',
    '',
    '',
    new Date()
  ]);

  if (idEvento) actualizarPlanesGenerados(idEvento);
  actualizarDiasRestantes();
  return id;
}

function actualizarAvance(idAccion, avance) {
  const reg = buscarAccion(idAccion);
  if (!reg) throw new Error('No existe la acción "' + idAccion + '".');
  const estado = normalizarTexto(reg['Estado']);
  if (estado !== CFG.ESTADOS.EJECUCION && estado !== CFG.ESTADOS.PENDIENTE) {
    throw new Error('Solo se puede actualizar el avance de acciones pendientes o en ejecución.');
  }
  const pct = numeroDe(avance);
  if (pct < 0 || pct > 100) throw new Error('El avance debe estar entre 0 y 100.');
  escribirCampos(CFG.HOJAS.PLANES, COL.PLANES, reg._fila, {
    '% Avance': pct,
    'Última actualización': new Date()
  });
  if (estado === CFG.ESTADOS.PENDIENTE && pct > 0) {
    cambiarEstado(idAccion, CFG.ESTADOS.EJECUCION, {});
    escribirCampos(CFG.HOJAS.PLANES, COL.PLANES, reg._fila, { '% Avance': pct });
  }
  return idAccion + ': ' + pct + '%';
}

function actualizarDiasRestantes() {
  const h = hojaPorNombre(CFG.HOJAS.PLANES);
  const colLimite = indiceColumna('Fecha límite', COL.PLANES);
  const colDias = indiceColumna('Días restantes', COL.PLANES);
  const colEstado = indiceColumna('Estado', COL.PLANES);
  const ultimaFila = h.getLastRow();
  if (ultimaFila < 2) return 0;

  const fechas = h.getRange(2, colLimite, ultimaFila - 1, 1).getValues();
  const estados = h.getRange(2, colEstado, ultimaFila - 1, 1).getValues();
  const salidas = [];
  for (let i = 0; i < fechas.length; i++) {
    const estado = normalizarTexto(estados[i][0]);
    if (estado === CFG.ESTADOS.VERIFICADA) {
      salidas.push(['']);
      continue;
    }
    const d = diasRestantes(fechas[i][0]);
    salidas.push([d === null ? '' : d]);
  }
  h.getRange(2, colDias, ultimaFila - 1, 1).setValues(salidas);
  return salidas.length;
}

function eliminarAccion(idAccion) {
  const reg = buscarAccion(idAccion);
  if (!reg) throw new Error('No existe la acción "' + idAccion + '".');
  if (normalizarTexto(reg['Estado']) === CFG.ESTADOS.VERIFICADA) {
    throw new Error('Las acciones verificadas no se pueden eliminar (trazabilidad).');
  }
  hojaPorNombre(CFG.HOJAS.PLANES).deleteRow(reg._fila);
  actualizarDiasRestantes();
  generarHojaAlertas();
  construirTablero();
  return 'Acción ' + idAccion + ' eliminada.';
}
