function carpetaCasoParaVisitas(casoId) {
  const id = normalizarTexto(casoId);
  const reg = leerTabla(CFG.HOJAS.CASOS).filter(function (c) {
    return normalizarTexto(c['ID_Caso']) === id;
  })[0];
  if (!reg) throw new Error('No existe el caso "' + id + '".');
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
  return carpeta;
}

function carpetaVisitaPorCrear(idCaso, idVisita, fecha) {
  const carpetaCaso = carpetaCasoParaVisitas(idCaso);
  const fechaTxt = Utilities.formatDate(fecha, CFG.ZONA_HORARIA, 'yyyy-MM-dd');
  const nombre = idVisita + ' ' + fechaTxt;
  const subs = carpetaCaso.getFoldersByName(nombre);
  if (subs.hasNext()) return subs.next();
  return carpetaCaso.createFolder(nombre);
}

function archivosDeCarpeta(carpeta) {
  const out = [];
  if (!carpeta) return out;
  const files = carpeta.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    out.push({
      nombre: f.getName(),
      url: f.getUrl(),
      tipo: f.getMimeType(),
      fecha: Utilities.formatDate(f.getDateCreated(), CFG.ZONA_HORARIA, 'dd/MM/yyyy')
    });
  }
  return out;
}

function contarArchivosCarpeta(carpeta) {
  let n = 0;
  const files = carpeta.getFiles();
  while (files.hasNext()) { files.next(); n++; }
  return n;
}

function listarVisitas(idCaso) {
  const id = normalizarTexto(idCaso);
  const filas = leerTabla(CFG.HOJAS.VISITAS).filter(function (v) {
    return normalizarTexto(v['ID_Caso']) === id;
  });
  filas.sort(function (a, b) {
    const fa = a['Fecha'], fb = b['Fecha'];
    return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
  });
  return filas.map(function (v) {
    let carpeta = null;
    try { if (v['Carpeta']) carpeta = DriveApp.getFolderById(String(v['Carpeta'])); } catch (e) {}
    return {
      id: normalizarTexto(v['ID_Visita']),
      idCaso: normalizarTexto(v['ID_Caso']),
      fecha: formatearFecha(v['Fecha']),
      tipo: normalizarTexto(v['Tipo']),
      profesional: normalizarTexto(v['Profesional']),
      observaciones: normalizarTexto(v['Observaciones']),
      hallazgos: normalizarTexto(v['Hallazgos']),
      acuerdos: normalizarTexto(v['Acuerdos']),
      resultado: normalizarTexto(v['Resultado']),
      carpetaUrl: carpeta ? carpeta.getUrl() : '',
      archivos: archivosDeCarpeta(carpeta)
    };
  });
}

function agregarVisita(datos, usuario) {
  const idCaso = normalizarTexto(datos.idCaso);
  const caso = leerTabla(CFG.HOJAS.CASOS).filter(function (c) {
    return normalizarTexto(c['ID_Caso']) === idCaso;
  })[0];
  if (!caso) throw new Error('No existe el caso "' + idCaso + '".');
  if (!puedeEditarCaso(usuario, caso['PROFESIONAL ASIGNADO'])) {
    throw new Error('Solo el administrador o el profesional asignado pueden agregar visitas a este caso.');
  }
  const fecha = aFecha(datos.fecha) || hoy();
  const tipo = normalizarTexto(datos.tipo) || CFG.TIPOS_VISITA[0];
  const profesional = normalizarTexto(datos.profesional) || (usuario ? usuario.nombre : '');
  const id = generarId('VS-', CFG.HOJAS.VISITAS, 1);
  const carpeta = carpetaVisitaPorCrear(idCaso, id, fecha);
  hojaPorNombre(CFG.HOJAS.VISITAS).appendRow([
    id,
    idCaso,
    fecha,
    tipo,
    profesional,
    normalizarTexto(datos.observaciones),
    normalizarTexto(datos.hallazgos),
    normalizarTexto(datos.acuerdos),
    normalizarTexto(datos.resultado),
    carpeta.getId(),
    0
  ]);
  return { id: id, carpetaId: carpeta.getId(), carpetaUrl: carpeta.getUrl() };
}

function subirArchivoVisita(idVisita, nombreArchivo, mimeType, base64, usuario) {
  const id = normalizarTexto(idVisita);
  const reg = leerTabla(CFG.HOJAS.VISITAS).filter(function (v) {
    return normalizarTexto(v['ID_Visita']) === id;
  })[0];
  if (!reg) throw new Error('No existe la visita "' + id + '".');
  const caso = leerTabla(CFG.HOJAS.CASOS).filter(function (c) {
    return normalizarTexto(c['ID_Caso']) === normalizarTexto(reg['ID_Caso']);
  })[0];
  if (caso && !puedeEditarCaso(usuario, caso['PROFESIONAL ASIGNADO'])) {
    throw new Error('No tienes permiso para subir archivos a esta visita.');
  }
  const nombre = normalizarTexto(nombreArchivo);
  if (!nombre) throw new Error('El archivo no tiene nombre.');
  if (!base64) throw new Error('El archivo está vacío.');
  const carpeta = DriveApp.getFolderById(normalizarTexto(reg['Carpeta']));
  const tipo = normalizarTexto(mimeType) || 'application/octet-stream';
  const file = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(base64), tipo, nombre));
  const total = contarArchivosCarpeta(carpeta);
  escribirCampos(CFG.HOJAS.VISITAS, COL.VISITAS, reg._fila, { 'N° archivos': total });
  return { archivo: file.getName(), url: file.getUrl(), total: total };
}
