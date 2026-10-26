function menuRegistrarEvento() {
  const ui = SpreadsheetApp.getUi();
  try {
    const fecha = ui.prompt(
      CFG.NOMBRE,
      'REGISTRAR EVENTO\n\nFecha del evento (dd/mm/aaaa):',
      ui.ButtonSet.OK_CANCEL
    );
    if (fecha.getSelectedButton() !== ui.Button.OK) return;

    const clasificacion = ui.prompt(
      CFG.NOMBRE,
      'Clasificación (Materno / Perinatal):',
      ui.ButtonSet.OK_CANCEL
    );
    if (clasificacion.getSelectedButton() !== ui.Button.OK) return;

    const institucion = ui.prompt(
      CFG.NOMBRE,
      'Institución donde ocurrió el evento:',
      ui.ButtonSet.OK_CANCEL
    );
    if (institucion.getSelectedButton() !== ui.Button.OK) return;

    const resumen = ui.prompt(
      CFG.NOMBRE,
      'Resumen del evento:',
      ui.ButtonSet.OK_CANCEL
    );
    if (resumen.getSelectedButton() !== ui.Button.OK) return;

    const id = registrarEvento({
      fecha: fecha.getResponseText(),
      clasificacion: clasificacion.getResponseText(),
      institucion: institucion.getResponseText(),
      resumen: resumen.getResponseText()
    });
    mostrarAviso('Evento registrado con el código: ' + id);
  } catch (e) {
    mostrarAviso('No se pudo registrar el evento:\n' + e.message);
  }
}

function menuRegistrarAccion() {
  const ui = SpreadsheetApp.getUi();
  try {
    const hallazgo = ui.prompt(
      CFG.NOMBRE,
      'REGISTRAR ACCIÓN DE MEJORA\n\nHallazgo identificado:',
      ui.ButtonSet.OK_CANCEL
    );
    if (hallazgo.getSelectedButton() !== ui.Button.OK) return;

    const accion = ui.prompt(
      CFG.NOMBRE,
      'Acción propuesta:',
      ui.ButtonSet.OK_CANCEL
    );
    if (accion.getSelectedButton() !== ui.Button.OK) return;

    const institucion = ui.prompt(
      CFG.NOMBRE,
      'Institución responsable:',
      ui.ButtonSet.OK_CANCEL
    );
    if (institucion.getSelectedButton() !== ui.Button.OK) return;

    const responsable = ui.prompt(
      CFG.NOMBRE,
      'Responsable asignado:',
      ui.ButtonSet.OK_CANCEL
    );
    if (responsable.getSelectedButton() !== ui.Button.OK) return;

    const fechaLimite = ui.prompt(
      CFG.NOMBRE,
      'Fecha límite (dd/mm/aaaa):',
      ui.ButtonSet.OK_CANCEL
    );
    if (fechaLimite.getSelectedButton() !== ui.Button.OK) return;

    const prioridad = ui.prompt(
      CFG.NOMBRE,
      'Prioridad (Alta / Media / Baja):',
      ui.ButtonSet.OK_CANCEL
    );
    if (prioridad.getSelectedButton() !== ui.Button.OK) return;

    const id = registrarAccion({
      hallazgo: hallazgo.getResponseText(),
      accion: accion.getResponseText(),
      institucion: institucion.getResponseText(),
      responsable: responsable.getResponseText(),
      fechaLimite: fechaLimite.getResponseText(),
      prioridad: prioridad.getResponseText()
    });
    mostrarAviso('Acción registrada con el código: ' + id);
    generarHojaAlertas();
    construirTablero();
  } catch (e) {
    mostrarAviso('No se pudo registrar la acción:\n' + e.message);
  }
}

function enviarAlertasPorCorreo() {
  const ui = SpreadsheetApp.getUi();
  try {
    const destino = normalizarTexto(valorParametro('CORREOS_ALERTA', ''));
    if (!destino) {
      throw new Error(
        'Configura el parámetro CORREOS_ALERTA en la hoja Config ' +
        '(correos separados por coma) y vuelve a intentarlo.'
      );
    }
    const total = generarHojaAlertas();
    const alertas = leerTabla(CFG.HOJAS.ALERTAS);
    if (alertas.length === 0) {
      mostrarAviso('No hay alertas activas en este momento.');
      return;
    }
    const html = construirCorreoAlertas(alertas);
    MailApp.sendEmail({
      to: destino,
      subject: CFG.NOMBRE + ' - Alertas del ' + formatearFecha(new Date()),
      htmlBody: html
    });
    mostrarAviso('Correo enviado con ' + alertas.length + ' alerta(s) a:\n' + destino);
  } catch (e) {
    mostrarAviso('No se pudo enviar el correo:\n' + e.message);
  }
}

function construirCorreoAlertas(alertas) {
  const filas = alertas
    .slice(0, 60)
    .map(function (a) {
      const color =
        a['Nivel'] === 'VENCIDA' ? '#C0392B' :
        a['Nivel'] === 'SIN VERIFICAR' ? '#E67E22' :
        a['Nivel'] === 'PRÓXIMO A VENCER' ? '#B7950B' : '#7F8C8D';
      return (
        '<tr>' +
        '<td style="padding:6px;border:1px solid #ddd;color:' + color + ';font-weight:bold;">' + a['Nivel'] + '</td>' +
        '<td style="padding:6px;border:1px solid #ddd;">' + a['ID_Acción'] + '</td>' +
        '<td style="padding:6px;border:1px solid #ddd;">' + a['Institución responsable'] + '</td>' +
        '<td style="padding:6px;border:1px solid #ddd;">' + a['Responsable asignado'] + '</td>' +
        '<td style="padding:6px;border:1px solid #ddd;">' + a['Acción propuesta'] + '</td>' +
        '<td style="padding:6px;border:1px solid #ddd;text-align:center;">' + formatearFecha(a['Fecha límite']) + '</td>' +
        '<td style="padding:6px;border:1px solid #ddd;text-align:center;">' + a['Días restantes'] + '</td>' +
        '<td style="padding:6px;border:1px solid #ddd;">' + a['Detalle'] + '</td>' +
        '</tr>'
      );
    })
    .join('');

  return (
    '<div style="font-family:Arial,sans-serif;color:#203864;">' +
    '<h2 style="background:#0B3C5D;color:#fff;padding:12px;margin:0;">Radar - Alertas de seguimiento</h2>' +
    '<p>Se encontraron <strong>' + alertas.length + '</strong> acción(es) que requieren atención.</p>' +
    '<table style="border-collapse:collapse;width:100%;font-size:13px;">' +
    '<thead><tr style="background:#1F4E79;color:#fff;">' +
    '<th style="padding:6px;border:1px solid #ddd;">Nivel</th>' +
    '<th style="padding:6px;border:1px solid #ddd;">Acción</th>' +
    '<th style="padding:6px;border:1px solid #ddd;">Institución</th>' +
    '<th style="padding:6px;border:1px solid #ddd;">Responsable</th>' +
    '<th style="padding:6px;border:1px solid #ddd;">Acción propuesta</th>' +
    '<th style="padding:6px;border:1px solid #ddd;">Fecha límite</th>' +
    '<th style="padding:6px;border:1px solid #ddd;">Días</th>' +
    '<th style="padding:6px;border:1px solid #ddd;">Detalle</th>' +
    '</tr></thead>' +
    '<tbody>' + filas + '</tbody></table>' +
    '<p style="color:#7F8C8D;font-size:12px;">Generado automáticamente por Radar - ' + ahoraTexto() + '</p>' +
    '</div>'
  );
}
