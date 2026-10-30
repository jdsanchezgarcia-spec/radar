var VERSION_INSTALACION = '3';

function instalarSistema() {
  crearHoja(CFG.HOJAS.CASOS, COL.CASOS, [95, 230, 130, 60, 130, 110, 110, 110, 110, 110, 130, 130, 160, 160, 300, 300, 170, 160, 260, 190, 240]);
  crearHoja(CFG.HOJAS.EVENTOS, COL.EVENTOS, [90, 100, 100, 140, 180, 320, 110, 100, 90, 240]);
  crearHoja(CFG.HOJAS.PLANES, COL.PLANES, [95, 90, 170, 160, 300, 300, 100, 220, 85, 110, 80, 100, 150, 85, 105, 130, 105, 90, 260, 90, 150, 125]);
  crearHoja(CFG.HOJAS.VERIFICACIONES, COL.VERIFICACIONES, [120, 95, 140, 110, 110, 95, 320]);
  crearHoja(CFG.HOJAS.ALERTAS, COL.ALERTAS, [150, 95, 170, 160, 300, 100, 95, 110, 85, 300]);
  crearHoja(CFG.HOJAS.TABLERO, [], []);
  crearHoja(CFG.HOJAS.CONFIG, COL.CONFIG, [240, 300, 440]);
  crearHoja(CFG.HOJAS.SEGUIMIENTOS, COL.SEGUIMIENTOS, ANCHOS_SEGUIMIENTOS);
  crearHoja(CFG.HOJAS.IMPORTAR, COL.IMPORTAR_EXCEL, ANCHOS_IMPORTAR);

  instalarParametros();
  instalarValidaciones();
  instalarFormatoCondicional();
  const r = cargarCasosReales();
  guardarParametro('ID_CARPETA_RAIZ', '1IyBY7ckC-NKizU5ENBKRPWlc6b0qOuFi', 'Carpeta raíz de evidencias en Drive (consolidado de casos)');
  generarHojaAlertas();
  construirTablero();
  PropertiesService.getScriptProperties().setProperty('INSTALACION_VERSION', VERSION_INSTALACION);
  SpreadsheetApp.flush();
  mostrarAviso(
    'Sistema instalado correctamente.\n\n' +
    'Casos reales cargados: ' + r.cargados + ' (se eliminaron ' + r.eliminadas + ' previos).' +
    (r.sinDefuncion && r.sinDefuncion.length
      ? '\n\nSin fecha de defunción (revisar en la hoja Casos):\n- ' + r.sinDefuncion.join('\n- ')
      : '') +
    '\n\nUsa el menú "Radar" para:\n' +
    ' - Abrir el panel de seguimiento\n' +
    ' - Actualizar alertas y tablero\n' +
    ' - Enviar alertas por correo'
  );
}

function crearHoja(nombre, encabezados, anchos) {
  const libro = ss();
  PropertiesService.getScriptProperties().setProperty('ID_LIBRO', libro.getId());
  let h = libro.getSheetByName(nombre);
  if (!h) h = libro.insertSheet(nombre);
  if (encabezados.length > 0) {
    h.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
    const cabecera = h.getRange(1, 1, 1, encabezados.length);
    cabecera
      .setBackground(CFG.COLOR.ENCABEZADO)
      .setFontColor(CFG.COLOR.ENCABEZADO_TEXTO)
      .setFontWeight('bold')
      .setVerticalAlignment('middle')
      .setWrap(true);
    h.setRowHeight(1, 44);
    h.setFrozenRows(1);
    anchos.forEach(function (ancho, i) {
      h.setColumnWidth(i + 1, ancho);
    });
  }
  return h;
}

function instalarParametros() {
  Object.keys(CFG.PARAMETROS).forEach(function (nombre) {
    const descripcion = {
      DIAS_ALERTA_VENCIMIENTO: 'Días de anticipación para alertar vencimientos próximos',
      DIAS_SIN_VERIFICAR: 'Días máximos que puede pasar una acción reportada sin verificación',
      SEMANAS_VENCIMIENTO: 'Semanas desde la fecha de defunción para el vencimiento automático de un caso (nota del Excel: 4 o 5)',
      CORREOS_ALERTA: 'Correos separados por coma para recibir el resumen de alertas'
    }[nombre] || '';
    const filas = leerTabla(CFG.HOJAS.CONFIG);
    let existe = false;
    filas.forEach(function (f) {
      if (String(f['Parámetro']).trim() === nombre) existe = true;
    });
    if (!existe) {
      hojaPorNombre(CFG.HOJAS.CONFIG).appendRow([nombre, CFG.PARAMETROS[nombre], descripcion]);
    }
  });
}

function instalarValidaciones() {
  const hp = hojaPorNombre(CFG.HOJAS.PLANES);
  const colPrioridad = indiceColumna('Prioridad', COL.PLANES);
  const colEstado = indiceColumna('Estado', COL.PLANES);
  const colResponde = indiceColumna('¿Responde al hallazgo?', COL.PLANES);
  const colEfectiva = indiceColumna('¿Efectiva?', COL.PLANES);
  const estados = Object.keys(CFG.ESTADOS).map(function (k) {
    return CFG.ESTADOS[k];
  });

  hp.getRange(letraColumna(colPrioridad) + '2:' + letraColumna(colPrioridad) + '5000')
    .setDataValidation(nuevaValidacion(CFG.PRIORIDADES));
  hp.getRange(letraColumna(colEstado) + '2:' + letraColumna(colEstado) + '5000')
    .setDataValidation(nuevaValidacion(estados));
  hp.getRange(letraColumna(colResponde) + '2:' + letraColumna(colResponde) + '5000')
    .setDataValidation(nuevaValidacion(CFG.SI_NO));
  hp.getRange(letraColumna(colEfectiva) + '2:' + letraColumna(colEfectiva) + '5000')
    .setDataValidation(nuevaValidacion(CFG.SI_NO));

  const he = hojaPorNombre(CFG.HOJAS.EVENTOS);
  const colClase = indiceColumna('Clasificación', COL.EVENTOS);
  const colUaem = indiceColumna('Estado UAEM', COL.EVENTOS);
  he.getRange(letraColumna(colClase) + '2:' + letraColumna(colClase) + '5000')
    .setDataValidation(nuevaValidacion(CFG.CLASIFICACIONES));
  he.getRange(letraColumna(colUaem) + '2:' + letraColumna(colUaem) + '5000')
    .setDataValidation(nuevaValidacion(CFG.ESTADOS_UAEM));

  const hc = hojaPorNombre(CFG.HOJAS.CASOS);
  const colConclusion = indiceColumna('CONCLUSIÓN UNIDAD DE ANÁLISIS', COL.CASOS);
  hc.getRange(letraColumna(colConclusion) + '2:' + letraColumna(colConclusion) + '5000')
    .setDataValidation(nuevaValidacion(CFG.CONCLUSIONES));

  // Hoja Seguimientos: Estado del compromiso con lista cerrada.
  const hs = hojaPorNombre(CFG.HOJAS.SEGUIMIENTOS);
  const colEstadoSeg = indiceColumna('ESTADO', COL.SEGUIMIENTOS);
  hs.getRange(letraColumna(colEstadoSeg) + '2:' + letraColumna(colEstadoSeg) + '5000')
    .setDataValidation(nuevaValidacion(CFG.ESTADOS_SEGUIMIENTO));
}

function nuevaValidacion(valores) {
  return SpreadsheetApp.newDataValidation()
    .setAllowInvalid(true)
    .setHelpText('Selecciona una opción de la lista')
    .requireValueInList(valores, true)
    .build();
}

function instalarFormatoCondicional() {
  const h = hojaPorNombre(CFG.HOJAS.PLANES);
  const colEstado = letraColumna(indiceColumna('Estado', COL.PLANES));
  const colAlerta = letraColumna(indiceColumna('Alerta', COL.PLANES));
  const ultimaFila = Math.max(h.getLastRow(), 5000);

  const reglas = [];

  reglas.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(CFG.ESTADOS.PENDIENTE)
      .setBackground(CFG.COLOR.PENDIENTE)
      .setRanges([h.getRange(colEstado + '2:' + colEstado + ultimaFila)])
      .build()
  );
  reglas.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(CFG.ESTADOS.EJECUCION)
      .setBackground(CFG.COLOR.EJECUCION)
      .setRanges([h.getRange(colEstado + '2:' + colEstado + ultimaFila)])
      .build()
  );
  reglas.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(CFG.ESTADOS.REPORTADA)
      .setBackground(CFG.COLOR.REPORTADA)
      .setRanges([h.getRange(colEstado + '2:' + colEstado + ultimaFila)])
      .build()
  );
  reglas.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(CFG.ESTADOS.VERIFICADA)
      .setBackground(CFG.COLOR.VERIFICADA)
      .setRanges([h.getRange(colEstado + '2:' + colEstado + ultimaFila)])
      .build()
  );
  reglas.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(CFG.ESTADOS.RECHAZADA)
      .setBackground(CFG.COLOR.RECHAZADA)
      .setRanges([h.getRange(colEstado + '2:' + colEstado + ultimaFila)])
      .build()
  );
  reglas.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('VENCIDA')
      .setBackground(CFG.COLOR.VENCIDA)
      .setBold(true)
      .setRanges([h.getRange(colAlerta + '2:' + colAlerta + ultimaFila)])
      .build()
  );
  reglas.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('PRÓXIMO A VENCER')
      .setBackground(CFG.COLOR.PROXIMO)
      .setRanges([h.getRange(colAlerta + '2:' + colAlerta + ultimaFila)])
      .build()
  );
  reglas.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('SIN VERIFICAR')
      .setBackground(CFG.COLOR.SIN_VERIFICAR)
      .setRanges([h.getRange(colAlerta + '2:' + colAlerta + ultimaFila)])
      .build()
  );
  reglas.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('RECHAZADA')
      .setBackground(CFG.COLOR.RECHAZADA)
      .setRanges([h.getRange(colAlerta + '2:' + colAlerta + ultimaFila)])
      .build()
  );
  reglas.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$' + colAlerta + '2="VENCIDA"')
      .setBackground(CFG.COLOR.VENCIDA)
      .setRanges([h.getRange('A2:' + colAlerta + ultimaFila)])
      .build()
  );

  h.setConditionalFormatRules(reglas);

  const colFechaLimite = indiceColumna('Fecha límite', COL.PLANES);
  const colFechaReporte = indiceColumna('Fecha reporte', COL.PLANES);
  const colFechaVerif = indiceColumna('Fecha verificación', COL.PLANES);
  const colAct = indiceColumna('Última actualización', COL.PLANES);
  [colFechaLimite, colFechaReporte, colFechaVerif].forEach(function (c) {
    h.getRange(letraColumna(c) + '2:' + letraColumna(c) + ultimaFila).setNumberFormat('dd/MM/yyyy');
  });
  h.getRange(letraColumna(colAct) + '2:' + letraColumna(colAct) + ultimaFila)
    .setNumberFormat('dd/MM/yyyy HH:mm');

  const he = hojaPorNombre(CFG.HOJAS.EVENTOS);
  const cFechaEvento = indiceColumna('Fecha evento', COL.EVENTOS);
  const cFechaUaem = indiceColumna('Fecha UAEM', COL.EVENTOS);
  [cFechaEvento, cFechaUaem].forEach(function (c) {
    he.getRange(letraColumna(c) + '2:' + letraColumna(c) + Math.max(he.getLastRow(), 5000))
      .setNumberFormat('dd/MM/yyyy');
  });

  const hv = hojaPorNombre(CFG.HOJAS.VERIFICACIONES);
  hv.getRange('A2:A' + Math.max(hv.getLastRow(), 5000)).setNumberFormat('dd/MM/yyyy HH:mm');

  const ha = hojaPorNombre(CFG.HOJAS.ALERTAS);
  const cLimiteAlerta = indiceColumna('Fecha límite', COL.ALERTAS);
  ha.getRange(letraColumna(cLimiteAlerta) + '2:' + letraColumna(cLimiteAlerta) + Math.max(ha.getLastRow(), 5000))
    .setNumberFormat('dd/MM/yyyy');

  const hc = hojaPorNombre(CFG.HOJAS.CASOS);
  const ultimaFilaCasos = Math.max(hc.getLastRow(), 5000);
  ['FECHA DE DEFUNCIÓN', 'FECHA DE ASIGNACIÓN', 'FECHA DE VENCIMIENTO', 'FECHA DE REALIZACIÓN'].forEach(function (nombre) {
    const c = letraColumna(indiceColumna(nombre, COL.CASOS));
    hc.getRange(c + '2:' + c + ultimaFilaCasos).setNumberFormat('dd/MM/yyyy');
  });
  const colVenc = letraColumna(indiceColumna('FECHA DE VENCIMIENTO', COL.CASOS));
  const colReal = letraColumna(indiceColumna('FECHA DE REALIZACIÓN', COL.CASOS));
  hc.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($' + colVenc + '2<>"",$' + colReal + '2="",$' + colVenc + '2<TODAY())')
      .setBackground(CFG.COLOR.VENCIDA)
      .setBold(true)
      .setRanges([hc.getRange('A2:' + colReal + ultimaFilaCasos)])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($' + colVenc + '2<>"",$' + colReal + '2="",$' + colVenc + '2>=TODAY(),$' + colVenc + '2<=TODAY()+' + Number(valorParametro('DIAS_ALERTA_VENCIMIENTO', CFG.PARAMETROS.DIAS_ALERTA_VENCIMIENTO)) + ')')
      .setBackground(CFG.COLOR.PROXIMO)
      .setRanges([hc.getRange('A2:' + colReal + ultimaFilaCasos)])
      .build()
  ]);

  instalarFormatoSeguimientos();
}

function instalarFormatoSeguimientos() {
  const h = hojaPorNombre(CFG.HOJAS.SEGUIMIENTOS);
  const cEstado = letraColumna(indiceColumna('ESTADO', COL.SEGUIMIENTOS));
  const cVinculo = letraColumna(indiceColumna('Vínculo', COL.SEGUIMIENTOS));
  const ultimaFila = Math.max(h.getLastRow(), 5000);

  h.getRange(cEstado + '2:' + cEstado + ultimaFila).setDataValidation(nuevaValidacion(CFG.ESTADOS_SEGUIMIENTO));

  h.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('CUMPLE')
      .setBackground(CFG.COLOR.VERIFICADA)
      .setRanges([h.getRange(cEstado + '2:' + cEstado + ultimaFila)])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('PARCIAL')
      .setBackground(CFG.COLOR.PENDIENTE)
      .setRanges([h.getRange(cEstado + '2:' + cEstado + ultimaFila)])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('NO CUMPLE')
      .setBackground(CFG.COLOR.VENCIDA)
      .setBold(true)
      .setRanges([h.getRange(cEstado + '2:' + cEstado + ultimaFila)])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Sin vincular')
      .setBackground(CFG.COLOR.SIN_VERIFICAR)
      .setRanges([h.getRange(cVinculo + '2:' + cVinculo + ultimaFila)])
      .build()
  ]);
}

function actualizarTodo() {
  generarHojaAlertas();
  construirTablero();
  SpreadsheetApp.flush();
  mostrarAviso('Alertas y tablero actualizados.');
}

function onOpen() {
  try {
    generarHojaAlertas();
    construirTablero();
  } catch (e) {
    console.log('No se pudieron actualizar alertas/tablero: ' + e.message);
  }
  SpreadsheetApp.getUi()
    .createMenu('Radar')
    .addItem('Instalar / Reparar sistema', 'instalarSistema')
    .addItem('Abrir panel de seguimiento', 'abrirPanel')
    .addSeparator()
    .addItem('Importar seguimientos desde Excel', 'menuImportarSeguimientos')
    .addItem('Recalcular vínculos de seguimientos', 'menuMarcarVinculosSeguimiento')
    .addSeparator()
    .addItem('Actualizar alertas y tablero', 'actualizarTodo')
    .addItem('Enviar alertas por correo', 'enviarAlertasPorCorreo')
    .addSeparator()
    .addItem('Registrar evento rápido', 'menuRegistrarEvento')
    .addItem('Registrar acción rápida', 'menuRegistrarAccion')
    .addItem('Actualizar columna de días restantes', 'actualizarDiasRestantes')
    .addToUi();
}
