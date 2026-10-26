var _SS = null;

function ss() {
  if (_SS) return _SS;
  try {
    const activo = SpreadsheetApp.getActiveSpreadsheet();
    if (activo) {
      _SS = activo;
      return _SS;
    }
  } catch (e) {}
  const id = PropertiesService.getScriptProperties().getProperty('ID_LIBRO');
  if (id) {
    _SS = SpreadsheetApp.openById(id);
    return _SS;
  }
  throw new Error(
    'No se pudo acceder a la hoja de cálculo. Ejecuta "Instalar / Reparar sistema" desde el menú Radar en la hoja.'
  );
}

function hojaPorNombre(nombre) {
  const h = ss().getSheetByName(nombre);
  if (!h) {
    throw new Error(
      'No se encontró la hoja "' + nombre +
      '". Ejecuta "Instalar / Reparar sistema" desde el menú Radar.'
    );
  }
  return h;
}

function leerTabla(nombreHoja) {
  const h = hojaPorNombre(nombreHoja);
  const ultimaFila = h.getLastRow();
  const ultimaColumna = h.getLastColumn();
  if (ultimaFila < 2 || ultimaColumna < 1) return [];
  const valores = h.getRange(1, 1, ultimaFila, ultimaColumna).getValues();
  const cabeceras = valores[0];
  const filas = [];
  for (let i = 1; i < valores.length; i++) {
    const fila = valores[i];
    let vacia = true;
    for (let j = 0; j < fila.length; j++) {
      if (fila[j] !== '' && fila[j] !== null && fila[j] !== undefined) {
        vacia = false;
        break;
      }
    }
    if (vacia) continue;
    const obj = { _fila: i + 1 };
    for (let j = 0; j < cabeceras.length; j++) {
      if (cabeceras[j] !== '') obj[cabeceras[j]] = fila[j];
    }
    filas.push(obj);
  }
  return filas;
}

function generarId(prefijo, nombreHoja, indiceColumna) {
  const h = hojaPorNombre(nombreHoja);
  const ultimaFila = h.getLastRow();
  let maximo = 0;
  if (ultimaFila >= 2) {
    const ids = h.getRange(2, indiceColumna, ultimaFila - 1, 1).getValues();
    ids.forEach(function (v) {
      const m = String(v[0]).match(/(\d+)\s*$/);
      if (m) maximo = Math.max(maximo, parseInt(m[1], 10));
    });
  }
  return prefijo + String(maximo + 1).padStart(4, '0');
}

function hoy() {
  const f = new Date();
  f.setHours(0, 0, 0, 0);
  return f;
}

function aFecha(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  const texto = String(valor).trim();
  if (!texto) return null;
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]|$)/);
  if (iso) {
    return new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
  }
  const m = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  }
  const f = new Date(texto);
  return isNaN(f.getTime()) ? null : f;
}

function diasRestantes(fechaLimite) {
  const f = aFecha(fechaLimite);
  if (!f) return null;
  const limite = new Date(f.getFullYear(), f.getMonth(), f.getDate());
  return Math.round((limite.getTime() - hoy().getTime()) / 86400000);
}

function diasAlertaVencimiento() {
  return Math.max(15, Number(valorParametro('DIAS_ALERTA_VENCIMIENTO', CFG.PARAMETROS.DIAS_ALERTA_VENCIMIENTO)) || 0);
}

function diasDesde(fecha) {
  const f = aFecha(fecha);
  if (!f) return null;
  const base = new Date(f.getFullYear(), f.getMonth(), f.getDate());
  return Math.round((hoy().getTime() - base.getTime()) / 86400000);
}

function formatearFecha(valor) {
  const f = aFecha(valor);
  if (!f) return '';
  return Utilities.formatDate(f, CFG.ZONA_HORARIA, 'dd/MM/yyyy');
}

function ahoraTexto() {
  return Utilities.formatDate(new Date(), CFG.ZONA_HORARIA, 'dd/MM/yyyy HH:mm');
}

function numeroDe(valor) {
  const n = Number(valor);
  return isNaN(n) ? 0 : n;
}

var CACHE_PARAMETROS = null;

function valorParametro(nombre, defecto) {
  if (CACHE_PARAMETROS === null) {
    CACHE_PARAMETROS = {};
    leerTabla(CFG.HOJAS.CONFIG).forEach(function (f) {
      CACHE_PARAMETROS[String(f['Parámetro']).trim()] = f['Valor'];
    });
  }
  const v = CACHE_PARAMETROS[nombre];
  if (v === undefined || v === null || v === '') return defecto;
  return v;
}

function guardarParametro(nombre, valor, descripcion) {
  const h = hojaPorNombre(CFG.HOJAS.CONFIG);
  const filas = h.getDataRange().getValues();
  for (let i = 1; i < filas.length; i++) {
    if (String(filas[i][0]).trim() === nombre) {
      h.getRange(i + 1, 2).setValue(valor);
      if (descripcion) h.getRange(i + 1, 3).setValue(descripcion);
      CACHE_PARAMETROS = null;
      return;
    }
  }
  h.appendRow([nombre, valor, descripcion || '']);
  CACHE_PARAMETROS = null;
}

function letraColumna(numero) {
  let n = numero;
  let letras = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    n = Math.floor((n - 1) / 26);
  }
  return letras;
}

function indiceColumna(nombreColumna, columnas) {
  const idx = columnas.indexOf(nombreColumna);
  if (idx < 0) throw new Error('Columna no definida: ' + nombreColumna);
  return idx + 1;
}

function escribirCampos(nombreHoja, columnas, fila, campos) {
  const h = hojaPorNombre(nombreHoja);
  Object.keys(campos).forEach(function (nombre) {
    const idx = columnas.indexOf(nombre);
    if (idx < 0) throw new Error('Campo no definido en la estructura: ' + nombre);
    h.getRange(fila, idx + 1).setValue(campos[nombre]);
  });
}

function esEstadoFinal(estado) {
  return String(estado || '').trim() === CFG.ESTADOS.VERIFICADA;
}

function mostrarAviso(mensaje) {
  try {
    SpreadsheetApp.getUi().alert(CFG.NOMBRE, mensaje, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    console.log(mensaje);
  }
}

function normalizarTexto(valor) {
  return String(valor || '').trim();
}
