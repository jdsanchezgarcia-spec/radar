/**
 * SEGUIMIENTOS
 * ============================================================================
 * Una fila de la hoja "Seguimientos" = UN COMPROMISO derivado de una UDA
 * (unidad de análisis), importado desde el Excel "Seguimiento_UDA_Completo".
 *
 * Un caso puede tener de 1 a 8 compromisos. El vínculo con la hoja "Casos"
 * se calcula por cédula y, si falla, por nombre (tolerando prefijos como
 * "MS ", "PT VEN" o "HIJO DE ...").
 *
 * Flujo del Excel:
 *   1. Copiar del Excel las 17 columnas (con su fila de encabezados).
 *   2. Pegarlas en la hoja "Importar"  (o directamente en "Seguimientos").
 *   3. Menú Radar → "Importar seguimientos desde Excel".
 *   Los ID_Seguimiento, ID_Caso y Vínculo se completan solos.
 */

var ANCHOS_SEGUIMIENTOS = [110, 95, 45, 240, 80, 130, 95, 105, 150, 190, 260, 400, 190, 115, 240, 115, 480, 100, 95, 90, 110, 125];
var ANCHOS_IMPORTAR = [45, 240, 80, 130, 95, 105, 150, 190, 260, 400, 190, 115, 240, 115, 480, 100, 95];

// ---------------------------------------------------------------------------
// Hojas
// ---------------------------------------------------------------------------

function hojaSeguimientos() {
  const libro = ss();
  let h = libro.getSheetByName(CFG.HOJAS.SEGUIMIENTOS);
  if (!h) h = crearHoja(CFG.HOJAS.SEGUIMIENTOS, COL.SEGUIMIENTOS, ANCHOS_SEGUIMIENTOS);
  return h;
}

function hojaImportar() {
  const libro = ss();
  let h = libro.getSheetByName(CFG.HOJAS.IMPORTAR);
  if (!h) h = crearHoja(CFG.HOJAS.IMPORTAR, COL.IMPORTAR_EXCEL, ANCHOS_IMPORTAR);
  return h;
}

function asegurarHojasSeguimiento() {
  hojaSeguimientos();
  hojaImportar();
}

// ---------------------------------------------------------------------------
// Normalización de datos "sucios" que vienen del Excel
// ---------------------------------------------------------------------------

function quitarAcentos(valor) {
  const t = String(valor === null || valor === undefined ? '' : valor);
  if (!t.normalize) return t;
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function soloDigitos(valor) {
  return String(valor || '').replace(/\D+/g, '');
}

/** "MS 1029961783" -> "1029961783" · "PT VEN7153296" -> "7153296" */
function normalizarIdentificacion(valor) {
  const texto = normalizarTexto(valor);
  if (!texto) return '';
  const digitos = soloDigitos(texto);
  return digitos || texto.toUpperCase();
}

/**
 * "HIJO DE INGRY LISETH PATARROYO CHAPARRO" -> "INGRY LISETH PATARROYO CHAPARRO"
 * "H/ERIKA YINARI MARIN TORRES"              -> "ERIKA YINARI MARIN TORRES"
 * Se aplica el MISMO filtro a los dos lados de la comparación.
 */
function normalizarNombreCaso(valor) {
  let t = quitarAcentos(valor).toUpperCase().replace(/\s+/g, ' ').trim();
  let previo = null;
  let guardas = 0;
  while (previo !== t && guardas < 4) {
    previo = t;
    t = t.replace(/^(HIJO|HIJA|NIÑO|NIÑA|BEBE|BEBÉ)\s+(DE|DEL)\s+/g, ' ');
    t = t.replace(/^(H|F|M)\s*\/\s*/g, ' ');
    t = t.replace(/^DE\s+/g, ' ');
    t = t.replace(/\s+/g, ' ').trim();
    guardas++;
  }
  return t;
}

/** "CUMPLE " / "no cumple" / "PARCIAL" -> valor normalizado del catálogo. */
function normalizarEstadoSeguimiento(valor) {
  const t = quitarAcentos(valor).toUpperCase().replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.indexOf('NO CUMPLE') >= 0 || t.indexOf('NO CUMPL') >= 0) return 'NO CUMPLE';
  if (t.indexOf('PARCIAL') >= 0) return 'PARCIAL';
  if (t.indexOf('CUMPLE') >= 0 || t.indexOf('CUMPL') >= 0) return 'CUMPLE';
  if (CFG.ESTADOS_SEGUIMIENTO.indexOf(t) >= 0) return t;
  return t;
}

/** "66,6" -> 66.6 · "100%" -> 100 · "" -> "" */
function normalizarPorcentajeSeguimiento(valor) {
  if (valor === '' || valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return valor;
  let t = String(valor).trim().replace(/\s*%\s*$/, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(t);
  if (isNaN(n)) return '';
  return Math.max(0, Math.min(CFG.PORCENTAJE_SEGUIMIENTO_MAX, n));
}

/**
 * El Excel trae fechas imposibles por autocompletado (30/1/2028, 13/08/2031...)
 * y textos como "PERMANENTEMENTE" o "INMEDIATO".
 * Devuelve un aviso corto o '' si la fecha es creíble.
 */
function avisoFechaSeguimiento(valor) {
  const f = aFecha(valor);
  if (!f) return '';
  const anio = f.getFullYear();
  const maximo = new Date().getFullYear() + 1;
  if (anio > maximo) return 'Fecha fuera de rango (' + anio + ')';
  if (anio < 2000) return 'Fecha fuera de rango (' + anio + ')';
  return '';
}

/**
 * Convierte a "dd/MM/yyyy" solo lo que ES una fecha.
 * Si la celda trae texto (INMEDIATO, PERMANENTEMENTE, SEM 7...), lo devuelve tal cual.
 */
function textoFechaSeguimiento(valor) {
  if (valor instanceof Date) return formatearFecha(valor);
  const t = normalizarTexto(valor);
  if (!t) return '';
  const pareceFecha = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(t) || /^\d{4}-\d{1,2}-\d{1,2}/.test(t);
  if (!pareceFecha) return t;
  const f = aFecha(t);
  return f ? formatearFecha(f) : t;
}

/** Igual que textoFechaSeguimiento pero con hora: "dd/MM/yyyy HH:mm". */
function textoFechaHoraSeguimiento(valor) {
  if (valor instanceof Date) return Utilities.formatDate(valor, CFG.ZONA_HORARIA, 'dd/MM/yyyy HH:mm');
  const t = normalizarTexto(valor);
  if (!t) return '';
  const pareceFecha = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(t) || /^\d{4}-\d{1,2}-\d{1,2}/.test(t);
  if (!pareceFecha) return t;
  const f = aFecha(t);
  return f ? formatearFecha(f) : t;
}

// ---------------------------------------------------------------------------
// Índice de casos para el vínculo
// ---------------------------------------------------------------------------

function indiceCasosSeguimiento() {
  const porIdentificacion = {};
  const porNombre = {};
  const porId = {};
  leerTabla(CFG.HOJAS.CASOS).forEach(function (c) {
    const id = normalizarTexto(c['ID_Caso']);
    if (!id) return;
    porId[id] = {
      id: id,
      caso: normalizarTexto(c['CASO']),
      cc: normalizarTexto(c['# cc']),
      profesional: normalizarTexto(c['PROFESIONAL ASIGNADO']),
      eapb: normalizarTexto(c['EAPB']),
      conclusion: normalizarTexto(c['CONCLUSIÓN UNIDAD DE ANÁLISIS'])
    };
    const cc = normalizarIdentificacion(c['# cc']);
    if (cc && !porIdentificacion[cc]) porIdentificacion[cc] = id;
    const nm = normalizarNombreCaso(c['CASO']);
    if (nm && !porNombre[nm]) porNombre[nm] = id;
  });
  return { porIdentificacion: porIdentificacion, porNombre: porNombre, porId: porId };
}

/**
 * 1) cédula exacta  2) solo dígitos  3) dígitos con 1 de diferencia (sobra un
 * "1" al principio)  4) nombre sin "HIJO DE"  →  '' si queda sin vincular.
 */
function vincularSeguimiento(identificacion, nombre, indice) {
  const cc = normalizarIdentificacion(identificacion);
  const nm = normalizarNombreCaso(nombre);

  if (cc) {
    if (indice.porIdentificacion[cc]) return indice.porIdentificacion[cc];

    if (cc.length >= 8) {
      const claves = Object.keys(indice.porIdentificacion);
      for (let i = 0; i < claves.length; i++) {
        const k = claves[i];
        if (k.length >= 8 && Math.abs(k.length - cc.length) <= 1 && (k.endsWith(cc) || cc.endsWith(k))) {
          return indice.porIdentificacion[k];
        }
      }
    }
  }
  if (nm && indice.porNombre[nm]) return indice.porNombre[nm];
  return '';
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

function listaSeguimientos() {
  asegurarHojasSeguimiento();

  const filas = leerTabla(CFG.HOJAS.SEGUIMIENTOS);
  if (!filas.length) return [];

  const indice = indiceCasosSeguimiento();
  const sinMarca = [];

  const lista = filas.map(function (r) {
    const idCaso = vincularSeguimiento(r['N° IDENTIFICACIÓN'], r['NOMBRE'], indice);
    const caso = idCaso ? indice.porId[idCaso] : null;
    const id = normalizarTexto(r['ID_Seguimiento']);
    const estado = normalizarEstadoSeguimiento(r['ESTADO']);

    // Solo hace falta escribir en la hoja si la fila llegó sin ID y sin marcar.
    if (!id || !normalizarTexto(r['Vínculo'])) {
      sinMarca.push({ fila: r._fila, id: id, idCaso: idCaso });
    }

    const fechaCumplimiento = textoFechaSeguimiento(r['Fecha de cumplimiento']);
    const fechaSeguimiento = textoFechaSeguimiento(r['fecha de seguimiento']);
    const dias = diasRestantes(r['Fecha de cumplimiento']);
    const alerta = alertaSeguimiento(estado, dias, fechaCumplimiento);

    return {
      id: id,
      fila: r._fila,
      idCaso: idCaso,
      vinculo: idCaso ? 'Vinculado' : 'Sin vincular',
      n: normalizarTexto(r['N°']),
      nombre: normalizarTexto(r['NOMBRE']),
      tipoId: normalizarTexto(r['TIPO DE ID']),
      identificacion: normalizarTexto(r['N° IDENTIFICACIÓN']),
      evento: normalizarTexto(r['EVENTO']),
      fechaUda: textoFechaSeguimiento(r['FECHA DE UDA']),
      eapb: normalizarTexto(r['EAPB RESPONSABLE']),
      ips: normalizarTexto(r['IPS RESPONSABLE']),
      fechasSeguimiento: textoFechaSeguimiento(r['FECHAS Y OBSERVACIONES DE LOS SEGUIMIENTOS REALIZADOS']),
      compromiso: normalizarTexto(r['COMPROMISO']),
      responsableCompromiso: normalizarTexto(r['Responsable del compromiso']),
      fechaCumplimiento: fechaCumplimiento,
      responsableSeguimiento: normalizarTexto(r['Responsable del seguimiento al compromiso']),
      fechaSeguimiento: fechaSeguimiento,
      observacion: normalizarTexto(r['OBSERVACIÓN DE SEGUIMIENTO']),
      estado: estado,
      porcentaje: normalizarPorcentajeSeguimiento(r['PORCENTAJE']),
      profesional: normalizarTexto(r['Profesional']) || (caso ? caso.profesional : ''),
      caso: caso ? caso.caso : normalizarTexto(r['NOMBRE']),
      avisoUda: avisoFechaSeguimiento(r['FECHA DE UDA']),
      avisoCumplimiento: avisoFechaSeguimiento(r['Fecha de cumplimiento']),
      avisoSeguimiento: avisoFechaSeguimiento(r['fecha de seguimiento']),
      actualizacion: textoFechaHoraSeguimiento(r['Última actualización']),
      dias: dias,
      alerta: alerta,
      detalleAlerta: detalleAlertaSeguimiento(estado, dias, fechaCumplimiento, fechaSeguimiento)
    };
  });

  // Completar ID / vínculo en la hoja solo si faltan (una vez tras pegar datos).
  if (sinMarca.length) marcarSeguimientos(sinMarca);

  const ordenAlerta = { 'NO CUMPLE': 0, 'VENCIDA': 1, 'PARCIAL': 2, 'SIN FECHA': 3, '': 4 };
  lista.sort(function (a, b) {
    const oa = ordenAlerta[a.alerta] === undefined ? 3 : ordenAlerta[a.alerta];
    const ob = ordenAlerta[b.alerta] === undefined ? 3 : ordenAlerta[b.alerta];
    if (oa !== ob) return oa - ob;
    const da = a.dias === null ? 99999 : a.dias;
    const db = b.dias === null ? 99999 : b.dias;
    if (da !== db) return da - db;
    return String(a.caso || '').localeCompare(String(b.caso || ''));
  });
  return lista;
}

function alertaSeguimiento(estado, dias, fechaCumplimiento) {
  if (estado === 'NO CUMPLE') return 'NO CUMPLE';
  if (estado === 'PARCIAL') return 'PARCIAL';
  if (estado === 'CUMPLE') return '';
  if (dias === null) return fechaCumplimiento ? '' : 'SIN FECHA';
  return dias < 0 ? 'VENCIDA' : '';
}

function detalleAlertaSeguimiento(estado, dias, fechaCumplimiento, fechaSeguimiento) {
  if (estado === 'NO CUMPLE') return 'El compromiso no fue cumplido por la institución responsable.';
  if (estado === 'PARCIAL') return 'Cumplimiento parcial: faltan soportes o actividades pendientes.';
  if (estado === 'CUMPLE') return '';
  if (dias !== null && dias < 0) {
    return 'La fecha de cumplimiento (' + fechaCumplimiento + ') venció hace ' + Math.abs(dias) + ' día(s).';
  }
  if (dias !== null && dias <= 15) {
    return 'La fecha de cumplimiento vence en ' + dias + ' día(s).';
  }
  if (!fechaCumplimiento && !fechaSeguimiento) {
    return 'Este compromiso no tiene fecha de cumplimiento ni fecha de seguimiento.';
  }
  return '';
}

/** Escribe ID_Seguimiento / ID_Caso / Vínculo en las filas que llegaron vacías. */
function marcarSeguimientos(pendientes) {
  try {
    if (!pendientes || !pendientes.length) return;
    const h = hojaSeguimientos();
    const colId = indiceColumna('ID_Seguimiento', COL.SEGUIMIENTOS);
    const colCaso = indiceColumna('ID_Caso', COL.SEGUIMIENTOS);
    const colVin = indiceColumna('Vínculo', COL.SEGUIMIENTOS);
    const colAct = indiceColumna('Última actualización', COL.SEGUIMIENTOS);

    // Los ID se generan sobre el máximo existente para no repetir.
    let maximo = 0;
    const ultimaFila = h.getLastRow();
    if (ultimaFila >= 2) {
      h.getRange(2, colId, ultimaFila - 1, 1).getValues().forEach(function (v) {
        const m = String(v[0]).match(/(\d+)\s*$/);
        if (m) maximo = Math.max(maximo, parseInt(m[1], 10));
      });
    }

    // Se leen y reescriben las filas pendientes en UN SOLO lote
    // (tras importar el Excel suelen ser seguidas: 1 lectura + 1 escritura).
    const numeros = pendientes.map(function (p) { return p.fila; });
    const desde = Math.min.apply(null, numeros);
    const hasta = Math.max.apply(null, numeros);
    const bloque = h.getRange(desde, 1, hasta - desde + 1, COL.SEGUIMIENTOS.length).getValues();
    const ahora = new Date();
    const porFila = {};
    pendientes.forEach(function (p) { porFila[p.fila] = p; });

    for (let fila = desde; fila <= hasta; fila++) {
      const p = porFila[fila];
      if (!p) continue;
      const idx = fila - desde;
      if (!p.id) {
        maximo += 1;
        p.id = 'SG-' + String(maximo).padStart(4, '0');
      }
      bloque[idx][colId - 1] = p.id;
      bloque[idx][colCaso - 1] = p.idCaso || '';
      bloque[idx][colVin - 1] = p.idCaso ? 'Vinculado' : 'Sin vincular';
      bloque[idx][colAct - 1] = ahora;
    }
    h.getRange(desde, 1, bloque.length, COL.SEGUIMIENTOS.length).setValues(bloque);
  } catch (e) {
    // Nunca debe romper la lectura del panel por un problema de escritura.
    console.log('No se pudieron marcar los seguimientos: ' + e.message);
  }
}

function kpiSeguimientos(lista) {
  const l = Array.isArray(lista) ? lista : listaSeguimientos();
  const kpi = { total: 0, cumple: 0, parcial: 0, noCumple: 0, sinVincular: 0, promedio: null };
  let suma = 0;
  let conPorcentaje = 0;
  l.forEach(function (s) {
    kpi.total++;
    if (s.estado === 'CUMPLE') kpi.cumple++;
    else if (s.estado === 'PARCIAL') kpi.parcial++;
    else if (s.estado === 'NO CUMPLE') kpi.noCumple++;
    if (!s.idCaso) kpi.sinVincular++;
    if (s.porcentaje !== '' && s.porcentaje !== null && s.porcentaje !== undefined) {
      suma += Number(s.porcentaje);
      conPorcentaje++;
    }
  });
  kpi.promedio = conPorcentaje ? Math.round((suma / conPorcentaje) * 10) / 10 : null;
  return kpi;
}

// ---------------------------------------------------------------------------
// Escritura (alta / edición / borrado)
// ---------------------------------------------------------------------------

function exigirPermisoSeguimiento(usuario, idSeguimiento, datos) {
  if (!usuario) throw new Error('Debes iniciar sesión.');
  const rol = canonizarRol(usuario.rol);
  if (rol === CFG.ROLES.ADMIN) return;
  if (rol !== CFG.ROLES.PROFESIONAL) {
    throw new Error('Tu rol no puede modificar seguimientos.');
  }

  const indice = indiceCasosSeguimiento();
  let idCaso = '';
  if (idSeguimiento) {
    const existente = buscarSeguimiento(idSeguimiento);
    if (!existente) throw new Error('No existe el seguimiento "' + idSeguimiento + '".');
    idCaso = existente.idCaso;
  } else if (datos) {
    idCaso = vincularSeguimiento(
      datos.identificacion || datos['N° IDENTIFICACIÓN'],
      datos.nombre || datos.NOMBRE,
      indice
    );
  }

  if (!idCaso) {
    throw new Error('Solo un administrador puede modificar seguimientos que no tienen caso vinculado.');
  }
  const caso = indice.porId[idCaso];
  const yo = String(usuario.nombre || '').trim().toLowerCase();
  const responsable = caso ? String(caso.profesional).trim().toLowerCase() : '';
  if (!responsable || responsable !== yo) {
    throw new Error('Solo puedes modificar los seguimientos de tus casos asignados.');
  }
}

function buscarSeguimiento(id) {
  const objetivo = normalizarTexto(id);
  if (!objetivo) return null;
  const encontrados = listaSeguimientos().filter(function (s) {
    return s.id === objetivo || String('' + s.fila) === objetivo;
  });
  return encontrados.length ? encontrados[0] : null;
}

function registrarSeguimiento(datos) {
  const nombre = normalizarTexto(datos.nombre || datos.NOMBRE);
  const compromiso = normalizarTexto(datos.compromiso || datos.COMPROMISO);
  if (!nombre) throw new Error('El nombre del caso (NOMBRE) es obligatorio.');
  if (!compromiso) throw new Error('El COMPROMISO es obligatorio.');

  const indice = indiceCasosSeguimiento();
  const idCaso = vincularSeguimiento(datos.identificacion || datos['N° IDENTIFICACIÓN'], nombre, indice);

  const id = generarId('SG-', CFG.HOJAS.SEGUIMIENTOS, 1);
  const h = hojaSeguimientos();
  h.appendRow([
    id,
    idCaso,
    normalizarTexto(datos.n),
    nombre,
    normalizarTexto(datos.tipoId) || 'C.C',
    normalizarTexto(datos.identificacion),
    normalizarTexto(datos.evento),
    normalizarTexto(datos.fechaUda),
    normalizarTexto(datos.eapb),
    normalizarTexto(datos.ips),
    normalizarTexto(datos.fechasSeguimiento),
    compromiso,
    normalizarTexto(datos.responsableCompromiso),
    normalizarTexto(datos.fechaCumplimiento),
    normalizarTexto(datos.responsableSeguimiento),
    normalizarTexto(datos.fechaSeguimiento),
    normalizarTexto(datos.observacion),
    normalizarEstadoSeguimiento(datos.estado) || 'PARCIAL',
    normalizarPorcentajeSeguimiento(datos.porcentaje),
    normalizarTexto(datos.profesional),
    idCaso ? 'Vinculado' : 'Sin vincular',
    new Date()
  ]);
  return id;
}

function editarSeguimiento(datos) {
  const id = normalizarTexto(datos.id);
  const existente = buscarSeguimiento(id);
  if (!existente) throw new Error('No existe el seguimiento "' + id + '".');
  if (!existente.fila) throw new Error('No se pudo ubicar la fila del seguimiento ' + id + '.');

  const campos = {};
  const mapa = {
    nombre: 'NOMBRE',
    tipoId: 'TIPO DE ID',
    identificacion: 'N° IDENTIFICACIÓN',
    evento: 'EVENTO',
    fechaUda: 'FECHA DE UDA',
    eapb: 'EAPB RESPONSABLE',
    ips: 'IPS RESPONSABLE',
    fechasSeguimiento: 'FECHAS Y OBSERVACIONES DE LOS SEGUIMIENTOS REALIZADOS',
    compromiso: 'COMPROMISO',
    responsableCompromiso: 'Responsable del compromiso',
    fechaCumplimiento: 'Fecha de cumplimiento',
    responsableSeguimiento: 'Responsable del seguimiento al compromiso',
    fechaSeguimiento: 'fecha de seguimiento',
    observacion: 'OBSERVACIÓN DE SEGUIMIENTO',
    profesional: 'Profesional'
  };
  Object.keys(mapa).forEach(function (k) {
    if (datos[k] !== undefined) campos[mapa[k]] = normalizarTexto(datos[k]);
  });
  if (datos.estado !== undefined) campos['ESTADO'] = normalizarEstadoSeguimiento(datos.estado);
  if (datos.porcentaje !== undefined) {
    campos['PORCENTAJE'] = normalizarPorcentajeSeguimiento(datos.porcentaje);
  }

  // Si cambió la identificación o el nombre, se recalcula el vínculo.
  const nuevaIdent = datos.identificacion !== undefined ? datos.identificacion : existente.identificacion;
  const nuevoNombre = datos.nombre !== undefined ? datos.nombre : existente.nombre;
  const indice = indiceCasosSeguimiento();
  const idCaso = vincularSeguimiento(nuevaIdent, nuevoNombre, indice);
  campos['ID_Caso'] = idCaso;
  campos['Vínculo'] = idCaso ? 'Vinculado' : 'Sin vincular';
  campos['Última actualización'] = new Date();

  escribirCampos(CFG.HOJAS.SEGUIMIENTOS, COL.SEGUIMIENTOS, existente.fila, campos);
  return existente.id;
}

function eliminarSeguimiento(id) {
  const existente = buscarSeguimiento(id);
  if (!existente) throw new Error('No existe el seguimiento "' + id + '".');
  const h = hojaSeguimientos();
  h.deleteRow(existente.fila);
  return existente.id;
}

// ---------------------------------------------------------------------------
// Importación desde la hoja "Importar"
// ---------------------------------------------------------------------------

function normalizarEncabezado(valor) {
  return quitarAcentos(valor).toUpperCase().replace(/[^A-Z0-9Ñ%]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function importarSeguimientos(profesional) {
  const h = hojaImportar();
  const ultimaFila = h.getLastRow();
  const ultimaCol = h.getLastColumn();
  if (ultimaFila < 2 || ultimaCol < 1) {
    throw new Error('La hoja "' + CFG.HOJAS.IMPORTAR + '" está vacía. Pega ahí las 17 columnas del Excel (con su fila de encabezados) y vuelve a importar.');
  }

  const valores = h.getRange(1, 1, ultimaFila, ultimaCol).getValues();

  // ¿La fila 1 trae encabezados reconocibles?
  const esperados = COL.IMPORTAR_EXCEL.map(normalizarEncabezado);
  const fila1 = valores[0].map(normalizarEncabezado);
  const mapa = {};
  let encontrados = 0;
  COL.IMPORTAR_EXCEL.forEach(function (nombre, i) {
    const idx = fila1.indexOf(esperados[i]);
    if (idx >= 0) { mapa[i] = idx; encontrados++; }
  });
  const conEncabezados = encontrados >= 12;
  const primeraFila = conEncabezados ? 1 : 0;

  // Si no hay encabezados, se asume el orden exacto del Excel (17 columnas).
  if (!conEncabezados) {
    COL.IMPORTAR_EXCEL.forEach(function (_, i) { mapa[i] = i; });
    if (ultimaCol < COL.IMPORTAR_EXCEL.length) {
      throw new Error('No se reconencieron los encabezados y la hoja tiene ' + ultimaCol +
        ' columnas (se esperan ' + COL.IMPORTAR_EXCEL.length + '). Pega el Excel completo.');
    }
  }

  function celda(fila, iDestino) {
    const origen = mapa[iDestino];
    if (origen === undefined || origen >= valores[fila].length) return '';
    const v = valores[fila][origen];
    return v instanceof Date ? Utilities.formatDate(v, CFG.ZONA_HORARIA, 'dd/MM/yyyy') : v;
  }

  const hojaDestino = hojaSeguimientos();
  const existentes = {};
  leerTabla(CFG.HOJAS.SEGUIMIENTOS).forEach(function (r) {
    const clave = normalizarNombreCaso(r['NOMBRE']) + '|' + normalizarIdentificacion(r['N° IDENTIFICACIÓN']) + '|' + normalizarNombreCaso(r['COMPROMISO']);
    existentes[clave] = true;
  });

  const indice = indiceCasosSeguimiento();
  const nuevas = [];
  let duplicados = 0;
  let sinVincular = 0;

  for (let f = primeraFila; f < valores.length; f++) {
    // Índices según COL.IMPORTAR_EXCEL (0=N° ... 16=PORCENTAJE).
    const nombre = normalizarTexto(celda(f, 1));
    const identificacion = normalizarTexto(celda(f, 3));
    const compromiso = normalizarTexto(celda(f, 9));
    if (!nombre && !compromiso) continue;          // fila vacía
    if (!compromiso) continue;                     // sin compromiso no es una fila válida
    // Fila de encabezados repetida dentro de los datos: se ignora.
    if (normalizarEncabezado(nombre) === 'NOMBRE' && normalizarEncabezado(compromiso) === 'COMPROMISO') continue;

    const clave = normalizarNombreCaso(nombre) + '|' + normalizarIdentificacion(identificacion) + '|' + normalizarNombreCaso(compromiso);
    if (existentes[clave]) { duplicados++; continue; }
    existentes[clave] = true;

    const idCaso = vincularSeguimiento(identificacion, nombre, indice);
    if (!idCaso) sinVincular++;

    nuevas.push([
      '', // ID_Seguimiento: lo completa listaSeguimientos()
      idCaso,
      normalizarTexto(celda(f, 0)),
      nombre,
      normalizarTexto(celda(f, 2)),
      identificacion,
      normalizarTexto(celda(f, 4)),
      normalizarTexto(celda(f, 5)),
      normalizarTexto(celda(f, 6)),
      normalizarTexto(celda(f, 7)),
      normalizarTexto(celda(f, 8)),
      compromiso,
      normalizarTexto(celda(f, 10)),
      normalizarTexto(celda(f, 11)),
      normalizarTexto(celda(f, 12)),
      normalizarTexto(celda(f, 13)),
      normalizarTexto(celda(f, 14)),
      normalizarEstadoSeguimiento(celda(f, 15)),
      normalizarPorcentajeSeguimiento(celda(f, 16)),
      normalizarTexto(profesional),
      idCaso ? 'Vinculado' : 'Sin vincular',
      new Date()
    ]);
  }

  if (nuevas.length) {
    // "nuevas" ya es una matriz 2D (fila = 22 celdas): se escribe tal cual.
    hojaDestino.getRange(hojaDestino.getLastRow() + 1, 1, nuevas.length, COL.SEGUIMIENTOS.length).setValues(nuevas);
  }

  return {
    agregados: nuevas.length,
    duplicados: duplicados,
    sinVincular: sinVincular,
    encabezados: conEncabezados
  };
}

// ---------------------------------------------------------------------------
// Reindexar: rellena ID_Seguimiento / ID_Caso / Vínculo de todas las filas
// ---------------------------------------------------------------------------

function marcarVinculosSeguimiento() {
  const h = hojaSeguimientos();
  const ultimaFila = h.getLastRow();
  if (ultimaFila < 2) return { filas: 0 };

  const indice = indiceCasosSeguimiento();
  const colId = indiceColumna('ID_Seguimiento', COL.SEGUIMIENTOS);
  const colCaso = indiceColumna('ID_Caso', COL.SEGUIMIENTOS);
  const colVin = indiceColumna('Vínculo', COL.SEGUIMIENTOS);
  const colAct = indiceColumna('Última actualización', COL.SEGUIMIENTOS);
  const colNombre = indiceColumna('NOMBRE', COL.SEGUIMIENTOS);
  const colIdent = indiceColumna('N° IDENTIFICACIÓN', COL.SEGUIMIENTOS);

  const datos = h.getRange(2, 1, ultimaFila - 1, COL.SEGUIMIENTOS.length).getValues();

  let maximo = 0;
  datos.forEach(function (fila) {
    const m = String(fila[colId - 1]).match(/(\d+)\s*$/);
    if (m) maximo = Math.max(maximo, parseInt(m[1], 10));
  });

  let tocadas = 0;
  let sinVincular = 0;
  datos.forEach(function (fila, i) {
    const nombre = fila[colNombre - 1];
    const ident = fila[colIdent - 1];
    if (nombre === '' && ident === '') return;
    const idCaso = vincularSeguimiento(ident, nombre, indice);
    if (!idCaso) sinVincular++;
    const idActual = normalizarTexto(fila[colId - 1]);
    if (!idActual) {
      maximo += 1;
      h.getRange(i + 2, colId).setValue('SG-' + String(maximo).padStart(4, '0'));
    }
    h.getRange(i + 2, colCaso).setValue(idCaso || '');
    h.getRange(i + 2, colVin).setValue(idCaso ? 'Vinculado' : 'Sin vincular');
    h.getRange(i + 2, colAct).setValue(new Date());
    tocadas++;
  });
  return { filas: tocadas, sinVincular: sinVincular };
}

// ---------------------------------------------------------------------------
// Entradas de menú
// ---------------------------------------------------------------------------

function menuImportarSeguimientos() {
  let profesional = '';
  try {
    const respuesta = SpreadsheetApp.getUi().prompt(
      'Importar seguimientos desde Excel',
      'Pega en la hoja "' + CFG.HOJAS.IMPORTAR + '" las 17 columnas del Excel (con encabezados).\n\n' +
      'Profesional responsable (opcional, ej. DIANA o LUCIA):',
      SpreadsheetApp.getUi().ButtonSet.OK_CANCEL
    );
    if (respuesta.getSelectedButton() !== SpreadsheetApp.getUi().Button.OK) return;
    profesional = String(respuesta.getResponseText() || '').trim();
  } catch (e) {
    // Se ejecutó desde el editor (sin Ui): se importa sin profesional.
  }

  try {
    const r = importarSeguimientos(profesional);
    mostrarAviso(
      'Importación finalizada.\n\n' +
      'Agregados: ' + r.agregados + '\n' +
      'Duplicados omitidos: ' + r.duplicados + '\n' +
      'Sin vincular a un caso: ' + r.sinVincular +
      (r.agregados && r.sinVincular ? '\n\nRevisa las filas marcadas "Sin vincular" en la hoja Seguimientos.' : '')
    );
  } catch (e) {
    mostrarAviso('No se pudo importar: ' + e.message);
  }
}

function menuMarcarVinculosSeguimiento() {
  try {
    const r = marcarVinculosSeguimiento();
    mostrarAviso('Vínculos recalculados en ' + r.filas + ' fila(s).\nSin vincular: ' + r.sinVincular);
  } catch (e) {
    mostrarAviso('No se pudo recalcular: ' + e.message);
  }
}
