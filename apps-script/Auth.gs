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
    rol: canonizarRol(reg['Rol'])
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
// Acepta variantes de escritura (ADMIN, administrador, Profesional...)
// y las convierte al valor canónico de CFG.ROLES.
function canonizarRol(rol) {
  const r = normalizarTexto(rol).toLowerCase();
  if (r === 'admin' || r === 'administrador') return CFG.ROLES.ADMIN;
  if (r === 'profesional') return CFG.ROLES.PROFESIONAL;
  return normalizarTexto(rol) || CFG.ROLES.PROFESIONAL;
}

function exigirRol(usuario, rolesPermitidos) {
  if (!usuario) throw new Error('Debes iniciar sesión.');
  if (rolesPermitidos.indexOf(canonizarRol(usuario.rol)) < 0) {
    throw new Error('No tienes permiso para esta acción (requiere: ' + rolesPermitidos.join(' o ') + '). Tu rol actual: ' + (usuario.rol || '(vacío)') + '.');
  }
}

function esAdmin(usuario) {
  return !!usuario && canonizarRol(usuario.rol) === CFG.ROLES.ADMIN;
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

// ---------------- Alta de usuarios desde la hoja ----------------
// Escribe la contraseña en la columna "Clave" de la hoja Usuarios:
// este disparador la cifra en Sal + Hash y borra lo escrito en claro.
// Requiere ejecutar UNA vez instalarDisparadorUsuarios() en el editor.
function indiceColumnaPorNombre(encabezados, nombres) {
  for (let i = 0; i < encabezados.length; i++) {
    const h = normalizarTexto(encabezados[i]).toLowerCase();
    if (nombres.indexOf(h) >= 0) return i;
  }
  return -1;
}

function normalizarRolEnHoja(hoja, fila, colRol) {
  const celda = hoja.getRange(fila, colRol + 1);
  const valor = normalizarTexto(celda.getValue()).toLowerCase();
  if (valor === 'admin' || valor === 'administrador') celda.setValue(CFG.ROLES.ADMIN);
  else if (valor === 'profesional') celda.setValue(CFG.ROLES.PROFESIONAL);
}

function alEditarUsuarios(e) {
  const ss = (e && e.source) || SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || !e || !e.range) return;
  const hoja = ss.getSheetByName(CFG.HOJAS.USUARIOS);
  if (!hoja || e.range.getSheet().getName() !== CFG.HOJAS.USUARIOS) return;

  const nCols = Math.max(hoja.getLastColumn(), COL.USUARIOS.length + 1);
  const encabezados = hoja.getRange(1, 1, 1, nCols).getValues()[0];

  let colClave = indiceColumnaPorNombre(encabezados, ['clave', 'clave temporal', 'contraseña', 'contrasena', 'password']);
  if (colClave === -1) {
    colClave = encabezados.length;
    hoja.getRange(1, colClave + 1).setValue('Clave');
    encabezados.push('Clave');
    ss.toast('Agregué la columna "Clave" en la hoja Usuarios.', CFG.NOMBRE, 5);
  }

  const colEmail = indiceColumnaPorNombre(encabezados, ['email', 'correo']);
  const colRol = indiceColumnaPorNombre(encabezados, ['rol']);
  const valores = e.range.getValues();

  for (let i = 0; i < valores.length; i++) {
    for (let j = 0; j < valores[i].length; j++) {
      if (e.range.getColumn() + j !== colClave + 1) continue;
      const fila = e.range.getRow() + i;
      if (fila < 2) continue;
      const clave = String(valores[i][j] || '').trim();
      if (!clave) continue;
      try {
        const email = colEmail >= 0
          ? String(hoja.getRange(fila, colEmail + 1).getValue() || '').trim().toLowerCase()
          : '';
        if (!email) throw new Error('Primero escribe el correo en la fila ' + fila + '.');
        if (clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres (fila ' + fila + ').');
        if (colRol >= 0) normalizarRolEnHoja(hoja, fila, colRol);
        const reg = usuarioPorEmail(email);
        if (!reg) throw new Error('No existe el usuario ' + email + ' (fila ' + fila + ').');
        guardarClave(reg, clave);
        hoja.getRange(fila, colClave + 1).clearContent();
        ss.toast('Contraseña guardada para ' + email + '. Ya puede iniciar sesión.', CFG.NOMBRE, 5);
      } catch (err) {
        hoja.getRange(fila, colClave + 1).clearContent();
        ss.toast(String((err && err.message) || err), CFG.NOMBRE + ' - No se guardó la contraseña', 8);
      }
    }
  }
}

function instalarDisparadorUsuarios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Abre primero la hoja de Radar y vuelve a ejecutar esta función.');
  const existe = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'alEditarUsuarios';
  });
  if (!existe) {
    ScriptApp.newTrigger('alEditarUsuarios')
      .forSpreadsheet(ss)
      .onEdit()
      .create();
  }
  ss.toast('Listo. Crea usuarios escribiendo Nombre, Email, Rol y Clave en la hoja Usuarios.', CFG.NOMBRE, 8);
}

// ---------------- Registro público (se aprueba en la hoja) ----------------
// Crea la cuenta como inactiva (Activo = No). El administrador la activa
// y le asigna el rol editando la hoja Usuarios (Activo = Sí, Rol = Admin).
function registroPublico(datos) {
  const email = String((datos && (datos.email || datos.usuario)) || '').toLowerCase().trim();
  const nombre = normalizarTexto(datos && datos.nombre);
  const clave = String((datos && datos.clave) || '');

  if (!nombre) throw new Error('Escribe tu nombre completo.');
  if (!email || email.indexOf('@') < 1 || email.indexOf('.') < 0) throw new Error('Escribe un correo válido.');
  if (clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');

  const llave = llaveIntento('registro:' + email);
  if (intentosFallidos(llave) >= 5) {
    throw new Error('Demasiados intentos. Espera 10 minutos antes de volver a intentarlo.');
  }
  if (usuarioPorEmail(email) || buscarUsuario(nombre)) {
    registrarIntentoFallido(llave);
    throw new Error('Ya existe una cuenta con ese correo o nombre.');
  }

  const sal = nuevaSal();
  const hash = hashClave(clave, sal);
  hojaPorNombre(CFG.HOJAS.USUARIOS).appendRow([email, nombre, CFG.ROLES.PROFESIONAL, 'No', new Date(), sal, hash]);
  CacheService.getScriptCache().remove(llave);
  return 'Cuenta creada para ' + email + '. El administrador debe activarla en la hoja (Activo = Sí) antes de que puedas entrar.';
}
