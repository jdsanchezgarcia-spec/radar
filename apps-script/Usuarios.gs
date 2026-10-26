function listaUsuarios() {
  return leerTabla(CFG.HOJAS.USUARIOS).map(function (r) {
    return {
      email: String(r['Email'] || '').toLowerCase(),
      nombre: normalizarTexto(r['Nombre']),
      rol: canonizarRol(r['Rol']),
      activo: String(r['Activo']).trim().toUpperCase() !== 'NO',
      tieneClave: !!String(r['Hash'] || '').trim(),
      fila: r._fila
    };
  });
}

function profesionales() {
  return listaUsuarios().filter(function (u) {
    return u.rol === CFG.ROLES.PROFESIONAL && u.activo;
  });
}

function agregarUsuario(datos, usuario) {
  exigirRol(usuario, [CFG.ROLES.ADMIN]);
  const email = String(datos.email || '').toLowerCase().trim();
  if (!email || email.indexOf('@') < 0) throw new Error('Debes indicar un correo válido.');
  const nombre = normalizarTexto(datos.nombre);
  const rol = normalizarTexto(datos.rol) || CFG.ROLES.PROFESIONAL;
  if ([CFG.ROLES.ADMIN, CFG.ROLES.PROFESIONAL, CFG.ROLES.VISITA].indexOf(rol) < 0) throw new Error('Rol no válido.');
  if (usuarioPorEmail(email)) throw new Error('El correo ' + email + ' ya está registrado.');
  const clave = String(datos.clave || '');
  if (clave && clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
  const sal = clave ? nuevaSal() : '';
  const hash = clave ? hashClave(clave, sal) : '';
  hojaPorNombre(CFG.HOJAS.USUARIOS).appendRow([email, nombre, rol, 'Sí', new Date(), sal, hash]);
  return 'Usuario ' + email + ' agregado como ' + rol +
    (clave ? '.' : ' (sin contraseña: asígnala con el botón "Clave").');
}

function actualizarUsuario(datos, usuario) {
  exigirRol(usuario, [CFG.ROLES.ADMIN]);
  const email = String(datos.email || '').toLowerCase().trim();
  const reg = usuarioPorEmail(email);
  if (!reg) throw new Error('No existe el usuario ' + email + '.');
  const campos = {};
  if (datos.nombre !== undefined) campos['Nombre'] = normalizarTexto(datos.nombre);
  if (datos.rol !== undefined) {
    const rol = normalizarTexto(datos.rol);
    if ([CFG.ROLES.ADMIN, CFG.ROLES.PROFESIONAL, CFG.ROLES.VISITA].indexOf(rol) < 0) throw new Error('Rol no válido.');
    campos['Rol'] = rol;
  }
  if (datos.activo !== undefined) campos['Activo'] = datos.activo ? 'Sí' : 'No';
  escribirCampos(CFG.HOJAS.USUARIOS, COL.USUARIOS, reg._fila, campos);
  if (datos.clave) guardarClave(reg, datos.clave);
  return 'Usuario ' + email + ' actualizado.';
}

function eliminarUsuario(email, usuario) {
  exigirRol(usuario, [CFG.ROLES.ADMIN]);
  const e = String(email || '').toLowerCase().trim();
  const reg = usuarioPorEmail(e);
  if (!reg) throw new Error('No existe el usuario ' + e + '.');
  const admins = listaUsuarios().filter(function (u) { return u.rol === CFG.ROLES.ADMIN && u.activo; });
  if (String(reg['Rol']) === CFG.ROLES.ADMIN && admins.length <= 1) {
    throw new Error('No puedes eliminar al único administrador activo.');
  }
  hojaPorNombre(CFG.HOJAS.USUARIOS).deleteRow(reg._fila);
  return 'Usuario ' + e + ' eliminado.';
}
