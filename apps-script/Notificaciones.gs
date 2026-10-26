// ---------------- Notificaciones de casos vencidos ----------------
function casosVencidos() {
  return listaCasos().filter(function (c) {
    return !c.fechaRealizacion && c.dias !== null && c.dias !== undefined && c.dias < 0;
  });
}

function htmlVencidos(casos, titulo) {
  const filas = casos.map(function (c) {
    return '<tr>' +
      '<td style="padding:6px;border:1px solid #ddd;">' + c.id + '</td>' +
      '<td style="padding:6px;border:1px solid #ddd;">' + c.caso + '</td>' +
      '<td style="padding:6px;border:1px solid #ddd;">' + (c.profesional || 'Sin asignar') + '</td>' +
      '<td style="padding:6px;border:1px solid #ddd;">' + (c.fechaVencimiento || '') + '</td>' +
      '<td style="padding:6px;border:1px solid #ddd;color:#C0392B;font-weight:bold;">vencido hace ' + Math.abs(c.dias) + ' d</td>' +
      '</tr>';
  }).join('');
  return '<div style="font-family:Arial,sans-serif;color:#203864;">' +
    '<h2 style="background:#0B3C5D;color:#fff;padding:12px;margin:0;">Radar - Casos vencidos</h2>' +
    '<p>' + titulo + '</p>' +
    '<table style="border-collapse:collapse;width:100%;font-size:13px;">' +
    '<thead><tr style="background:#1F4E79;color:#fff;">' +
    '<th style="padding:6px;border:1px solid #ddd;">Caso ID</th>' +
    '<th style="padding:6px;border:1px solid #ddd;">Nombre</th>' +
    '<th style="padding:6px;border:1px solid #ddd;">Profesional</th>' +
    '<th style="padding:6px;border:1px solid #ddd;">Fecha límite</th>' +
    '<th style="padding:6px;border:1px solid #ddd;">Estado</th>' +
    '</tr></thead><tbody>' + filas + '</tbody></table>' +
    '<p style="color:#7F8C8D;font-size:12px;">Generado automáticamente por Radar</p>' +
    '</div>';
}

// Envía correo a cada profesional con sus casos vencidos y un resumen a los administradores.
function notificarVencidos() {
  const vencidos = casosVencidos();
  if (!vencidos.length) return 'No hay casos vencidos. No se envió ningún correo.';

  const usuarios = listaUsuarios();
  const admins = usuarios.filter(function (u) {
    return u.activo && u.email && canonizarRol(u.rol) === CFG.ROLES.ADMIN;
  });
  const porProf = {};
  vencidos.forEach(function (c) {
    const key = normalizarTexto(c.profesional).toLowerCase();
    if (!key) return;
    if (!porProf[key]) porProf[key] = [];
    porProf[key].push(c);
  });

  const asunto = 'Radar - ' + vencidos.length + ' caso(s) vencido(s) pendiente(s)';
  let enviados = 0;
  usuarios.forEach(function (u) {
    if (!u.activo || !u.email) return;
    const key = normalizarTexto(u.nombre).toLowerCase();
    if (!porProf[key]) return;
    MailApp.sendEmail({
      to: u.email,
      subject: asunto,
      htmlBody: htmlVencidos(porProf[key], 'Tienes ' + porProf[key].length + ' caso(s) vencido(s) pendiente(s) de realización:')
    });
    enviados++;
  });
  if (admins.length) {
    MailApp.sendEmail({
      to: admins.map(function (a) { return a.email; }).join(','),
      subject: asunto,
      htmlBody: htmlVencidos(vencidos, 'Resumen general: ' + vencidos.length + ' caso(s) vencido(s):')
    });
    enviados += admins.length;
  }
  return 'Notificación enviada a ' + enviados + ' correo(s) sobre ' + vencidos.length + ' caso(s) vencido(s).';
}

function notificarVencidosDiario() {
  try {
    notificarVencidos();
  } catch (e) {
    console.log('Notificación diaria falló: ' + ((e && e.message) || e));
  }
}

// Ejecutar UNA vez en el editor: envía el correo todos los días a las 8:00 a.m.
function instalarDisparadorDiario() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Abre primero la hoja de Radar y vuelve a ejecutar esta función.');
  const existe = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'notificarVencidosDiario';
  });
  if (!existe) {
    ScriptApp.newTrigger('notificarVencidosDiario').timeBased().atHour(8).everyDays(1).create();
  }
  ss.toast('Listo. Cada día a las 8:00 a.m. se enviará el correo de casos vencidos.', CFG.NOMBRE, 8);
}
