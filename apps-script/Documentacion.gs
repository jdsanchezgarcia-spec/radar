var RUIDO_NOMBRE = ['PM', 'PA', 'PS', 'HIJO', 'HIJA', 'H', 'M', 'DE', 'DEL', 'CC', 'CI', 'CS', 'NO', 'ANT', 'FALLECIDO', 'FALLECIDA', 'ORE'];

function tokensSignificativos(s) {
  return String(s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-./]+/g, ' ')
    .split(/\s+/)
    .filter(function (t) {
      if (!t) return false;
      if (/\d/.test(t)) return false;
      if (RUIDO_NOMBRE.indexOf(t) >= 0) return false;
      if (t.length < 2) return false;
      return true;
    });
}

function puntuarCarpeta(nombreCaso, nombreCarpeta) {
  const ta = tokensSignificativos(nombreCaso);
  const tb = tokensSignificativos(nombreCarpeta);
  if (!ta.length || !tb.length) return 0;
  let comunes = 0;
  ta.forEach(function (t) { if (tb.indexOf(t) >= 0) comunes++; });
  if (comunes < 2) return 0;
  const menor = Math.min(ta.length, tb.length);
  if (comunes / menor >= 0.5) return comunes;
  return 0;
}

function listarArchivosCarpeta(carpeta) {
  const archivos = [];
  const files = carpeta.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    archivos.push({
      nombre: f.getName(),
      url: f.getUrl(),
      tipo: f.getMimeType(),
      fecha: f.getLastUpdated() ? Utilities.formatDate(f.getLastUpdated(), Session.getScriptTimeZone(), 'dd/MM/yyyy') : ''
    });
  }
  const subs = carpeta.getFolders();
  while (subs.hasNext()) {
    const sub = subs.next();
    const sfiles = sub.getFiles();
    while (sfiles.hasNext()) {
      const f = sfiles.next();
      archivos.push({
        nombre: sub.getName() + ' / ' + f.getName(),
        url: f.getUrl(),
        tipo: f.getMimeType(),
        fecha: f.getLastUpdated() ? Utilities.formatDate(f.getLastUpdated(), Session.getScriptTimeZone(), 'dd/MM/yyyy') : ''
      });
    }
  }
  archivos.sort(function (x, y) { return x.nombre.localeCompare(y.nombre); });
  return archivos;
}

function documentacionCaso(idCaso) {
  const id = normalizarTexto(idCaso);
  const reg = leerTabla(CFG.HOJAS.CASOS).filter(function (c) {
    return normalizarTexto(c['ID_Caso']) === id;
  })[0];
  if (!reg) throw new Error('No existe el caso "' + id + '".');

  const nombreCaso = normalizarTexto(reg['CASO']);
  const raizId = valorParametro('ID_CARPETA_RAIZ', '');
  if (!raizId) throw new Error('No está configurada la carpeta de documentación (ID_CARPETA_RAIZ).');

  let raiz;
  try {
    raiz = DriveApp.getFolderById(raizId);
  } catch (e) {
    throw new Error('No se pudo abrir la carpeta de documentación en Drive: ' + e.message);
  }

  const candidatas = [];
  let mejor = null;
  let mejorPts = 0;
  const carpetas = raiz.getFolders();
  while (carpetas.hasNext()) {
    const f = carpetas.next();
    const pts = puntuarCarpeta(nombreCaso, f.getName());
    candidatas.push({ id: f.getId(), nombre: f.getName(), url: f.getUrl(), pts: pts });
    if (pts > mejorPts) { mejorPts = pts; mejor = f; }
  }
  candidatas.sort(function (x, y) { return y.pts - x.pts; });

  const respuesta = {
    caso: { id: id, nombre: nombreCaso },
    raiz: { id: raiz.getId(), nombre: raiz.getName(), url: raiz.getUrl() },
    carpeta: null,
    archivos: [],
    candidatas: candidatas.slice(0, 10).map(function (c) { return { nombre: c.nombre, url: c.url }; })
  };

  if (mejor && mejorPts >= 2) {
    respuesta.carpeta = { id: mejor.getId(), nombre: mejor.getName(), url: mejor.getUrl() };
    respuesta.archivos = listarArchivosCarpeta(mejor);
  }
  return respuesta;
}

function subirArchivoACaso(casoId, nombre, mimeType, base64) {
  const id = normalizarTexto(casoId);
  const reg = leerTabla(CFG.HOJAS.CASOS).filter(function (c) {
    return normalizarTexto(c['ID_Caso']) === id;
  })[0];
  if (!reg) throw new Error('No existe el caso "' + id + '".');
  if (!nombre) throw new Error('Falta el nombre del archivo.');

  const raizId = valorParametro('ID_CARPETA_RAIZ', '');
  if (!raizId) throw new Error('No está configurada la carpeta de documentación.');
  const raiz = DriveApp.getFolderById(raizId);

  const nombreCaso = normalizarTexto(reg['CASO']);
  let carpeta = null;
  let mejorPts = 0;
  const carpetas = raiz.getFolders();
  while (carpetas.hasNext()) {
    const f = carpetas.next();
    const pts = puntuarCarpeta(nombreCaso, f.getName());
    if (pts >= 2 && pts > mejorPts) { mejorPts = pts; carpeta = f; }
  }
  if (!carpeta) carpeta = raiz.createFolder(nombreCaso || id);

  const bytes = Utilities.base64Decode(base64 || '');
  const blob = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', nombre);
  const file = carpeta.createFile(blob);
  return { archivo: file.getName(), url: file.getUrl(), carpeta: carpeta.getName() };
}
