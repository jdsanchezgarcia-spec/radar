function clasificarAlerta(reg) {
  if (!reg) return null;
  const estado = normalizarTexto(reg['Estado']);
  if (estado === CFG.ESTADOS.VERIFICADA) return null;

  const dr = diasRestantes(reg['Fecha límite']);
  if (dr === null) {
    return {
      nivel: 'SIN FECHA LÍMITE',
      detalle: 'La acción no tiene fecha límite definida.'
    };
  }
  if (dr < 0) {
    const atraso = Math.abs(dr);
    return {
      nivel: 'VENCIDA',
      detalle: 'Vencida hace ' + atraso + ' día(s). Estado actual: ' + estado + '.'
    };
  }
  if (estado === CFG.ESTADOS.RECHAZADA) {
    return {
      nivel: 'RECHAZADA',
      detalle: 'Rechazada en la verificación; requiere reproceso del responsable.'
    };
  }
  const diasVerificar = Number(valorParametro('DIAS_SIN_VERIFICAR', CFG.PARAMETROS.DIAS_SIN_VERIFICAR));
  if (estado === CFG.ESTADOS.REPORTADA) {
    const dias = diasDesde(reg['Fecha reporte']);
    if (dias !== null && dias >= diasVerificar) {
      return {
        nivel: 'SIN VERIFICAR',
        detalle: 'Reportada hace ' + dias + ' día(s) sin verificación de efectividad.'
      };
    }
  }
  const diasAlerta = Number(valorParametro('DIAS_ALERTA_VENCIMIENTO', CFG.PARAMETROS.DIAS_ALERTA_VENCIMIENTO));
  if (dr <= diasAlerta) {
    return {
      nivel: 'PRÓXIMO A VENCER',
      detalle: 'Vence en ' + dr + ' día(s).'
    };
  }
  return null;
}

function ordenNivel(nivel) {
  const idx = CFG.NIVELES_ALERTA.indexOf(nivel);
  return idx < 0 ? 99 : idx + 1;
}

function generarHojaAlertas() {
  actualizarDiasRestantes();
  const accionesActualizadas = leerTabla(CFG.HOJAS.PLANES);
  const filas = [];
  const hp = hojaPorNombre(CFG.HOJAS.PLANES);
  const colAlerta = indiceColumna('Alerta', COL.PLANES);

  accionesActualizadas.forEach(function (reg) {
    const alerta = clasificarAlerta(reg);
    const valorAlerta = alerta ? alerta.nivel : '';
    if (normalizarTexto(reg['Alerta']) !== valorAlerta) {
      hp.getRange(reg._fila, colAlerta).setValue(valorAlerta);
    }
    if (!alerta) return;
    const dias = diasRestantes(reg['Fecha límite']);
    const limite = aFecha(reg['Fecha límite']);
    filas.push([
      alerta.nivel,
      reg['ID_Acción'],
      reg['Institución responsable'],
      reg['Responsable asignado'],
      reg['Acción propuesta'],
      limite || '',
      dias === null ? '' : dias,
      reg['Estado'],
      numeroDe(reg['N° evidencias']),
      alerta.detalle
    ]);
  });

  const filasCasos = filasAlertasDeCasos();
  const totalFilas = filas.concat(filasCasos);

  totalFilas.sort(function (a, b) {
    const dif = ordenNivel(a[0]) - ordenNivel(b[0]);
    if (dif !== 0) return dif;
    const da = a[6] === '' ? 99999 : a[6];
    const db = b[6] === '' ? 99999 : b[6];
    return da - db;
  });

  const h = hojaPorNombre(CFG.HOJAS.ALERTAS);
  const ultimaFila = h.getLastRow();
  if (ultimaFila > 1) {
    h.getRange(2, 1, ultimaFila - 1, COL.ALERTAS.length).clearContent();
    h.getRange(2, 1, ultimaFila - 1, COL.ALERTAS.length).setBackground(null);
  }
  if (totalFilas.length > 0) {
    h.getRange(2, 1, totalFilas.length, COL.ALERTAS.length).setValues(totalFilas);
    aplicarColoresAlertas(h, totalFilas.length);
  }
  h.getRange(2, indiceColumna('Fecha límite', COL.ALERTAS), Math.max(totalFilas.length, 1), 1)
    .setNumberFormat('dd/MM/yyyy');

  console.log('Alertas generadas: ' + totalFilas.length + ' (' + filas.length + ' acciones + ' + filasCasos.length + ' casos).');
  return totalFilas.length;
}

function aplicarColoresAlertas(h, cantidad) {
  const ultimaCol = COL.ALERTAS.length;
  const datos = h.getRange(2, 1, cantidad, ultimaCol).getValues();
  const colores = {
    'VENCIDA': CFG.COLOR.VENCIDA,
    'RECHAZADA': CFG.COLOR.RECHAZADA,
    'SIN VERIFICAR': CFG.COLOR.SIN_VERIFICAR,
    'PRÓXIMO A VENCER': CFG.COLOR.PROXIMO,
    'SIN FECHA LÍMITE': CFG.COLOR.NEUTRO
  };
  datos.forEach(function (fila, i) {
    const color = colores[fila[0]];
    if (!color) return;
    h.getRange(i + 2, 1, 1, ultimaCol).setBackground(color);
  });
}

function resumenAlertas() {
  const acciones = leerTabla(CFG.HOJAS.PLANES);
  const resumen = {};
  CFG.NIVELES_ALERTA.forEach(function (n) {
    resumen[n] = 0;
  });
  acciones.forEach(function (reg) {
    const alerta = clasificarAlerta(reg);
    if (alerta) resumen[alerta.nivel]++;
  });
  resumen.TOTAL = CFG.NIVELES_ALERTA.reduce(function (suma, n) {
    return suma + resumen[n];
  }, 0);
  return resumen;
}
