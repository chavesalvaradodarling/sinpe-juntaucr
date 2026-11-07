// Persona 1: fetch común + manejo de errores
async function api(ruta, metodo = 'GET', cuerpo) {
  const r = await fetch('/api' + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  return r.json(); // { ok, datos } o { ok: false, mensaje }
}
