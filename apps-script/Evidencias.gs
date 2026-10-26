function obtenerCarpetaRaiz() {
  const id = normalizarTexto(valorParametro('ID_CARPETA_RAIZ', ''));
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {
      console.log('La carpeta raíz configurada no existe; se creará una nueva.');
    }
  }
  const carpetas = DriveApp.getFoldersByName(CFG.CARPETA_EVIDENCIAS);
  if (carpetas.hasNext()) {
    const carpeta = carpetas.next();
    guardarParametro('ID_CARPETA_RAIZ', carpeta.getId(), 'Carpeta raíz de evidencias en Drive');
    return carpeta;
  }
  const nueva = DriveApp.createFolder(CFG.CARPETA_EVIDENCIAS);
  guardarParametro('ID_CARPETA_RAIZ', nueva.getId(), 'Carpeta raíz de evidencias en Drive');
  return nueva;
}

function subcarpetaDe(parent, nombre) {
  const limpio = normalizarTexto(nombre) || 'Sin institución';
  const carpetas = parent.getFoldersByName(limpio);
  if (carpetas.hasNext()) return carpetas.next();
  return parent.createFolder(limpio);
}

function carpetaDeAccion(idAccion, institucion) {
  const raiz = obtenerCarpetaRaiz();
  const carpetaInstitucion = subcarpetaDe(raiz, institucion || 'Sin institución');
  return subcarpetaDe(carpetaInstitucion, idAccion);
}

function obtenerCarpetaAccion(idAccion) {
  const reg = buscarAccion(idAccion);
  if (!reg) throw new Error('No existe la acción "' + idAccion + '".');
  return carpetaDeAccion(
    normalizarTexto(reg['ID_Acción']),
    normalizarTexto(reg['Institución responsable'])
  );
}

function contarEvidencias(idAccion) {
  let total = 0;
  try {
    const carpeta = obtenerCarpetaAccion(idAccion);
    const archivos = carpeta.getFiles();
    while (archivos.hasNext()) {
      archivos.next();
      total++;
    }
  } catch (e) {
    console.log('Sin carpeta de evidencias para ' + idAccion);
  }
  const id = normalizarTexto(idAccion);
  const registros = leerTabla(CFG.HOJAS.VERIFICACIONES);
  registros.forEach(function (r) {
    if (normalizarTexto(r['ID_Acción']) === id && normalizarTexto(r['Verificador']) === 'Enlace manual') {
      total++;
    }
  });
  return total;
}

function sincronizarEvidencias(idAccion) {
  const reg = buscarAccion(idAccion);
  if (!reg) throw new Error('No existe la acción "' + idAccion + '".');
  const carpeta = obtenerCarpetaAccion(idAccion);
  const total = contarEvidencias(idAccion);
  escribirCampos(CFG.HOJAS.PLANES, COL.PLANES, reg._fila, {
    'Carpeta de evidencias': carpeta.getUrl(),
    'N° evidencias': total,
    'Última actualización': new Date()
  });
  return { total: total, url: carpeta.getUrl() };
}

function subirEvidencia(idAccion, nombreArchivo, mimeType, base64) {
  const reg = buscarAccion(idAccion);
  if (!reg) throw new Error('No existe la acción "' + idAccion + '".');
  const nombre = normalizarTexto(nombreArchivo);
  if (!nombre) throw new Error('El archivo no tiene nombre.');
  if (!base64) throw new Error('El archivo está vacío.');

  const permitidos = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel',
    'text/plain',
    'text/csv'
  ];
  const tipo = normalizarTexto(mimeType) || 'application/octet-stream';
  if (permitidos.indexOf(tipo) < 0) {
    throw new Error(
      'Tipo de archivo no permitido (' + tipo + '). ' +
      'Admitidos: PDF, imágenes (JPG/PNG), Word, Excel, TXT y CSV.'
    );
  }

  const carpeta = obtenerCarpetaAccion(idAccion);
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, tipo, nombre);
  const archivo = carpeta.createFile(blob);
  const sincronizado = sincronizarEvidencias(idAccion);
  return {
    archivo: archivo.getName(),
    url: archivo.getUrl(),
    carpeta: sincronizado.url,
    total: sincronizado.total
  };
}

function vincularEvidenciaExterna(idAccion, url) {
  const reg = buscarAccion(idAccion);
  if (!reg) throw new Error('No existe la acción "' + idAccion + '".');
  const enlace = normalizarTexto(url);
  if (!enlace) throw new Error('Debes pegar el enlace de la evidencia.');
  const carpeta = obtenerCarpetaAccion(idAccion);
  const h = hojaPorNombre(CFG.HOJAS.VERIFICACIONES);
  h.appendRow([new Date(), idAccion, 'Enlace manual', 'Evidencia vinculada', '', '', enlace]);
  const sincronizado = sincronizarEvidencias(idAccion);
  return 'Enlace registrado para ' + idAccion + '. Total de evidencias: ' + sincronizado.total;
}
