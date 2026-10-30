const CFG = {
  NOMBRE: 'Radar',
  ZONA_HORARIA: 'America/Bogota',
  CARPETA_EVIDENCIAS: 'Radar - Evidencias',

  HOJAS: {
    CASOS: 'Casos',
    EVENTOS: 'Eventos',
    PLANES: 'PlanesDeMejora',
    VERIFICACIONES: 'RegistroVerificaciones',
    ALERTAS: 'Alertas',
    TABLERO: 'Tablero',
    CONFIG: 'Config',
    USUARIOS: 'Usuarios',
    VISITAS: 'Visitas',
    CATALOGOS: 'Catalogos',
    SEGUIMIENTOS: 'Seguimientos',
    IMPORTAR: 'Importar'
  },

  ROLES: {
    ADMIN: 'Admin',
    PROFESIONAL: 'Profesional',
    VISITA: 'Visita'
  },

  TIPOS_VISITA: ['Visita técnica', 'Verificación', 'Seguimiento'],

  ESTADOS: {
    PENDIENTE: 'Pendiente',
    EJECUCION: 'En ejecución',
    REPORTADA: 'Reportada',
    VERIFICADA: 'Verificada',
    RECHAZADA: 'Rechazada'
  },

  ESTADOS_CASO: ['Pendiente', 'En proceso', 'Gestionado', 'Cerrado'],

  // Estados de un COMPROMISO de seguimiento (hoja Seguimientos).
  // Vienen del Excel "Seguimiento_UDA_Completo": CUMPLE / PARCIAL / NO CUMPLE.
  ESTADOS_SEGUIMIENTO: ['CUMPLE', 'PARCIAL', 'NO CUMPLE'],
  PORCENTAJE_SEGUIMIENTO_MAX: 100,

  PRIORIDADES: ['Alta', 'Media', 'Baja'],
  CLASIFICACIONES: ['Materno', 'Perinatal'],
  ESTADOS_UAEM: ['Programada', 'Realizada', 'No realizada'],
  SI_NO: ['Sí', 'No', 'Pendiente'],

  TRANSICIONES: {
    'Pendiente': ['En ejecución'],
    'En ejecución': ['Reportada'],
    'Reportada': ['Verificada', 'Rechazada', 'En ejecución'],
    'Rechazada': ['En ejecución'],
    'Verificada': []
  },

  NIVELES_ALERTA: ['VENCIDA', 'RECHAZADA', 'SIN VERIFICAR', 'PRÓXIMO A VENCER', 'SIN FECHA LÍMITE'],

  CONCLUSIONES: [
    'EVITABLE',
    'NO EVITABLE',
    'EVITABLE DESDE EL PUNTO DE VISTA DEL CONTROL PRENATAL',
    'TEMPRANA DIRECTA EVITABLE',
    'No aplica'
  ],

  COLOR: {
    ENCABEZADO: '#1F4E79',
    ENCABEZADO_TEXTO: '#FFFFFF',
    TITULO: '#0B3C5D',
    SUBTITULO: '#D6E4F0',
    KPI_FONDO: '#EAF2F8',
    KPI_ALERTA: '#F4CCCC',
    TEXTO: '#203864',
    PENDIENTE: '#FFF2CC',
    EJECUCION: '#DDEBF7',
    REPORTADA: '#FCE4D6',
    VERIFICADA: '#E2EFDA',
    RECHAZADA: '#F8CBAD',
    VENCIDA: '#F4CCCC',
    PROXIMO: '#FFE599',
    SIN_VERIFICAR: '#F9CB9C',
    NEUTRO: '#EDEDED'
  },

  PARAMETROS: {
    DIAS_ALERTA_VENCIMIENTO: 15,
    DIAS_SIN_VERIFICAR: 7,
    SEMANAS_VENCIMIENTO: 5,
    CORREOS_ALERTA: ''
  }
};

const COL = {
  CASOS: [
    'ID_Caso',
    'CASO',
    '# cc',
    'EDAD',
    'GESTACIONES',
    'EVENTO',
    'FECHA DE DEFUNCIÓN',
    'FECHA DE ASIGNACIÓN',
    'FECHA DE VENCIMIENTO',
    'FECHA DE REALIZACIÓN',
    'PERÍODO EPIDEMIOLÓGICO',
    'EAPB',
    'IPS DE PRIMER NIVEL',
    'IPS DE ATENCIÓN DEL PARTO',
    'OBSERVACIÓN',
    'CAUSA DE MUERTE',
    'CONCLUSIÓN UNIDAD DE ANÁLISIS',
    'PROFESIONAL ASIGNADO',
    'INTERVINIENTES EN LA UA',
    'SEGUIMIENTO',
    'OTROS DATOS RELEVANTES',
    'ESTADO SEGUIMIENTO'
  ],

  EVENTOS: [
    'ID_Evento',
    'Fecha evento',
    'Clasificación',
    'Tipo de evento',
    'Institución',
    'Resumen del evento',
    'Estado UAEM',
    'Fecha UAEM',
    'Planes generados',
    'Observaciones'
  ],

  PLANES: [
    'ID_Acción',
    'ID_Evento',
    'Institución responsable',
    'Responsable asignado',
    'Hallazgo identificado',
    'Acción propuesta',
    'Fecha límite',
    'Indicador / evidencia esperada',
    'Prioridad',
    'Estado',
    '% Avance',
    'Fecha reporte',
    'Carpeta de evidencias',
    'N° evidencias',
    'Fecha verificación',
    'Verificador',
    '¿Responde al hallazgo?',
    '¿Efectiva?',
    'Observaciones de verificación',
    'Días restantes',
    'Alerta',
    'Última actualización'
  ],

  VERIFICACIONES: [
    'Fecha',
    'ID_Acción',
    'Verificador',
    'Decisión',
    '¿Responde al hallazgo?',
    '¿Efectiva?',
    'Observaciones'
  ],

  ALERTAS: [
    'Nivel',
    'ID_Acción',
    'Institución responsable',
    'Responsable asignado',
    'Acción propuesta',
    'Fecha límite',
    'Días restantes',
    'Estado',
    'N° evidencias',
    'Detalle'
  ],

  CONFIG: ['Parámetro', 'Valor', 'Descripción'],

  USUARIOS: [
    'Email',
    'Nombre',
    'Rol',
    'Activo',
    'Fecha registro',
    'Sal',
    'Hash'
  ],

  VISITAS: [
    'ID_Visita',
    'ID_Caso',
    'Fecha',
    'Tipo',
    'Profesional',
    'Observaciones',
    'Hallazgos',
    'Acuerdos',
    'Resultado',
    'Carpeta',
    'N° archivos'
  ],

  // Hoja Seguimientos: una fila = UN COMPROMISO derivado de una UDA.
  // Las columnas 3 a 19 conservan EXACTAMENTE los encabezados del Excel
  // "Seguimiento_UDA_Completo" para poder pegar/importar sin mapear a mano.
  SEGUIMIENTOS: [
    'ID_Seguimiento',
    'ID_Caso',
    'N°',
    'NOMBRE',
    'TIPO DE ID',
    'N° IDENTIFICACIÓN',
    'EVENTO',
    'FECHA DE UDA',
    'EAPB RESPONSABLE',
    'IPS RESPONSABLE',
    'FECHAS Y OBSERVACIONES DE LOS SEGUIMIENTOS REALIZADOS',
    'COMPROMISO',
    'Responsable del compromiso',
    'Fecha de cumplimiento',
    'Responsable del seguimiento al compromiso',
    'fecha de seguimiento',
    'OBSERVACIÓN DE SEGUIMIENTO',
    'ESTADO',
    'PORCENTAJE',
    'Profesional',
    'Vínculo',
    'Última actualización'
  ],

  // Encabezados esperados en la hoja Importar (se copian del Excel).
  // Se identifican por nombre, tolerando mayúsculas/acentos.
  IMPORTAR_EXCEL: [
    'N°',
    'NOMBRE',
    'TIPO DE ID',
    'N° IDENTIFICACIÓN',
    'EVENTO',
    'FECHA DE UDA',
    'EAPB RESPONSABLE',
    'IPS RESPONSABLE',
    'FECHAS Y OBSERVACIONES DE LOS SEGUIMIENTOS REALIZADOS',
    'COMPROMISO',
    'Responsable del compromiso',
    'Fecha de cumplimiento',
    'Responsable del seguimiento al compromiso',
    'fecha de seguimiento',
    'OBSERVACIÓN DE SEGUIMIENTO',
    'ESTADO',
    'PORCENTAJE'
  ],

  IPS_PAIS: [
    'HOSPITAL DEPARTAMENTAL VILLAVICENCIO',
    'HOSPITAL UNIVERSITARIO DE VILLAVICENCIO',
    'CLÍNICA META',
    'CLÍNICA LA FEDERACIÓN',
    'CLÍNICA LOS LLANOS',
    'HOSPITAL SAN RAFAEL DE VILLAVICENCIO',
    'IPS VILLAVICENCIO SALUD',
    'HOSPITAL MUNICIPAL ACACÍAS',
    'HOSPITAL MUNICIPAL PUERTO LOPEZ',
    'HOSPITAL MUNICIPAL GRANADA',
    'HOSPITAL SAN JUAN DE DIOS',
    'HOSPITAL UNIVERSITARIO SAN IGNACIO',
    'HOSPITAL MAYOR MÉNDEZ',
    'HOSPITAL UNIVERSITARIO CLÍNICA SAN RAFAEL',
    'HOSPITAL PABLO TOBÓN URIBE',
    'HOSPITAL UNIVERSITARIO SAN VICENTE FUNDACIÓN',
    'HOSPITAL UNIVERSITARIO VALLEDUPAR',
    'HOSPITAL UNIVERSITARIO SANTIAGO DE CALI',
    'HOSPITAL UNIVERSITARIO ERASMO MEOZ',
    'HOSPITAL UNIVERSITARIO ANDRÉS CHRISTIANI',
    'HOSPITAL UNIVERSITARIO SAN JOSÉ',
    'HOSPITAL LOCAL DE TUNJA',
    'HOSPITAL UNIVERSITARIO DE SANTA MARÍA',
    'HOSPITAL SAN JUAN DE DIOS DE MANIZALES',
    'HOSPITAL UNIVERSITARIO FERNANDO TROCONIS',
    'HOSPITAL UNIVERSITARIO SAN JUAN DE DIOS',
    'HOSPITAL LOCAL DE ARMENIA',
    'HOSPITAL UNIVERSITARIO DE CUCUTA',
    'HOSPITAL UNIVERSITARIO ALEXANDER FLEMING',
    'HOSPITAL DE LA UNIVERSIDAD DE LOS ANDES',
    'CLÍNICA ALEJANDRO URIBE',
    'CLÍNICA CARDIOVIDA',
    'CLÍNICA GUIDO CHIAVERINI',
    'CLÍNICA LAS AMÉRICAS',
    'CLÍNICA MARLY',
    'CLÍNICA DEL_COUNTRY',
    'CLÍNICA CONTE',
    'CLÍNICA UNIVERSIDAD DE LOS ANDES',
    'CLÍNICA SANTA FE',
    'CLÍNICA PALMERA',
    'SALUD TOTAL IPS',
    'SANITAS IPS',
    'EPS SURA',
    'EPS CAJACOPI',
    'COMPENSAR EPS',
    'NUEVA EPS',
    'EPS FAMISANAR',
    'EPS SANITAS',
    'EPS ALLIANZ',
    'EPS LASERTECH',
    'EPS ASMET SALUD',
    'EPS SALUD MIA',
    'EPS SUREDIAS',
    'EPS MUTUALSER',
    'EPS CONVIDA',
    'EPS SARVENO',
    'EPS SALUD EMPRESARIAL',
    'EPS EN SALUD',
    'EPS MALLAMAS',
    'EPS PINEDA',
    'EPS SERVIMED',
    'EPS UNIMED',
    'IPS SALUD TOTAL',
    'IPS SANITAS',
    'IPS COMPENSAR',
    'IPS FAMISANAR',
    'IPS NUEVA EPS',
    'IPS SURA',
    'IPS CAJACOPI',
    'IPS ALLIANZ',
    'IPS UNIVERSIDAD DE LOS ANDES',
    'IPS PEDIÁTRICA DE COLOMBIA',
    'IPS CARDIOLOGÍA DEL LLANO',
    'IPS ONCOLOGÍA VILLAVICENCIO',
    'IPS GINECOLOGÍA VILLAVICENCIO',
    'IPS MATERNIDAD VILLAVICENCIO',
    'CENTRO MÉDICO VILLAVICENCIO',
    'CENTRO DIAGNÓSTICO VILLAVICENCIO',
    'LABORATORIO CLÍNICO VILLAVICENCIO'
  ]
};
