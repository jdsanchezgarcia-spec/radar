// ============================================================
//  ACCESO POR USUARIO Y CONTRASEÑA
//  (ya no se usa Google Sign-In → se elimina el permiso
//   script.external_request que estaba bloqueando el script)
// ============================================================

// Semilla secreta guardada en Propiedades del Script (nunca se guarda en la hoja).
function pepper() {
  const props = PropertiesService.getScriptProperties();
  let p = props.getProperty('CLAVE_PEPPER');
  if (!p) {
    p = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('CLAVE_PEPPER', p);
  }
  return p;
}

function nuevaSal() {
  return Utilities.getUuid().replace(/-/g, '');
}

// SHA-256(sal + contraseña + semilla) en hexadecimal.
function hashClave(clave, sal) {
  const texto = String(sal || '') + '::' + String(clave || '') + '::' + pepper();
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8);
  let salida = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    salida += ('0' + b.toString(16)).slice(-2);
  }
  return salida;
}

function usuarioPorEmail(email) {
  const e = String(email || '').toLowerCase().trim();
  if (!e) return null;
  const filas = leerTabla(CFG.HOJAS.USUARIOS);
  for (let i = 0; i < filas.length; i++) {
    if (String(filas[i]['Email'] || '').toLowerCase() === e) return filas[i];
  }
  return null;
}

// Busca por correo o por nombre completo (para dejar escribir cualquiera de los dos).
function buscarUsuario(identificador) {
  const id = normalizarTexto(identificador).toLowerCase();
  if (!id) return null;
  const filas = leerTabla(CFG.HOJAS.USUARIOS);
  for (let i = 0; i < filas.length; i++) {
    const r = filas[i];
    if (String(r['Email'] || '').toLowerCase() === id) return r;
    if (normalizarTexto(r['Nombre']).toLowerCase() === id) return r;
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

// ---------------- Protección contra fuerza bruta ----------------
function llaveIntento(identificador) {
  return ('INTENTO_' + String(identificador).toLowerCase()).replace(/[^a-z0-9]/gi, '_');
}

function intentosFallidos(llave) {
  return Number(CacheService.getScriptCache().get(llave) || 0);
}

function registrarIntentoFallido(llave) {
  const cache = CacheService.getScriptCache();
  const actual = intentosFallidos(llave) + 1;
  cache.put(llave, String(actual), 600); // se borra solo a los 10 minutos
  return actual;
}

// ---------------- Login ----------------
function loginUsuarioClave(datos) {
  const id = normalizarTexto(datos && (datos.usuario || datos.email));
  const clave = String((datos && datos.clave) || '');
  if (!id || !clave) throw new Error('Debes escribir tu usuario y tu contraseña.');

  const llave = llaveIntento(id);
  if (intentosFallidos(llave) >= 5) {
    throw new Error('Demasiados intentos fallidos. Espera 10 minutos antes de volver a intentarlo.');
  }

  const reg = buscarUsuario(id);
  const activo = reg && String(reg['Activo']).trim().toUpperCase() !== 'NO';
  if (!activo) {
    registrarIntentoFallido(llave);
    throw new Error('Usuario o contraseña incorrectos.');
  }

  const hash = String(reg['Hash'] || '');
  if (!hash) {
    throw new Error('Este usuario todavía no tiene contraseña. Pide al administrador que la cree desde el panel (Usuarios → Clave).');
  }
  if (hashClave(clave, String(reg['Sal'] || '')) !== hash) {
    registrarIntentoFallido(llave);
    throw new Error('Usuario o contraseña incorrectos.');
  }
  CacheService.getScriptCache().remove(llave);

  const usuario = {
    email: String(reg['Email'] || '').toLowerCase(),
    nombre: normalizarTexto(reg['Nombre']),
    rol: normalizarTexto(reg['Rol']) || CFG.ROLES.PROFESIONAL
  };
  const token = crearSesion(usuario);
  return { token: token, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol };
}

// ---------------- Contraseñas ----------------
function guardarClave(reg, clave) {
  const c = String(clave || '');
  if (c.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
  const sal = nuevaSal();
  escribirCampos(CFG.HOJAS.USUARIOS, COL.USUARIOS, reg._fila, {
    'Sal': sal,
    'Hash': hashClave(c, sal)
  });
}

/**
 * Se ejecuta UNA sola vez desde el editor de Apps Script para crear
 * la contraseña del primer administrador:
 *
 *   asignarClaveInicial('correo@unillanos.edu.co', 'MiClave123')
 */
function asignarClaveInicial(email, clave) {
  const e = String(email || '').toLowerCase().trim();
  const reg = usuarioPorEmail(e);
  if (!reg) {
    throw new Error('No existe el usuario "' + e + '". Agrégalo primero en la hoja Usuarios (Email, Nombre, Rol, Activo).');
  }
  guardarClave(reg, clave);
  return 'Contraseña asignada a ' + e + '. Ya puede iniciar sesión en la página.';
}

/**
 * Cambio de contraseña desde el panel:
 *  - el administrador puede cambiar la de cualquiera
 *  - el profesional solo la suya
 */
function cambiarClaveUsuario(datos, usuario) {
  if (!usuario) throw new Error('Debes iniciar sesión.');
  const objetivo = normalizarTexto(datos && datos.email).toLowerCase();
  if (!objetivo) throw new Error('Debes indicar el usuario.');
  if (!esAdmin(usuario) && normalizarTexto(usuario.email) !== objetivo) {
    throw new Error('Solo puedes cambiar tu propia contraseña.');
  }
  const reg = usuarioPorEmail(objetivo);
  if (!reg) throw new Error('No existe el usuario ' + objetivo + '.');
  guardarClave(reg, datos.clave);
  return 'Contraseña actualizada para ' + objetivo + '.';
}

// ---------------- Permisos por rol ----------------
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
