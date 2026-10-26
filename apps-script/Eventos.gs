function registrarEvento(datos) {
  const institucion = normalizarTexto(datos.institucion);
  const resumen = normalizarTexto(datos.resumen);
  if (!institucion) throw new Error('La institución del evento es obligatoria.');
  if (!resumen) throw new Error('El resumen del evento es obligatorio.');

  const fecha = aFecha(datos.fecha) || new Date();
  const clasificacion = normalizarTexto(datos.clasificacion);
  const claseValida = CFG.CLASIFICACIONES.filter(function (c) {
    return c.toLowerCase() === clasificacion.toLowerCase();
  })[0];

  const id = generarId('EV-', CFG.HOJAS.EVENTOS, 1);
  const h = hojaPorNombre(CFG.HOJAS.EVENTOS);
  h.appendRow([
    id,
    fecha,
    claseValida || CFG.CLASIFICACIONES[0],
    normalizarTexto(datos.tipo),
    institucion,
    resumen,
    normalizarTexto(datos.estadoUaem) || CFG.ESTADOS_UAEM[0],
    aFecha(datos.fechaUaem) || '',
    0,
    normalizarTexto(datos.observaciones)
  ]);
  return id;
}

function contarPlanesDelEvento(idEvento) {
  const id = normalizarTexto(idEvento);
  if (!id) return 0;
  const planes = leerTabla(CFG.HOJAS.PLANES);
  return planes.filter(function (p) {
    return normalizarTexto(p['ID_Evento']) === id;
  }).length;
}

function actualizarPlanesGenerados(idEvento) {
  const id = normalizarTexto(idEvento);
  if (!id) return 0;
  const eventos = leerTabla(CFG.HOJAS.EVENTOS);
  let evento = null;
  for (let i = 0; i < eventos.length; i++) {
    if (normalizarTexto(eventos[i]['ID_Evento']) === id) {
      evento = eventos[i];
      break;
    }
  }
  if (!evento) return 0;
  const total = contarPlanesDelEvento(id);
  escribirCampos(CFG.HOJAS.EVENTOS, COL.EVENTOS, evento._fila, { 'Planes generados': total });
  return total;
}
