function semanasVencimiento() {
  const n = Number(valorParametro('SEMANAS_VENCIMIENTO', CFG.PARAMETROS.SEMANAS_VENCIMIENTO));
  return isNaN(n) || n <= 0 ? 5 : n;
}

function aRomanos(n) {
  const tabla = [
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let numero = n;
  let salida = '';
  tabla.forEach(function (t) {
    while (numero >= t[0]) {
      salida += t[1];
      numero -= t[0];
    }
  });
  return salida;
}

function periodoEpidemiologico(valor) {
  const f = aFecha(valor);
  if (!f) return '';
  const diaSemana = f.getDay();
  const jueves = new Date(f.getFullYear(), f.getMonth(), f.getDate() + 4 - (diaSemana === 0 ? 7 : diaSemana));
  const inicio = new Date(jueves.getFullYear(), 0, 1);
  const semana = Math.ceil((((jueves - inicio) / 86400000) + 1) / 7);
  return aRomanos(semana) + ' del ' + jueves.getFullYear();
}

function alertaDeCaso(reg) {
  if (!reg) return null;
  const realizado = aFecha(reg['FECHA DE REALIZACIÓN']);
  if (realizado) return null;
  const dr = diasRestantes(reg['FECHA DE VENCIMIENTO']);
  if (dr === null) {
    return { nivel: 'SIN FECHA LÍMITE', detalle: 'El caso no tiene fecha de vencimiento definida.' };
  }
  if (dr < 0) {
    return { nivel: 'VENCIDA', detalle: 'Caso vencido hace ' + Math.abs(dr) + ' día(s); falta la fecha de realización.' };
  }
  const diasAlerta = diasAlertaVencimiento();
  if (dr <= diasAlerta) {
    return { nivel: 'PRÓXIMO A VENCER', detalle: 'El caso vence en ' + dr + ' día(s).' };
  }
  return null;
}

function listaCasos() {
  const filas = leerTabla(CFG.HOJAS.CASOS);
  const orden = {};
  ['VENCIDA', 'PRÓXIMO A VENCER', 'SIN FECHA LÍMITE'].forEach(function (n, i) {
    orden[n] = i;
  });
  const lista = filas.map(function (reg) {
    const alerta = alertaDeCaso(reg);
    const dr = diasRestantes(reg['FECHA DE VENCIMIENTO']);
    return {
      id: normalizarTexto(reg['ID_Caso']),
      caso: normalizarTexto(reg['CASO']),
      cc: normalizarTexto(reg['# cc']),
      edad: reg['EDAD'] === '' ? '' : reg['EDAD'],
      gestaciones: normalizarTexto(reg['GESTACIONES']),
      evento: normalizarTexto(reg['EVENTO']),
      fechaDefuncion: formatearFecha(reg['FECHA DE DEFUNCIÓN']),
      fechaAsignacion: formatearFecha(reg['FECHA DE ASIGNACIÓN']),
      fechaVencimiento: formatearFecha(reg['FECHA DE VENCIMIENTO']),
      fechaRealizacion: formatearFecha(reg['FECHA DE REALIZACIÓN']),
      periodo: normalizarTexto(reg['PERÍODO EPIDEMIOLÓGICO']),
      eapb: normalizarTexto(reg['EAPB']),
      ipsPrimerNivel: normalizarTexto(reg['IPS DE PRIMER NIVEL']),
      ipsParto: normalizarTexto(reg['IPS DE ATENCIÓN DEL PARTO']),
      observacion: normalizarTexto(reg['OBSERVACIÓN']),
      causaMuerte: normalizarTexto(reg['CAUSA DE MUERTE']),
      conclusion: normalizarTexto(reg['CONCLUSIÓN UNIDAD DE ANÁLISIS']),
      profesional: normalizarTexto(reg['PROFESIONAL ASIGNADO']),
      intervinientes: normalizarTexto(reg['INTERVINIENTES EN LA UA']),
      seguimiento: normalizarTexto(reg['SEGUIMIENTO']),
      otrosDatos: normalizarTexto(reg['OTROS DATOS RELEVANTES']),
      estado: normalizarTexto(reg['ESTADO SEGUIMIENTO']),
      dias: dr,
      alerta: alerta ? alerta.nivel : '',
      detalleAlerta: alerta ? alerta.detalle : ''
    };
  });
  lista.sort(function (a, b) {
    const oa = a.alerta ? orden[a.alerta] : 99;
    const ob = b.alerta ? orden[b.alerta] : 99;
    if (oa !== ob) return oa - ob;
    const da = a.dias === null ? 99999 : a.dias;
    const db = b.dias === null ? 99999 : b.dias;
    return da - db;
  });
  return lista;
}

function registrarCaso(datos) {
  const caso = normalizarTexto(datos.caso);
  const cc = normalizarTexto(datos.cc);
  const defuncion = aFecha(datos.fechaDefuncion);
  if (!caso) throw new Error('El nombre del CASO es obligatorio.');
  if (!cc) throw new Error('El número de cédula (# cc) es obligatorio.');
  if (!defuncion) throw new Error('La fecha de defunción es obligatoria (usa el formato dd/mm/aaaa).');

  const semanas = semanasVencimiento();
  const vencimiento = aFecha(datos.fechaVencimiento);
  const vencFinal = vencimiento || new Date(defuncion.getFullYear(), defuncion.getMonth(), defuncion.getDate() + semanas * 7);
  const asignacion = aFecha(datos.fechaAsignacion) || hoy();

  const id = generarId('CS-', CFG.HOJAS.CASOS, 1);
  const h = hojaPorNombre(CFG.HOJAS.CASOS);
  h.appendRow([
    id,
    caso,
    cc,
    datos.edad === undefined || datos.edad === '' ? '' : Number(datos.edad),
    normalizarTexto(datos.gestaciones),
    normalizarTexto(datos.evento),
    defuncion,
    asignacion,
    vencFinal,
    aFecha(datos.fechaRealizacion) || '',
    normalizarTexto(datos.periodo) || periodoEpidemiologico(defuncion),
    normalizarTexto(datos.eapb),
    normalizarTexto(datos.ipsPrimerNivel),
    normalizarTexto(datos.ipsParto),
    normalizarTexto(datos.observacion),
    normalizarTexto(datos.causaMuerte),
    normalizarTexto(datos.conclusion),
    normalizarTexto(datos.profesional),
    normalizarTexto(datos.intervinientes),
    normalizarTexto(datos.seguimiento),
    normalizarTexto(datos.otrosDatos),
    normalizarTexto(datos.estado) || CFG.ESTADOS_CASO[0]
  ]);
  return id;
}

function editarSeguimientoCaso(datos) {
  const id = normalizarTexto(datos.id);
  const reg = leerTabla(CFG.HOJAS.CASOS).filter(function (c) {
    return normalizarTexto(c['ID_Caso']) === id;
  })[0];
  if (!reg) throw new Error('No existe el caso "' + id + '".');

  const campos = {};
  const textos = {
    caso: 'CASO',
    cc: '# cc',
    gestaciones: 'GESTACIONES',
    evento: 'EVENTO',
    periodo: 'PERÍODO EPIDEMIOLÓGICO',
    eapb: 'EAPB',
    ipsPrimerNivel: 'IPS DE PRIMER NIVEL',
    ipsParto: 'IPS DE ATENCIÓN DEL PARTO',
    causaMuerte: 'CAUSA DE MUERTE',
    conclusion: 'CONCLUSIÓN UNIDAD DE ANÁLISIS',
    intervinientes: 'INTERVINIENTES EN LA UA',
    seguimiento: 'SEGUIMIENTO',
    otrosDatos: 'OTROS DATOS RELEVANTES',
    observacion: 'OBSERVACIÓN',
    profesional: 'PROFESIONAL ASIGNADO',
    estado: 'ESTADO SEGUIMIENTO'
  };
  Object.keys(textos).forEach(function (k) {
    if (datos[k] !== undefined) campos[textos[k]] = normalizarTexto(datos[k]);
  });
  if (datos.edad !== undefined) campos['EDAD'] = datos.edad === '' ? '' : Number(datos.edad);
  const fechas = {
    fechaDefuncion: 'FECHA DE DEFUNCIÓN',
    fechaAsignacion: 'FECHA DE ASIGNACIÓN',
    fechaVencimiento: 'FECHA DE VENCIMIENTO',
    fechaRealizacion: 'FECHA DE REALIZACIÓN'
  };
  Object.keys(fechas).forEach(function (k) {
    if (datos[k] !== undefined) {
      const f = aFecha(datos[k]);
      if (datos[k] !== '' && !f) throw new Error('La fecha "' + fechas[k] + '" no es válida.');
      campos[fechas[k]] = f || '';
    }
  });

  escribirCampos(CFG.HOJAS.CASOS, COL.CASOS, reg._fila, campos);
  return id;
}

function asignarProfesional(datos, usuario) {
  exigirRol(usuario, [CFG.ROLES.ADMIN]);
  const id = normalizarTexto(datos.idCaso);
  const reg = leerTabla(CFG.HOJAS.CASOS).filter(function (c) {
    return normalizarTexto(c['ID_Caso']) === id;
  })[0];
  if (!reg) throw new Error('No existe el caso "' + id + '".');
  const profesional = normalizarTexto(datos.profesional);
  escribirCampos(CFG.HOJAS.CASOS, COL.CASOS, reg._fila, { 'PROFESIONAL ASIGNADO': profesional });
  return 'Caso ' + id + ' asignado a ' + (profesional || 'sin asignar') + '.';
}

function eliminarCaso(id) {
  const h = hojaPorNombre(CFG.HOJAS.CASOS);
  const reg = leerTabla(CFG.HOJAS.CASOS).filter(function (c) {
    return normalizarTexto(c['ID_Caso']) === normalizarTexto(id);
  })[0];
  if (!reg) throw new Error('No existe el caso "' + id + '".');
  h.deleteRow(reg._fila);
  return id;
}

function kpiCasos() {
  const filas = leerTabla(CFG.HOJAS.CASOS);
  const kpi = { total: filas.length, realizados: 0, pendientes: 0, vencidos: 0, proximos: 0 };
  const diasAlerta = diasAlertaVencimiento();
  filas.forEach(function (reg) {
    if (aFecha(reg['FECHA DE REALIZACIÓN'])) { kpi.realizados++; return; }
    const dr = diasRestantes(reg['FECHA DE VENCIMIENTO']);
    if (dr !== null && dr < 0) { kpi.vencidos++; return; }
    if (dr !== null && dr <= diasAlerta) { kpi.proximos++; return; }
    kpi.pendientes++;
  });
  return kpi;
}

function kpiDesdeLista(casos) {
  const kpi = { total: casos.length, realizados: 0, pendientes: 0, vencidos: 0, proximos: 0 };
  const diasAlerta = diasAlertaVencimiento();
  casos.forEach(function (c) {
    if (c.fechaRealizacion) { kpi.realizados++; return; }
    const d = c.dias;
    if (d !== null && d !== undefined && d < 0) { kpi.vencidos++; return; }
    if (d !== null && d !== undefined && d <= diasAlerta) { kpi.proximos++; return; }
    kpi.pendientes++;
  });
  return kpi;
}

function filasAlertasDeCasos() {
  const filas = [];
  leerTabla(CFG.HOJAS.CASOS).forEach(function (reg) {
    const alerta = alertaDeCaso(reg);
    if (!alerta) return;
    const limite = aFecha(reg['FECHA DE VENCIMIENTO']);
    const dias = diasRestantes(reg['FECHA DE VENCIMIENTO']);
    filas.push([
      alerta.nivel,
      normalizarTexto(reg['ID_Caso']),
      normalizarTexto(reg['EAPB']),
      normalizarTexto(reg['PROFESIONAL ASIGNADO']),
      'Caso ' + normalizarTexto(reg['CASO']),
      limite || '',
      dias === null ? '' : dias,
      aFecha(reg['FECHA DE REALIZACIÓN']) ? 'Realizado' : 'Pendiente',
      '',
      alerta.detalle
    ]);
  });
  return filas;
}
