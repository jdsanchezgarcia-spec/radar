function jsonResp(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function apiLeer(accion, p) {
  const sesion = (p && p.sesion) || '';
  const usuario = usuarioDeSesion(sesion);
  if (accion === 'datos' || accion === 'panel') {
    exigirRol(usuario, [CFG.ROLES.ADMIN, CFG.ROLES.PROFESIONAL, CFG.ROLES.VISITA]);
    asegurarCatalogos(); // crea la hoja Catálogos en la primera carga si no existe
    try {
      return panelDatos(sesion);
    } catch (err) {
      // Si falta alguna hoja del sistema (p. ej. nunca se instaló),
      // intenta instalar/reparar una vez y vuelve a cargar.
      if (String((err && err.message) || err).indexOf('No se encontró la hoja') === 0) {
        asegurarInstalacion();
        return panelDatos(sesion);
      }
      throw err;
    }
  }
  if (accion === 'appconfig') return { login: 'usuario-clave' };
  if (accion === 'documentacion') {
    const id = normalizarTexto((p && (p.id || p.caso)) || '');
    exigirAccesoCaso(usuario, id);
    return documentacionCaso(id);
  }
  if (accion === 'visitas') {
    const id = normalizarTexto((p && (p.id || p.caso)) || '');
    exigirAccesoCaso(usuario, id);
    return { ok: true, visitas: listarVisitas(id) };
  }
  if (accion === 'usuarios') {
    exigirRol(usuario, [CFG.ROLES.ADMIN]);
    return { ok: true, usuarios: listaUsuarios() };
  }
  return { error: 'Acción de lectura desconocida: ' + accion };
}

function asegurarInstalacion() {
  try {
    const lock = LockService.getScriptLock();
    const obtenido = lock.tryLock(10000);
    if (!obtenido) return;
    try {
      const version = PropertiesService.getScriptProperties().getProperty('INSTALACION_VERSION');
      let hojaConfig = false;
      try {
        hojaConfig = !!ss().getSheetByName(CFG.HOJAS.CONFIG);
      } catch (e) {
        hojaConfig = false;
      }
      if (version !== VERSION_INSTALACION || !hojaConfig) instalarSistema();
      asegurarColumnaEstado();
      asegurarHojasNuevas();
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    console.log('Auto-instalación no completada: ' + e.message);
  }
}

function asegurarHojasNuevas() {
  crearHoja(CFG.HOJAS.USUARIOS, COL.USUARIOS, [240, 180, 110, 80, 130, 140, 420]);
  crearHoja(CFG.HOJAS.VISITAS, COL.VISITAS, [95, 90, 100, 120, 160, 300, 260, 240, 160, 150, 90]);
  asegurarCatalogos();
  const hu = hojaPorNombre(CFG.HOJAS.USUARIOS);
  if (hu.getLastRow() < 2) {
    let email = '';
    try { email = Session.getEffectiveUser().getEmail(); } catch (e) {}
    if (email) hu.appendRow([String(email).toLowerCase(), 'Administrador', CFG.ROLES.ADMIN, 'Sí', new Date()]);
  }
}

function asegurarColumnaEstado() {
  const h = hojaPorNombre(CFG.HOJAS.CASOS);
  if (!h) return;
  const col = COL.CASOS.indexOf('ESTADO SEGUIMIENTO') + 1;
  const cab = h.getLastColumn() >= col ? h.getRange(1, col).getValue() : '';
  if (normalizarTexto(cab) !== 'ESTADO SEGUIMIENTO') {
    h.getRange(1, col).setValue('ESTADO SEGUIMIENTO');
  }
}

function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const accion = p.accion || p.action;
  if (accion) {
    try {
      return jsonResp(apiLeer(accion, p));
    } catch (err) {
      return jsonResp({ error: err.message || String(err) });
    }
  }
  asegurarInstalacion();
  return HtmlService.createHtmlOutputFromFile('IndexWeb')
    .setTitle('Radar')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return jsonResp({ ok: false, mensaje: 'JSON inválido.' });
  }
  return jsonResp(apiEjecutar(body));
}

function exigirRolAccion(usuario, idAccion) {
  if (!usuario) throw new Error('Debes iniciar sesión.');
  if (canonizarRol(usuario.rol) === CFG.ROLES.ADMIN) return;
  const reg = buscarAccion(idAccion);
  if (!reg) throw new Error('No existe la acción "' + idAccion + '".');
  const responsable = String(reg['Responsable asignado'] || '').trim().toLowerCase();
  const yo = String(usuario.nombre || '').trim().toLowerCase();
  if (!responsable || responsable !== yo) {
    throw new Error('Solo el responsable de la acción o un administrador pueden modificarla.');
  }
}

function apiEjecutar(body) {
  const accion = body.accion;
  const datos = body.datos || {};
  const usuario = usuarioDeSesion(body.sesion || datos.sesion || '');
  // El rol Visita es de solo lectura: solo puede entrar, salir y cambiar su propia clave.
  if (esVisita(usuario) && ['login', 'registro', 'logout', 'cambiarClave'].indexOf(accion) < 0) {
    throw new Error('Tu rol Visita es de solo lectura: no puedes modificar información.');
  }
  try {
    if (accion === 'login') {
      const r = loginUsuarioClave(Object.assign({}, body, datos));
      return { ok: true, token: r.token, email: r.email, nombre: r.nombre, rol: r.rol };
    }
    if (accion === 'registro') {
      return { ok: true, mensaje: registroPublico(Object.assign({}, body, datos)) };
    }
    if (accion === 'logout') {
      cerrarSesion(body.sesion || datos.sesion || '');
      return { ok: true, mensaje: 'Sesión cerrada.' };
    }
    if (accion === 'nuevoCaso') {
      exigirRol(usuario, [CFG.ROLES.ADMIN]);
      const id = registrarCaso(datos);
      generarHojaAlertas();
      construirTablero();
      return { ok: true, id: id, mensaje: 'Caso ' + id + ' creado.' };
    }
    if (accion === 'nuevoEvento') {
      exigirRol(usuario, [CFG.ROLES.ADMIN]);
      const id = panelNuevoEvento(datos);
      return { ok: true, id: id, mensaje: 'Evento ' + id + ' registrado.' };
    }
    if (accion === 'nuevaAccion') {
      exigirRol(usuario, [CFG.ROLES.ADMIN]);
      const id = panelNuevaAccion(datos);
      return { ok: true, id: id, mensaje: 'Acción ' + id + ' registrada.' };
    }
    if (accion === 'editarSeguimiento') {
      const id = normalizarTexto(datos.id);
      const casoReg = leerTabla(CFG.HOJAS.CASOS).filter(function (c) { return normalizarTexto(c['ID_Caso']) === id; })[0];
      if (!casoReg) throw new Error('No existe el caso "' + id + '".');
      if (!puedeEditarCaso(usuario, casoReg['PROFESIONAL ASIGNADO'])) throw new Error('No tienes permiso para editar este caso.');
      const rid = editarSeguimientoCaso(datos);
      generarHojaAlertas();
      construirTablero();
      return { ok: true, id: rid, mensaje: 'Caso ' + rid + ' actualizado.' };
    }
    if (accion === 'eliminarCaso') {
      exigirRol(usuario, [CFG.ROLES.ADMIN]);
      const id = eliminarCaso(body.id || datos.id || '');
      generarHojaAlertas();
      construirTablero();
      return { ok: true, id: id, mensaje: 'Caso ' + id + ' eliminado.' };
    }
    if (accion === 'subirArchivo') {
      const casoId = body.casoId || datos.casoId;
      const casoReg = leerTabla(CFG.HOJAS.CASOS).filter(function (c) { return normalizarTexto(c['ID_Caso']) === normalizarTexto(casoId); })[0];
      if (casoReg && !puedeEditarCaso(usuario, casoReg['PROFESIONAL ASIGNADO'])) throw new Error('No tienes permiso para subir archivos a este caso.');
      const res = subirArchivoACaso(casoId, body.nombre || datos.nombre, body.mimeType || datos.mimeType, body.base64 || datos.base64);
      return { ok: true, mensaje: 'Archivo "' + res.archivo + '" subido a ' + res.carpeta + '.', datos: res };
    }
    if (accion === 'asignarProfesional') {
      const m = asignarProfesional(datos, usuario);
      return { ok: true, mensaje: m };
    }
    if (accion === 'agregarVisita') {
      const r = agregarVisita(datos, usuario);
      return { ok: true, id: r.id, mensaje: 'Visita ' + r.id + ' registrada.', datos: r };
    }
    if (accion === 'subirArchivoVisita') {
      const r = subirArchivoVisita(body.idVisita || datos.idVisita, body.nombre || datos.nombre, body.mimeType || datos.mimeType, body.base64 || datos.base64, usuario);
      return { ok: true, mensaje: 'Archivo "' + r.archivo + '" subido.', datos: r };
    }
    if (accion === 'agregarUsuario') {
      return { ok: true, mensaje: agregarUsuario(datos, usuario) };
    }
    if (accion === 'actualizarUsuario') {
      return { ok: true, mensaje: actualizarUsuario(datos, usuario) };
    }
    if (accion === 'eliminarUsuario') {
      return { ok: true, mensaje: eliminarUsuario(body.email || datos.email, usuario) };
    }
    if (accion === 'cambiarClave') {
      return { ok: true, mensaje: cambiarClaveUsuario(datos, usuario) };
    }
    if (accion === 'subirEvidenciaAccion') {
      const idA = body.idAccion || datos.idAccion;
      exigirRolAccion(usuario, idA);
      const r = subirEvidencia(idA, body.nombre || datos.nombre, body.mimeType || datos.mimeType, body.base64 || datos.base64);
      return { ok: true, mensaje: 'Evidencia "' + r.archivo + '" subida. Total: ' + r.total, datos: r };
    }
    if (accion === 'sincronizarEvidenciasAccion') {
      const idA = body.idAccion || datos.idAccion;
      exigirRolAccion(usuario, idA);
      const r = sincronizarEvidencias(idA);
      return { ok: true, mensaje: 'Evidencias sincronizadas: ' + r.total, datos: r };
    }
    if (accion === 'cambiarEstadoAccion') {
      const idA = body.idAccion || datos.idAccion;
      const nuevo = normalizarTexto(body.estado || datos.estado);
      const esVerificacion = nuevo === CFG.ESTADOS.VERIFICADA || nuevo === CFG.ESTADOS.RECHAZADA;
      if (esVerificacion) exigirRol(usuario, [CFG.ROLES.ADMIN]);
      else exigirRolAccion(usuario, idA);
      const detalle = datos.detalle || body.detalle || {};
      if (usuario && !normalizarTexto(detalle.verificador)) detalle.verificador = usuario.nombre;
      const m = panelCambiarEstado(idA, nuevo, detalle);
      return { ok: true, mensaje: 'Acción ' + m };
    }
    if (accion === 'notificarVencidos') {
      exigirRol(usuario, [CFG.ROLES.ADMIN]);
      return { ok: true, mensaje: notificarVencidos() };
    }
    return { ok: false, mensaje: 'Acción desconocida: ' + accion };
  } catch (err) {
    return { ok: false, mensaje: err.message || String(err) };
  }
}

function abrirPanel() {
  const html = HtmlService.createHtmlOutputFromFile('PanelUI')
    .setTitle('Radar')
    .setWidth(470);
  SpreadsheetApp.getUi().showSidebar(html);
}

function panelDatos(sesion) {
  const acciones = leerTabla(CFG.HOJAS.PLANES);
  const kpi = calcularKpis(acciones);
  const lista = [];

  acciones.forEach(function (r) {
    const alerta = clasificarAlerta(r);
    const dias = diasRestantes(r['Fecha límite']);
    lista.push({
      id: normalizarTexto(r['ID_Acción']),
      evento: normalizarTexto(r['ID_Evento']),
      institucion: normalizarTexto(r['Institución responsable']),
      responsable: normalizarTexto(r['Responsable asignado']),
      hallazgo: normalizarTexto(r['Hallazgo identificado']),
      accion: normalizarTexto(r['Acción propuesta']),
      indicador: normalizarTexto(r['Indicador / evidencia esperada']),
      fechaLimite: formatearFecha(r['Fecha límite']),
      dias: dias,
      prioridad: normalizarTexto(r['Prioridad']),
      estado: normalizarTexto(r['Estado']),
      avance: numeroDe(r['% Avance']),
      evidencias: numeroDe(r['N° evidencias']),
      carpeta: normalizarTexto(r['Carpeta de evidencias']),
      fechaReporte: formatearFecha(r['Fecha reporte']),
      verificador: normalizarTexto(r['Verificador']),
      observaciones: normalizarTexto(r['Observaciones de verificación']),
      alerta: alerta ? alerta.nivel : '',
      detalleAlerta: alerta ? alerta.detalle : ''
    });
  });

  const ordenAlerta = {};
  CFG.NIVELES_ALERTA.forEach(function (n, i) {
    ordenAlerta[n] = i;
  });
  lista.sort(function (a, b) {
    const oa = a.alerta ? ordenAlerta[a.alerta] : 99;
    const ob = b.alerta ? ordenAlerta[b.alerta] : 99;
    if (oa !== ob) return oa - ob;
    const da = a.dias === null ? 99999 : a.dias;
    const db = b.dias === null ? 99999 : b.dias;
    return da - db;
  });

  const eventos = leerTabla(CFG.HOJAS.EVENTOS).map(function (e) {
    return {
      id: normalizarTexto(e['ID_Evento']),
      institucion: normalizarTexto(e['Institución']),
      resumen: normalizarTexto(e['Resumen del evento'])
    };
  });

  const usuario = usuarioDeSesion(sesion);
  // Todos los roles (Admin, Profesional y Visita) ven todos los casos;
  // la edición se restringe por rol en cada acción.
  const casos = listaCasos();

  return {
    kpi: kpi,
    acciones: lista,
    eventos: eventos,
    casos: casos,
    kpiCasos: kpiDesdeLista(casos),
    semanasVencimiento: semanasVencimiento(),
    estados: [CFG.ESTADOS.PENDIENTE, CFG.ESTADOS.EJECUCION, CFG.ESTADOS.REPORTADA, CFG.ESTADOS.VERIFICADA, CFG.ESTADOS.RECHAZADA],
    estadosCaso: CFG.ESTADOS_CASO,
    ipsPais: COL.IPS_PAIS,
    catalogos: leerCatalogo(),
    tiposVisita: CFG.TIPOS_VISITA,
    profesionales: profesionales(),
    usuario: usuario,
    fecha: ahoraTexto()
  };
}

function panelNuevoCaso(datos) {
  const id = registrarCaso(datos);
  generarHojaAlertas();
  construirTablero();
  return { ok: true, mensaje: 'Caso ' + id + ' asignado.', id };
}

function panelSeguimientoCaso(datos) {
  const id = editarSeguimientoCaso(datos);
  generarHojaAlertas();
  construirTablero();
  return { ok: true, mensaje: 'Caso ' + id + ' actualizado.', id };
}

function panelEliminarCaso(id) {
  const resultado = eliminarCaso(id);
  generarHojaAlertas();
  construirTablero();
  return { ok: true, mensaje: 'Caso ' + resultado + ' eliminado.' };
}

function panelNuevaAccion(datos) {
  const id = registrarAccion(datos);
  generarHojaAlertas();
  construirTablero();
  return { ok: true, mensaje: 'Acción ' + id + ' registrada.' };
}

function panelNuevoEvento(datos) {
  const id = registrarEvento(datos);
  return { ok: true, mensaje: 'Evento ' + id + ' registrado.' };
}

function panelCambiarEstado(idAccion, nuevoEstado, detalle) {
  const resultado = cambiarEstado(idAccion, nuevoEstado, detalle || {});
  generarHojaAlertas();
  construirTablero();
  return { ok: true, mensaje: resultado };
}

function panelSubirEvidencia(idAccion, nombreArchivo, mimeType, base64) {
  const resultado = subirEvidencia(idAccion, nombreArchivo, mimeType, base64);
  return { ok: true, mensaje: 'Evidencia "' + resultado.archivo + '" subida. Total: ' + resultado.total, datos: resultado };
}

function panelSincronizar(idAccion) {
  const resultado = sincronizarEvidencias(idAccion);
  return { ok: true, mensaje: 'Evidencias sincronizadas: ' + resultado.total, datos: resultado };
}

function panelVincularEvidencia(idAccion, url) {
  const mensaje = vincularEvidenciaExterna(idAccion, url);
  return { ok: true, mensaje: mensaje };
}
