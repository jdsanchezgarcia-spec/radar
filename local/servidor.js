/**
 * SERVIDOR LOCAL — Radar Materno
 * ============================================================================
 * Levanta el panel real (app.html + index.html) contra el backend REAL de
 * Apps Script (.gs), ejecutado aquí en Node con las hojas "en memoria".
 *
 *   node local/servidor.js      →  http://localhost:8080
 *
 * No modifica ningún archivo del proyecto: los .gs se leen tal cual.
 * Los datos viven solo en memoria (se pierden al reiniciar).
 * ============================================================================
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUERTO = Number(process.env.PORT || 8080);
const RAIZ = path.join(__dirname, '..');                 // ".../subir a git"
const DIR_GS = path.join(RAIZ, 'apps-script');
const DIR_CSV = process.env.CSV_DIR || path.join(__dirname, 'csv'); // volcado del Excel (DIANA.csv, LUCIA.csv)

// ---------------------------------------------------------------------------
// 1) STUBS DE GOOGLE APPS SCRIPT (hojas en memoria)
// ---------------------------------------------------------------------------

function colLetraANum(letra) {
  let n = 0;
  for (let i = 0; i < letra.length; i++) n = n * 26 + (letra.charCodeAt(i) - 64);
  return n;
}
function parseA1(a1) {
  // Acepta "B1", "B1:K1", "A2:A500"
  const m = String(a1).match(/^\$?([A-Za-z]+)\$?(\d+)(?::\$?([A-Za-z]+)\$?(\d+))?$/);
  if (!m) throw new Error('Rango A1 no soportado: ' + a1);
  const c1 = colLetraANum(m[1].toUpperCase()), r1 = parseInt(m[2], 10);
  const c2 = m[3] ? colLetraANum(m[3].toUpperCase()) : c1;
  const r2 = m[4] ? parseInt(m[4], 10) : r1;
  return { row: Math.min(r1, r2), col: Math.min(c1, c2), numRows: Math.abs(r2 - r1) + 1, numCols: Math.abs(c2 - c1) + 1 };
}

// Envuelve un objeto: cualquier método no definido se convierte en una función
// que retorna el propio objeto (encadenado). Sirve para no implementar a mano
// todos los métodos de formato de Sheets que el código real usa.
function tolerante(obj) {
  const proxy = new Proxy(obj, {
    get(t, prop) {
      if (typeof prop === 'symbol' || prop in t) return t[prop];
      return () => proxy; // método de formato desconocido → encadena sobre el proxy
    }
  });
  return proxy;
}

class Rango {
  constructor(hoja, row, col, numRows, numCols) {
    this.hoja = hoja; this.row = row; this.col = col;
    this.numRows = Math.max(numRows, 1); this.numCols = Math.max(numCols, 1);
  }
  _asegurar() { this.hoja._asegurar(this.row + this.numRows - 1, this.col + this.numCols - 1); }
  getValues() {
    this._asegurar();
    const out = [];
    for (let i = 0; i < this.numRows; i++) {
      const fila = [];
      for (let j = 0; j < this.numCols; j++) fila.push(this.hoja.rows[this.row - 1 + i][this.col - 1 + j]);
      out.push(fila);
    }
    return out;
  }
  setValues(matriz) {
    this._asegurar();
    for (let i = 0; i < matriz.length; i++)
      for (let j = 0; j < matriz[i].length; j++)
        this.hoja.rows[this.row - 1 + i][this.col - 1 + j] = matriz[i][j];
    return this;
  }
  getValue() { return this.getValues()[0][0]; }
  setValue(v) { this._asegurar(); this.hoja.rows[this.row - 1][this.col - 1] = v; return this; }
  clearContent() {
    this._asegurar();
    for (let i = 0; i < this.numRows; i++)
      for (let j = 0; j < this.numCols; j++) this.hoja.rows[this.row - 1 + i][this.col - 1 + j] = '';
    return this;
  }
  // Formato: no-op encadenable
  merge() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  setFontWeight() { return this; }
  setFontSize() { return this; }
  setVerticalAlignment() { return this; }
  setHorizontalAlignment() { return this; }
  setWrap() { return this; }
  setNumberFormat() { return this; }
  setBold() { return this; }
  setDataValidation() { return this; }
  setBorder() { return this; }
}

class Hoja {
  constructor(nombre) { this.nombre = nombre; this.rows = []; }
  getName() { return this.nombre; }
  _asegurar(filas, cols) {
    while (this.rows.length < filas) this.rows.push([]);
    for (let i = 0; i < this.rows.length; i++)
      while (this.rows[i].length < cols) this.rows[i].push('');
  }
  getLastRow() {
    for (let i = this.rows.length - 1; i >= 0; i--)
      if (this.rows[i].some(c => c !== '' && c !== null && c !== undefined)) return i + 1;
    return 0;
  }
  getLastColumn() {
    let max = 0;
    this.rows.forEach(f => { for (let j = 0; j < f.length; j++) if (f[j] !== '' && f[j] !== null && f[j] !== undefined) max = Math.max(max, j + 1); });
    return max;
  }
  getRange(a, b, c, d) {
    if (typeof a === 'string') { const p = parseA1(a); return tolerante(new Rango(this, p.row, p.col, p.numRows, p.numCols)); }
    if (c === undefined) return tolerante(new Rango(this, a, b, 1, 1));
    return tolerante(new Rango(this, a, b, c, d));
  }
  getDataRange() { return tolerante(new Rango(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1))); }
  appendRow(vals) { const f = this.getLastRow() + 1; this.getRange(f, 1, 1, vals.length).setValues([vals]); return this; }
  deleteRow(n) { this.rows.splice(n - 1, 1); return this; }
  clear() { this.rows = []; return this; }
  setFrozenRows() { return this; }
  setRowHeight() { return this; }
  setColumnWidth() { return this; }
  showSheet() { return this; }
  hideSheet() { return this; }
}

function crearLibro() {
  const hojas = {};
  return {
    getSheetByName(n) { return hojas[n] ? tolerante(hojas[n]) : null; },
    insertSheet(n) { const h = new Hoja(n); hojas[n] = h; return tolerante(h); },
    deleteSheet(n) { delete hojas[n]; },
    getSheets() { return Object.values(hojas).map(tolerante); },
    getId() { return 'LIBRO_LOCAL'; },
    toast() {},
    getUi() { return UI; }
  };
}

const UI = {
  alert() {}, prompt() { return { getSelectedButton: () => null, getResponseText: () => '' }; },
  Button: { OK: 'OK', CANCEL: 'CANCEL' },
  ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL' },
  showSidebar() {}
};

function cadena() {
  // Cualquier método encadena; solo build() devuelve el objeto final.
  const o = { build() { return {}; } };
  const proxy = new Proxy(o, {
    get(t, prop) {
      if (prop === 'build') return t.build;
      return () => proxy;
    }
  });
  return proxy;
}
function regla() {
  const o = { build() { return {}; } };
  const proxy = new Proxy(o, {
    get(t, prop) {
      if (prop === 'build') return t.build;
      return () => proxy;
    }
  });
  return proxy;
}

let _LIBRO = crearLibro();
const _props = new Map();
const _cache = new Map();

function fechaFormateada(d, zona, fmt) {
  if (!(d instanceof Date)) d = new Date(d);
  const p = new Intl.DateTimeFormat('es-CO', {
    timeZone: zona || 'America/Bogota', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
  return fmt.replace(/yyyy/g, p.year).replace(/MM/g, p.month).replace(/dd/g, p.day)
            .replace(/HH/g, p.hour === '24' ? '00' : p.hour).replace(/mm/g, p.minute).replace(/ss/g, p.second);
}

const STUBS = `
  var SpreadsheetApp = {
    getActiveSpreadsheet: function(){ return LIBRO; },
    getUi: function(){ return UI; },
    newDataValidation: function(){ return cadena(); },
    newConditionalFormatRule: function(){ return regla(); },
    flush: function(){},
    BorderStyle: { SOLID: 'SOLID', DOTTED: 'DOTTED', DASHED: 'DASHED' }
  };
  var PropertiesService = { getScriptProperties: function(){ return {
    getProperty: function(k){ return PROPS.has(k) ? PROPS.get(k) : null; },
    setProperty: function(k,v){ PROPS.set(k, String(v)); },
    deleteProperty: function(k){ PROPS.delete(k); }
  }; } };
  var CacheService = { getScriptCache: function(){ return {
    put: function(k,v){ CACHE.set(k, String(v)); },
    get: function(k){ return CACHE.has(k) ? CACHE.get(k) : null; },
    remove: function(k){ CACHE.delete(k); }
  }; } };
  var Utilities = {
    formatDate: function(d, zona, fmt){ return fechaFormateada(d, zona, fmt); },
    getUuid: function(){ return crypto.randomUUID(); },
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest: function(algo, texto){
      return Array.from(crypto.createHash('sha256').update(String(texto), 'utf8').digest());
    },
    base64Decode: function(b){ return Array.from(Buffer.from(String(b), 'base64')); },
    newBlob: function(bytes, tipo, nombre){ return { _b: bytes, getContentType: function(){ return tipo; }, getName: function(){ return nombre; } }; }
  };
  var Session = {
    getScriptTimeZone: function(){ return 'America/Bogota'; },
    getEffectiveUser: function(){ return { getEmail: function(){ return ''; } }; },
    getActiveUser: function(){ return { getEmail: function(){ return ''; } }; }
  };
  var LockService = { getScriptLock: function(){ return { tryLock: function(){ return true; }, releaseLock: function(){} }; } };
  var ScriptApp = { getProjectTriggers: function(){ return []; }, newTrigger: function(){ return { forSpreadsheet: function(){ return this; }, onEdit: function(){ return this; }, timeBased: function(){ return this; }, atHour: function(){ return this; }, everyDays: function(){ return this; }, create: function(){} }; } };
  var MailApp = { sendEmail: function(){} };
  var DriveApp = {
    getFoldersByName: function(){ return []; },
    getFolderById: function(){ return { getId: function(){ return 'DRIVE'; }, getName: function(){ return 'Drive (no disponible en local)'; }, getUrl: function(){ return '#'; }, getFiles: function(){ return { hasNext: function(){ return false; } }; }, getFolders: function(){ return { hasNext: function(){ return false; } }; } }; },
    createFolder: function(n){ return { getId: function(){ return 'DRIVE_NUEVA'; }, getName: function(){ return n; }, getUrl: function(){ return '#'; } }; }
  };
  var HtmlService = { createHtmlOutputFromFile: function(){ return { setTitle: function(){ return this; }, addMetaTag: function(){ return this; } }; } };
  var Charts = { ChartType: { PIE: 'PIE', COLUMN: 'COLUMN', BAR: 'BAR', LINE: 'LINE' } };
  var Logger = { log: function(){} };
`;

// ---------------------------------------------------------------------------
// 2) CARGA DE LOS .gs REALES EN UN SANDBOX ÚNICO
// ---------------------------------------------------------------------------

function cargarBackend() {
  const orden = ['Config.gs', 'Utils.gs', 'Setup.gs', 'Auth.gs', 'Catalogos.gs', 'Casos.gs',
    'Eventos.gs', 'Planes.gs', 'Estados.gs', 'Alertas.gs', 'Tablero.gs', 'Visitas.gs',
    'Documentacion.gs', 'Evidencias.gs', 'Notificaciones.gs', 'Menu.gs', 'DatosReales.gs',
    'Seguimientos.gs', 'Usuarios.gs', 'Panel.gs'];
  let src = orden.map(f => fs.readFileSync(path.join(DIR_GS, f), 'utf8')).join('\n\n');

  // La siembra se define DENTRO del sandbox para tener acceso a todo.
  const seed = `
    function __siembrar(diana, lucia) {
      // a) Instala el sistema real (crea hojas, carga CASOS_REALES, tablero...)
      instalarSistema();

      // b) Hoja Usuarios (no la crea instalarSistema)
      var hu = ss().getSheetByName(CFG.HOJAS.USUARIOS);
      if (!hu) hu = ss().insertSheet(CFG.HOJAS.USUARIOS);
      if (hu.getLastRow() < 1) hu.getRange(1, 1, 1, COL.USUARIOS.length).setValues([COL.USUARIOS.slice()]);

      function nuevoUsuario(email, nombre, rol, clave) {
        hu.appendRow([email, nombre, rol, 'Sí', new Date(), '', '']);
        var reg = usuarioPorEmail(email);
        guardarClave(reg, clave);
      }
      nuevoUsuario('admin@radar.local', 'ADMINISTRADOR', CFG.ROLES.ADMIN, 'radar123');
      nuevoUsuario('lucia@radar.local', 'LUCIA MORA', CFG.ROLES.PROFESIONAL, 'radar123');
      nuevoUsuario('diana@radar.local', 'DIANA ROJAS', CFG.ROLES.PROFESIONAL, 'radar123');
      nuevoUsuario('visita@radar.local', 'VISITA DE CAMPO', CFG.ROLES.VISITA, 'radar123');

      // c) Importa el Excel real (una hoja por profesional, como el usuario real)
      var hi = ss().getSheetByName(CFG.HOJAS.IMPORTAR);
      [[diana, 'DIANA ROJAS'], [lucia, 'LUCIA MORA']].forEach(function (par) {
        var filas = par[0], prof = par[1];
        if (!filas.length) return;
        hi.clear();
        hi.getRange(1, 1, filas.length, filas[0].length).setValues(filas);
        importarSeguimientos(prof);
      });

      // d) Fuerza la asignación de IDs (SG-xxxx) y vínculos en la hoja
      listaSeguimientos();
      return {
        casos: leerTabla(CFG.HOJAS.CASOS).length,
        seguimientos: leerTabla(CFG.HOJAS.SEGUIMIENTOS).length
      };
    }
  `;

  const cuerpo = STUBS + '\n' + src + '\n' + seed + '\n' +
    'return { apiLeer: apiLeer, apiEjecutar: apiEjecutar, siembrar: __siembrar, COL: COL };';

  return new Function('LIBRO', 'UI', 'PROPS', 'CACHE', 'cadena', 'regla', 'fechaFormateada', 'crypto', cuerpo);
}

// ---------------------------------------------------------------------------
// 3) LECTURA DEL EXCEL (volcado CSV) — DIANA en cp1252, LUCIA en utf8
// ---------------------------------------------------------------------------

function parseCSV(texto) {
  const filas = []; let fila = [], campo = '', dentro = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (dentro) {
      if (ch === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else dentro = false; }
      else campo += ch;
    } else if (ch === '"') dentro = true;
    else if (ch === ',') { fila.push(campo); campo = ''; }
    else if (ch === '\n') { fila.push(campo.replace(/\r$/, '')); filas.push(fila); fila = []; campo = ''; }
    else campo += ch;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}
function leerExcel(archivo) {
  const ruta = path.join(DIR_CSV, archivo);
  if (!fs.existsSync(ruta)) { console.warn('  (no encontré ' + archivo + ', se omite)'); return []; }
  const buf = fs.readFileSync(ruta);
  // Autodetección: si al leer como UTF-8 aparece mojibake (Ã, Â, â€”) el
  // archivo era cp1252/ANSI y se relee como latin1. Si no, era UTF-8.
  const utf8 = buf.toString('utf8');
  const texto = /Ã|Â|â€/.test(utf8) ? buf.toString('latin1') : utf8;
  return parseCSV(texto);
}

// ---------------------------------------------------------------------------
// 4) ARRANQUE
// ---------------------------------------------------------------------------

function arrancar() {
  console.log('Cargando backend (.gs)…');
  const crear = cargarBackend();
  const LIBRO = crearLibro();
  const api = crear(LIBRO, UI, _props, _cache, cadena, regla, fechaFormateada, crypto);

  console.log('Sembrando datos (19 casos reales + 47 compromisos del Excel)…');
  const diana = leerExcel('DIANA.csv');
  const lucia = leerExcel('LUCIA.csv');
  let riego;
  try {
    riego = api.siembrar(diana, lucia);
  } catch (e) {
    console.error('Falló la siembra:', e && e.stack || e);
    process.exit(1);
  }
  console.log('  Casos: ' + riego.casos + ' · Compromisos de seguimiento: ' + riego.seguimientos);

  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' };

  function servirHTML(resp, archivo) {
    let html = fs.readFileSync(path.join(RAIZ, archivo), 'utf8');
    // Reescribe la URL de la API para que apunte al servidor local.
    html = html.replace(/var API = 'https:\/\/script\.google\.com[^']*';/, "var API = '/api';");
    html = html.replace(/var APP_URL = 'https:\/\/script\.google\.com[^']*';/, "var APP_URL = '/api';");
    resp.writeHead(200, { 'Content-Type': MIME['.html'] });
    resp.end(html);
  }

  function jsonResp(resp, obj) {
    resp.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    resp.end(JSON.stringify(obj));
  }

  const servidor = http.createServer((req, resp) => {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/api') {
      if (req.method === 'GET') {
        const p = {}; u.searchParams.forEach((v, k) => p[k] = v);
        try { jsonResp(resp, api.apiLeer(p.accion || p.action, p)); }
        catch (e) { jsonResp(resp, { error: e.message || String(e) }); }
        return;
      }
      if (req.method === 'POST') {
        let raw = '';
        req.on('data', c => raw += c);
        req.on('end', () => {
          let body = {};
          try { body = JSON.parse(raw || '{}'); } catch (e) { return jsonResp(resp, { ok: false, mensaje: 'JSON inválido.' }); }
          try { jsonResp(resp, api.apiEjecutar(body)); }
          catch (e) { jsonResp(resp, { ok: false, error: e.message || String(e), mensaje: e.message || String(e) }); }
        });
        return;
      }
    }
    if (u.pathname === '/' || u.pathname === '/index.html') return servirHTML(resp, 'index.html');
    if (u.pathname === '/app.html') return servirHTML(resp, 'app.html');
    resp.writeHead(404); resp.end('No encontrado');
  });

  servidor.listen(PUERTO, () => {
    console.log('\n  Radar corriendo en local →  http://localhost:' + PUERTO);
    console.log('  Usuarios de prueba (contraseña: radar123)');
    console.log('    admin@radar.local   · Admin');
    console.log('    lucia@radar.local   · Profesional');
    console.log('    diana@radar.local   · Profesional');
    console.log('    visita@radar.local  · Visita (solo lectura)');
    console.log('\n  (Ctrl+C para detener; los datos viven solo en memoria)\n');
  });
}

arrancar();
