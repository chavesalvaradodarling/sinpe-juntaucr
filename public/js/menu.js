// Persona 1: menú lateral por rol y encabezado de cada pantalla.
// Cada página llama:  const sesion = await iniciarPagina('Sección', 'Título');
// (el título también puede ser una función que recibe la sesión).

const MENU = {
  cliente: [
    [null, [['inicio', 'Inicio', 'inicio']]],
    ['SINPE Móvil', [['sinpe', 'Transferir', 'enviar'], ['afiliacion', 'Afiliar número', 'mas'], ['historial', 'Historial de afiliaciones', 'historial']]],
    ['Cuentas', [['iban', 'Transferir por IBAN', 'cambio'], ['movimientos', 'Movimientos', 'lista']]],
    ['Mi perfil', [['perfil', 'Mis datos', 'persona'], ['telefonos', 'Mis teléfonos', 'telefono']]]
  ],
  admin: [
    [null, [['inicio', 'Inicio', 'inicio']]],
    ['Clientes y cuentas', [['clientes', 'Clientes', 'personas'], ['cuentas', 'Cuentas IBAN', 'tarjeta'], ['telefonos', 'Teléfonos', 'telefono']]],
    ['SINPE Móvil', [['afiliaciones', 'Afiliaciones', 'enlace'], ['historial', 'Historial de afiliaciones', 'historial']]],
    ['Consultas', [['movimientos', 'Movimientos', 'lista']]]
  ]
};

async function iniciarPagina(seccion, titulo) {
  const rolPagina = document.body.dataset.rol;      // 'cliente' o 'admin'
  const pagina = document.body.dataset.pagina;      // 'inicio', 'sinpe', ...

  const r = await api('/sesion');
  if (!r.ok) { location.replace('/'); throw new Error('Sin sesión'); }
  const sesion = r.datos;
  window.sesionActual = sesion;   // la usan los datos de ejemplo mientras falten rutas
  if (sesion.rol !== rolPagina) {                   // un cliente no entra a /admin y viceversa
    location.replace(`/${sesion.rol}/inicio.html`);
    throw new Error('Rol incorrecto');
  }

  dibujarMenu(sesion, pagina);
  const t = typeof titulo === 'function' ? titulo(sesion) : titulo;
  document.getElementById('miga').textContent = `${sesion.entidad} · ${seccion}`;
  document.getElementById('titulo').textContent = t;
  document.title = `${t} · SINPE JUNTAUCR`;
  dibujarEtiquetas(sesion);
  window.addEventListener('demo-usada', () => dibujarEtiquetas(sesion));
  return sesion;
}

function dibujarMenu(sesion, pagina) {
  const grupos = MENU[sesion.rol].map(([titulo, items]) => `
    ${titulo ? `<div class="menu-titulo">${titulo}</div>` : ''}
    ${items.map(([p, texto, ic]) => `
      <a href="/${sesion.rol}/${p}.html" class="${p === pagina ? 'activo' : ''}" ${p === pagina ? 'aria-current="page"' : ''}>${icono(ic)}${texto}</a>`).join('')}
  `).join('');

  document.getElementById('lateral').innerHTML = `
    <div class="marca">
      <div class="logo">${esc(siglas(sesion.codigo, sesion.entidad))}</div>
      <div><div class="nombre">${esc(sesion.entidad)}</div>
      <div class="codigo">Código ${esc(sesion.codigo)} · <b>${sesion.rol === 'admin' ? 'Admin' : 'Cliente'}</b></div></div>
    </div>
    <nav class="menu" aria-label="Menú principal">${grupos}</nav>
    <div class="usuario-sesion">
      <div class="avatar claro peque">${esc(iniciales(sesion.nombre))}</div>
      <div class="datos"><div class="b">${esc(sesion.nombre)}</div>
        <div class="small" style="opacity:.8">${sesion.rol === 'admin' ? 'Administrador' : esc(sesion.identificacion || '')}</div></div>
      <button class="boton-salir" id="salir" title="Cerrar sesión" aria-label="Cerrar sesión">${icono('salir')}</button>
    </div>`;

  document.getElementById('salir').onclick = async () => {
    await api('/logout', 'POST');
    location.replace('/');
  };
}

function dibujarEtiquetas(sesion) {
  const demo = window.rutasDemo && window.rutasDemo.size
    ? `<span class="chip demo" title="Estas rutas todavía no están programadas y usan datos de ejemplo:\n${[...window.rutasDemo].join('\n')}">Datos de ejemplo</span>`
    : '';
  document.getElementById('etiquetas').innerHTML = `${demo}
    <span class="chip rosa">Rol: ${sesion.rol === 'admin' ? 'Administrador' : 'Cliente'}</span>
    <span class="chip">${esc(sesion.entidad)}</span>`;
}
