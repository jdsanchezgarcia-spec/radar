function googleClientId() {
  try {
    const prop = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
    if (prop) return String(prop).trim();
  } catch (e) {}
  return normalizarTexto(CFG.GOOGLE_CLIENT_ID);
}

function verificarTokenGoogle(idToken) {
  const clientId = googleClientId();
  if (!clientId) throw new Error('Falta configurar GOOGLE_CLIENT_ID en las propiedades del script.');
  if (!idToken) throw new Error('No se recibió el token de Google.');
  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('El token de Google no es válido o expiró.');
  const data = JSON.parse(resp.getContentText());
  if (data.aud !== clientId) throw new Error('El token no corresponde a esta aplicación.');
  return { email: String(data.email || '').toLowerCase(), nombre: data.name || data.email || '' };
}

function usuarioPorEmail(email) {
  const e = String(email || '').toLowerCase();
  const filas = leerTabla(CFG.HOJAS.USUARIOS);
  for (let i = 0; i < filas.length; i++) {
    if (String(filas[i]['Email'] || '').toLowerCase() === e) return filas[i];
  }
  return null;
}

function crearSesion(usuario) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('SESION_' + token, JSON.stringify(usuario), 21600);
  return token;
}

function usuarioDeSesion(token) {
  if (!token) return null;
  try {
    const raw = CacheService.getScriptCache().get('SESION_' + token);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function cerrarSesion(token) {
  if (token) CacheService.getScriptCache().remove('SESION_' + token);
}

function loginConToken(idToken) {
  const info = verificarTokenGoogle(idToken);
  const reg = usuarioPorEmail(info.email);
  if (!reg) throw new Error('Sin acceso: el correo ' + info.email + ' no está registrado. Contacta al administrador.');
  if (String(reg['Activo']).trim().toUpperCase() === 'NO') throw new Error('Tu usuario está inactivo. Contacta al administrador.');
  const usuario = {
    email: info.email,
    nombre: normalizarTexto(reg['Nombre']) || info.nombre,
    rol: normalizarTexto(reg['Rol']) || CFG.ROLES.PROFESIONAL
  };
  const token = crearSesion(usuario);
  return { token: token, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol };
}

function exigirRol(usuario, rolesPermitidos) {
  if (!usuario) throw new Error('Debes iniciar sesión.');
  if (rolesPermitidos.indexOf(usuario.rol) < 0) {
    throw new Error('No tienes permiso para esta acción (requiere: ' + rolesPermitidos.join(' o ') + ').');
  }
}

function esAdmin(usuario) {
  return !!usuario && usuario.rol === CFG.ROLES.ADMIN;
}

function puedeEditarCaso(usuario, casoProfesional) {
  if (esAdmin(usuario)) return true;
  return !!usuario && normalizarTexto(casoProfesional) === normalizarTexto(usuario.nombre);
}

function exigirAccesoCaso(usuario, idCaso) {
  exigirRol(usuario, [CFG.ROLES.ADMIN, CFG.ROLES.PROFESIONAL]);
  if (esAdmin(usuario)) return;
  const casoReg = leerTabla(CFG.HOJAS.CASOS).filter(function (c) {
    return normalizarTexto(c['ID_Caso']) === normalizarTexto(idCaso);
  })[0];
  if (!casoReg) return;
  if (normalizarTexto(casoReg['PROFESIONAL ASIGNADO']) !== normalizarTexto(usuario.nombre)) {
    throw new Error('No tienes permiso para ver este caso.');
  }
}
