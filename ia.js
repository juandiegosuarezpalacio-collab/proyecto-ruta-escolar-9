const IA_MENSAJES = {
  alistamiento: {
    formal: ({ ruta, listaTexto }) => `Buen día. Les informamos que la ${ruta} se está alistando para iniciar el recorrido.\n\nOrden estimado de recogida:\n${listaTexto}\nPor favor preparar a los estudiantes con anticipación. Muchas gracias.`,
    cercano: ({ ruta, listaTexto }) => `Hola familias 👋\nLa ${ruta} ya se está alistando.\n\nOrden de recogida:\n${listaTexto}\nPor favor ir preparando a los estudiantes. Gracias.`,
    breve: ({ ruta, listaTexto }) => `${ruta} alistándose.\n\nOrden:\n${listaTexto}\nPor favor alistarlos.`
  },
  llegadaColegio: {
    formal: ({ ruta }) => `Buen día. La ${ruta} ha llegado al colegio sin novedad. Los estudiantes ya se encuentran en la institución.`,
    cercano: ({ ruta }) => `Hola 👋 La ${ruta} ya llegó al colegio. Los estudiantes entraron sin novedad.`,
    breve: ({ ruta }) => `${ruta}: llegada al colegio confirmada.`
  },
  ingresoBarrio: {
    formal: ({ barrio, ruta }) => `Buen día. La ${ruta} acaba de ingresar al barrio ${barrio}. Por favor preparar a los estudiantes de este sector.`,
    cercano: ({ barrio, ruta }) => `Hola 👋 La ${ruta} ya entró a ${barrio}. Por favor ir alistando a los estudiantes del barrio.`,
    breve: ({ barrio, ruta }) => `${ruta} ingresó a ${barrio}. Por favor alistarse.`
  },
  estudianteActual: {
    formal: ({ acudiente, estudiante, barrio, ruta, minutos }) => `Buen día, ${acudiente}. La ${ruta} se encuentra próxima a recoger a ${estudiante} en ${barrio}. Tiempo estimado: ${minutos} minutos.`,
    cercano: ({ acudiente, estudiante, barrio, ruta, minutos }) => `Hola ${acudiente} 👋 La ${ruta} ya va cerca para recoger a ${estudiante} en ${barrio}. Llega en aproximadamente ${minutos} minutos.`,
    breve: ({ estudiante, minutos }) => `La ruta ya va para ${estudiante}. Tiempo estimado: ${minutos} min.`
  }
};

function generarListaOrdenada(lista) {
  return lista
    .slice()
    .sort((a, b) => (a.orden || 999) - (b.orden || 999))
    .map(item => `${item.orden}. ${item.nombre} - ${item.acudiente} - ${item.barrio}`)
    .join("\n");
}

function generarMensajeIA(tipo, tono, datos) {
  const grupo = IA_MENSAJES[tipo];
  if (!grupo) return "Mensaje no configurado.";
  const plantilla = grupo[tono] || grupo.cercano || Object.values(grupo)[0];
  return plantilla(datos);
}

function sugerirMensajeAlistamiento(ruta, lista, tono = "cercano") {
  return generarMensajeIA("alistamiento", tono, {
    ruta: `Ruta ${ruta}`,
    listaTexto: generarListaOrdenada(lista)
  });
}

function sugerirMensajeLlegada(ruta, tono = "cercano") {
  return generarMensajeIA("llegadaColegio", tono, { ruta: `Ruta ${ruta}` });
}

function sugerirMensajeBarrio(ruta, barrio, tono = "cercano") {
  return generarMensajeIA("ingresoBarrio", tono, { ruta: `Ruta ${ruta}`, barrio });
}

function sugerirMensajeEstudiante(estudiante, ruta, tono = "cercano") {
  return generarMensajeIA("estudianteActual", tono, {
    acudiente: estudiante.acudiente,
    estudiante: estudiante.nombre,
    barrio: estudiante.barrio,
    ruta: `Ruta ${ruta}`,
    minutos: estudiante.minutosEstimados || 3
  });
}
