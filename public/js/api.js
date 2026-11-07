// Persona 1: fetch común + manejo de errores
// Todas las rutas responden { ok: true, datos } o { ok: false, mensaje }.
//
// Mientras una ruta todavía no existe en el backend (Express responde 404 en
// HTML), se usan los datos de ejemplo de demo.js para que la pantalla se vea.
// Cuando el compañero programa la ruta, se usa la real automáticamente.
async function api(ruta, metodo = 'GET', cuerpo) {
  let r;
  try {
    r = await fetch('/api' + ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      credentials: 'same-origin'
    });
  } catch (e) {
    return { ok: false, mensaje: 'No hay conexión con el servidor' };
  }

  const esJson = (r.headers.get('content-type') || '').includes('application/json');
  if (r.status === 404 && !esJson && typeof demoApi === 'function') {
    return demoApi(ruta, metodo, cuerpo); // ruta aún no programada
  }
  if (!esJson) return { ok: false, mensaje: `Error ${r.status} en ${metodo} /api${ruta}` };
  return r.json(); // { ok, datos } o { ok: false, mensaje }
}

// Igual que api(), pero devuelve solo "datos" y lanza un Error con el
// mensaje del servidor si ok es false. Las pantallas usan esta.
async function pedir(ruta, metodo = 'GET', cuerpo) {
  const r = await api(ruta, metodo, cuerpo);
  if (!r || !r.ok) {
    const err = new Error((r && r.mensaje) || 'No se pudo completar la operación');
    err.estado = r && r.estado;
    throw err;
  }
  return r.datos;
}
