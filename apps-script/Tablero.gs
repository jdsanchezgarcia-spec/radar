function calcularKpis(acciones) {
  const kpi = {
    total: acciones.length,
    pendientes: 0,
    ejecucion: 0,
    reportadas: 0,
    verificadas: 0,
    rechazadas: 0,
    vencidas: 0,
    proximas: 0,
    sinVerificar: 0
  };
  acciones.forEach(function (reg) {
    const estado = normalizarTexto(reg['Estado']);
    if (estado === CFG.ESTADOS.PENDIENTE) kpi.pendientes++;
    if (estado === CFG.ESTADOS.EJECUCION) kpi.ejecucion++;
    if (estado === CFG.ESTADOS.REPORTADA) kpi.reportadas++;
    if (estado === CFG.ESTADOS.VERIFICADA) kpi.verificadas++;
    if (estado === CFG.ESTADOS.RECHAZADA) kpi.rechazadas++;

    const alerta = clasificarAlerta(reg);
    if (alerta) {
      if (alerta.nivel === 'VENCIDA') kpi.vencidas++;
      if (alerta.nivel === 'PRÓXIMO A VENCER') kpi.proximas++;
      if (alerta.nivel === 'SIN VERIFICAR') kpi.sinVerificar++;
    }
  });
  const conDecision = kpi.verificadas + kpi.rechazadas;
  kpi.pctEfectividad = conDecision > 0 ? Math.round((kpi.verificadas / conDecision) * 100) : 0;
  kpi.pctCumplimiento = kpi.total > 0 ? Math.round((kpi.verificadas / kpi.total) * 100) : 0;
  return kpi;
}

function agruparPorInstitucion(acciones) {
  const grupos = {};
  acciones.forEach(function (reg) {
    const inst = normalizarTexto(reg['Institución responsable']) || 'Sin institución';
    if (!grupos[inst]) {
      grupos[inst] = {
        institucion: inst,
        total: 0,
        vencidas: 0,
        proximas: 0,
        reportadas: 0,
        verificadas: 0,
        rechazadas: 0
      };
    }
    const g = grupos[inst];
    const estado = normalizarTexto(reg['Estado']);
    g.total++;
    if (estado === CFG.ESTADOS.REPORTADA) g.reportadas++;
    if (estado === CFG.ESTADOS.VERIFICADA) g.verificadas++;
    if (estado === CFG.ESTADOS.RECHAZADA) g.rechazadas++;
    const alerta = clasificarAlerta(reg);
    if (alerta) {
      if (alerta.nivel === 'VENCIDA') g.vencidas++;
      if (alerta.nivel === 'PRÓXIMO A VENCER') g.proximas++;
    }
  });
  return Object.keys(grupos)
    .map(function (k) {
      return grupos[k];
    })
    .sort(function (a, b) {
      return b.total - a.total;
    });
}

function construirTablero() {
  const acciones = leerTabla(CFG.HOJAS.PLANES);
  const kpi = calcularKpis(acciones);
  const instituciones = agruparPorInstitucion(acciones);
  const alertas = resumenAlertas();

  const h = hojaPorNombre(CFG.HOJAS.TABLERO);
  h.clear();
  h.getCharts().forEach(function (c) {
    h.removeChart(c);
  });
  h.setColumnWidth(1, 30);
  for (let c = 2; c <= 12; c++) h.setColumnWidth(c, 130);

  h.getRange('B1:K1').merge().setValue('RADAR MATERNO - TABLERO DE SEGUIMIENTO')
    .setBackground(CFG.COLOR.TITULO)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(14)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  h.setRowHeight(1, 40);

  h.getRange('B2:K2').merge()
    .setValue('Seguimiento y verificación de la efectividad de los planes de mejora materno-perinatales | Actualizado: ' + ahoraTexto())
    .setFontColor(CFG.COLOR.TEXTO)
    .setFontSize(10)
    .setHorizontalAlignment('center');

  const tarjetasFila1 = [
    ['Total acciones', kpi.total, CFG.COLOR.KPI_FONDO],
    ['Pendientes', kpi.pendientes, CFG.COLOR.PENDIENTE],
    ['En ejecución', kpi.ejecucion, CFG.COLOR.EJECUCION],
    ['Reportadas sin verificar', kpi.reportadas, CFG.COLOR.REPORTADA],
    ['Verificadas', kpi.verificadas, CFG.COLOR.VERIFICADA]
  ];
  const tarjetasFila2 = [
    ['Rechazadas', kpi.rechazadas, CFG.COLOR.RECHAZADA],
    ['Vencidas', kpi.vencidas, kpi.vencidas > 0 ? CFG.COLOR.VENCIDA : CFG.COLOR.KPI_FONDO],
    ['Próximas a vencer', kpi.proximas, kpi.proximas > 0 ? CFG.COLOR.PROXIMO : CFG.COLOR.KPI_FONDO],
    ['% Cumplimiento', kpi.pctCumplimiento, CFG.COLOR.KPI_FONDO],
    ['% Efectividad verificada', kpi.pctEfectividad, CFG.COLOR.KPI_FONDO]
  ];
  pintarTarjetas(h, 4, tarjetasFila1);
  pintarTarjetas(h, 7, tarjetasFila2);

  const casos = kpiCasos();
  pintarTarjetas(h, 10, [
    ['Casos totales', casos.total, CFG.COLOR.KPI_FONDO],
    ['Casos pendientes', casos.pendientes, CFG.COLOR.KPI_FONDO],
    ['Casos vencidos', casos.vencidos, casos.vencidos > 0 ? CFG.COLOR.VENCIDA : CFG.COLOR.KPI_FONDO],
    ['Casos realizados', casos.realizados, CFG.COLOR.VERIFICADA]
  ], 7);

  const estados = [
    CFG.ESTADOS.PENDIENTE,
    CFG.ESTADOS.EJECUCION,
    CFG.ESTADOS.REPORTADA,
    CFG.ESTADOS.VERIFICADA,
    CFG.ESTADOS.RECHAZADA
  ];
  h.getRange('B10:C10').merge().setValue('Acciones por estado')
    .setBackground(CFG.COLOR.SUBTITULO).setFontWeight('bold').setFontColor(CFG.COLOR.TEXTO);
  h.getRange('B11:C11').setValues([['Estado', 'Cantidad']]).setFontWeight('bold').setBackground('#F2F2F2');
  const datosEstado = estados.map(function (e) {
    let n = 0;
    acciones.forEach(function (a) {
      if (normalizarTexto(a['Estado']) === e) n++;
    });
    return [e, n];
  });
  h.getRange(12, 2, datosEstado.length, 2).setValues(datosEstado);

  h.getRange('E10:F10').merge().setValue('Alertas activas')
    .setBackground(CFG.COLOR.SUBTITULO).setFontWeight('bold').setFontColor(CFG.COLOR.TEXTO);
  h.getRange('E11:F11').setValues([['Nivel', 'Cantidad']]).setFontWeight('bold').setBackground('#F2F2F2');
  const datosAlerta = CFG.NIVELES_ALERTA.map(function (n) {
    return [n, alertas[n] || 0];
  });
  h.getRange(12, 5, datosAlerta.length, 2).setValues(datosAlerta);

  const filaInstituciones = 19;
  h.getRange('B' + filaInstituciones + ':H' + filaInstituciones).merge()
    .setValue('Acciones por institución responsable')
    .setBackground(CFG.COLOR.SUBTITULO).setFontWeight('bold').setFontColor(CFG.COLOR.TEXTO);
  const cabeceraInst = ['Institución', 'Total', 'Vencidas', 'Próximas', 'Reportadas', 'Verificadas', 'Rechazadas'];
  h.getRange(filaInstituciones + 1, 2, 1, cabeceraInst.length).setValues([cabeceraInst])
    .setFontWeight('bold').setBackground('#F2F2F2');
  if (instituciones.length > 0) {
    const filasInst = instituciones.map(function (g) {
      return [g.institucion, g.total, g.vencidas, g.proximas, g.reportadas, g.verificadas, g.rechazadas];
    });
    h.getRange(filaInstituciones + 2, 2, filasInst.length, cabeceraInst.length).setValues(filasInst);
    h.getRange(filaInstituciones + 2, 3, filasInst.length, 1).setFontWeight('bold');
  }

  const filaGraficas = filaInstituciones + 3 + instituciones.length;

  if (datosEstado.length > 0) {
    const chartEstado = h.newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(h.getRange(12, 2, datosEstado.length, 2))
      .setPosition(filaGraficas, 2, 0, 0)
      .setOption('title', 'Distribución por estado')
      .setOption('width', 440)
      .setOption('height', 300)
      .setOption('pieSliceText', 'percentage')
      .build();
    h.insertChart(chartEstado);
  }

  if (instituciones.length > 0) {
    const filasInst = instituciones.length;
    const chartInst = h.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(h.getRange(filaInstituciones + 2, 2, filasInst, 1))
      .addRange(h.getRange(filaInstituciones + 2, 3, filasInst, 1))
      .setPosition(filaGraficas, 6, 0, 0)
      .setOption('title', 'Total de acciones por institución')
      .setOption('width', 520)
      .setOption('height', 300)
      .setOption('legend', { position: 'none' })
      .setOption('is3D', false)
      .build();
    h.insertChart(chartInst);
  }

  SpreadsheetApp.flush();
  return kpi;
}

function pintarTarjetas(h, fila, tarjetas, colInicial) {
  const inicio = colInicial === undefined ? 2 : colInicial;
  tarjetas.forEach(function (t, i) {
    const col = inicio + i;
    h.getRange(fila, col).setValue(t[0])
      .setBackground(t[2])
      .setFontWeight('bold')
      .setFontSize(9)
      .setFontColor(CFG.COLOR.TEXTO)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true);
    const valor = h.getRange(fila + 1, col);
    valor.setValue(t[1])
      .setBackground(t[2])
      .setFontWeight('bold')
      .setFontSize(18)
      .setFontColor(CFG.COLOR.TEXTO)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    if (String(t[0]).charAt(0) === '%') valor.setNumberFormat('0"%"');
    h.getRange(fila, col).setBorder(true, true, true, true, true, true, '#FFFFFF', SpreadsheetApp.BorderStyle.SOLID);
    h.getRange(fila + 1, col).setBorder(true, true, true, true, true, true, '#FFFFFF', SpreadsheetApp.BorderStyle.SOLID);
  });
  h.setRowHeight(fila, 30);
  h.setRowHeight(fila + 1, 40);
}
