// ---------------- Hoja Catálogos ----------------
// Una columna por categoría; el administrador agrega/quita valores aquí
// y esos cambios alimentan los desplegables de la web y de la hoja Casos.
const CATALOGOS_COLUMNAS = [
  ['estadosCaso', 'Estado del seguimiento'],
  ['eventos', 'Evento (CIE)'],
  ['periodos', 'Período epidemiológico'],
  ['eapbs', 'EAPB'],
  ['ips1', 'IPS 1er nivel'],
  ['ipsParto', 'IPS parto'],
  ['conclusiones', 'Conclusión UA'],
  ['profesionales', 'Profesional asignado']
];

function leerCatalogo() {
  const out = {};
  CATALOGOS_COLUMNAS.forEach(function (c) { out[c[0]] = []; });
  const h = ss().getSheetByName(CFG.HOJAS.CATALOGOS);
  if (!h || h.getLastRow() < 2) return out;
  const valores = h.getRange(1, 1, h.getLastRow(), CATALOGOS_COLUMNAS.length).getValues();
  CATALOGOS_COLUMNAS.forEach(function (c, j) {
    const vistos = {};
    const lista = [];
    for (let i = 1; i < valores.length; i++) {
      const v = normalizarTexto(valores[i][j]);
      if (v && !vistos[v]) { vistos[v] = 1; lista.push(v); }
    }
    out[c[0]] = lista;
  });
  // Los profesionales activos del sistema SIEMPRE aparecen para asignar,
  // aunque su nombre todavía no esté escrito en la hoja Catálogos.
  listaUsuarios().forEach(function (u) {
    if (!u.activo || canonizarRol(u.rol) !== CFG.ROLES.PROFESIONAL) return;
    if (u.nombre && out.profesionales.indexOf(u.nombre) < 0) out.profesionales.push(u.nombre);
  });
  return out;
}

function valoresUnicosDeCasos(campo) {
  const vistos = {};
  const lista = [];
  leerTabla(CFG.HOJAS.CASOS).forEach(function (r) {
    const v = normalizarTexto(r[campo]);
    if (v && !vistos[v]) { vistos[v] = 1; lista.push(v); }
  });
  return lista.sort();
}

// Crea la hoja Catálogos si no existe y la siembra con los valores actuales.
function asegurarCatalogos() {
  const existente = ss().getSheetByName(CFG.HOJAS.CATALOGOS);
  if (existente && existente.getLastRow() >= 2) return existente; // ya creada y con datos
  const h = crearHoja(
    CFG.HOJAS.CATALOGOS,
    CATALOGOS_COLUMNAS.map(function (c) { return c[1]; }),
    [190, 240, 190, 200, 260, 260, 330, 220]
  );
  const cat = {
    estadosCaso: CFG.ESTADOS_CASO.slice(),
    eventos: valoresUnicosDeCasos('EVENTO'),
    periodos: valoresUnicosDeCasos('PERÍODO EPIDEMIOLÓGICO').filter(function (p) { return !/semana/i.test(p); }),
    eapbs: valoresUnicosDeCasos('EAPB'),
    ips1: COL.IPS_PAIS.slice(),
    ipsParto: COL.IPS_PAIS.slice(),
    conclusiones: CFG.CONCLUSIONES.slice(),
    profesionales: listaUsuarios()
      .filter(function (u) { return u.activo && canonizarRol(u.rol) === CFG.ROLES.PROFESIONAL; })
      .map(function (u) { return u.nombre; })
  };
  const maxFilas = Math.max.apply(null, CATALOGOS_COLUMNAS.map(function (c) { return (cat[c[0]] || []).length; })) || 1;
  const datos = [];
  for (let i = 0; i < maxFilas; i++) {
    const fila = [];
    CATALOGOS_COLUMNAS.forEach(function (c) { fila.push((cat[c[0]] || [])[i] || ''); });
    datos.push(fila);
  }
  h.getRange(2, 1, datos.length, CATALOGOS_COLUMNAS.length).setValues(datos);
  asegurarValidacionesCatalogos();
  return h;
}

// Desplegables de la hoja Casos apuntando a los rangos de Catálogos:
// al agregar un valor en Catálogos, la lista del Excel se actualiza sola.
function asegurarValidacionesCatalogos() {
  const hcat = ss().getSheetByName(CFG.HOJAS.CATALOGOS);
  const hc = ss().getSheetByName(CFG.HOJAS.CASOS);
  if (!hcat || !hc) return;
  const mapaCasos = {
    'EVENTO': 'eventos',
    'PERÍODO EPIDEMIOLÓGICO': 'periodos',
    'EAPB': 'eapbs',
    'IPS DE PRIMER NIVEL': 'ips1',
    'IPS DE ATENCIÓN DEL PARTO': 'ipsParto',
    'CONCLUSIÓN UNIDAD DE ANÁLISIS': 'conclusiones',
    'PROFESIONAL ASIGNADO': 'profesionales',
    'ESTADO SEGUIMIENTO': 'estadosCaso'
  };
  Object.keys(mapaCasos).forEach(function (colCasos) {
    const j = CATALOGOS_COLUMNAS.findIndex(function (c) { return c[0] === mapaCasos[colCasos]; });
    if (j < 0) return;
    const col = indiceColumna(colCasos, COL.CASOS);
    if (!col) return;
    const letraCat = letraColumna(j + 1);
    const validacion = SpreadsheetApp.newDataValidation()
      .setAllowInvalid(true)
      .setHelpText('Elige un valor de la hoja Catálogos (para opciones nuevas, agrégalas allí)')
      .requireValueInRange(hcat.getRange(letraCat + '2:' + letraCat + '500'), true)
      .build();
    hc.getRange(letraColumna(col) + '2:' + letraColumna(col) + '5000').setDataValidation(validacion);
  });
}

// Agrega un nombre a la columna Profesional de Catálogos (si no está ya).
function agregarProfesionalACatalogo(nombre) {
  const n = normalizarTexto(nombre);
  if (!n) return;
  asegurarCatalogos();
  const h = ss().getSheetByName(CFG.HOJAS.CATALOGOS);
  const col = CATALOGOS_COLUMNAS.findIndex(function (c) { return c[0] === 'profesionales'; }) + 1;
  if (col < 1) return;
  const ultima = h.getLastRow();
  if (ultima > 1) {
    const vals = h.getRange(2, col, ultima - 1, 1).getValues();
    for (let i = 0; i < vals.length; i++) {
      if (normalizarTexto(vals[i][0]) === n) return; // ya está en la hoja
    }
  }
  h.getRange(ultima + 1, col).setValue(n);
}
