// Persona 1: inicio de sesión, Mis datos (cliente) y Clientes (admin).
// Rutas que usa (ver docs/API.md):
//   GET /api/entidades   POST /api/login   GET /api/sesion   POST /api/logout
//   GET/PUT /api/perfil  GET/POST /api/clientes   PUT /api/clientes/:id

// Ejecuta una pantalla y muestra el error si algo falla
// (si no hay sesión, iniciarPagina ya redirigió: no se muestra nada).
async function correrPagina(fn) {
  try {
    await fn();
  } catch (err) {
    if (['Sin sesión', 'Rol incorrecto'].includes(err.message)) return;
    const vista = document.getElementById('vista');
    if (vista) vista.innerHTML = `<div class="aviso error">${esc(err.message)}</div>`;
    console.error(err);
  }
}

/* ------------------------------ Login ------------------------------ */
// El rol NO se elige: lo trae el usuario. Solo se elige la entidad.
async function paginaLogin() {
  const sel = document.getElementById('entidad');
  const msj = document.getElementById('mensaje');

  const yaHay = await api('/sesion');
  if (yaHay.ok) { location.replace(`/${yaHay.datos.rol}/inicio.html`); return; }

  try {
    const entidades = await pedir('/entidades');
    sel.innerHTML = entidades.map((e) => `<option value="${e.idEntidad}">${esc(e.nombre)} · ${esc(e.codigo)}</option>`).join('');
  } catch (err) {
    msj.innerHTML = `<div class="aviso error">${esc(err.message)}</div>`;
  }
  const actualizarLogo = () => {
    const e = sel.options[sel.selectedIndex];
    if (e) document.querySelector('.login-caja .logo').textContent = siglas(e.textContent.split('·').pop().trim(), e.textContent);
  };
  sel.onchange = actualizarLogo;
  actualizarLogo();

  document.getElementById('form-login').onsubmit = async (ev) => {
    ev.preventDefault();
    msj.innerHTML = '';
    const usuario = document.getElementById('usuario').value.trim();
    const contrasena = document.getElementById('contrasena').value;
    if (!usuario || !contrasena) { msj.innerHTML = '<div class="aviso error">Ingrese su usuario y contraseña</div>'; return; }
    const boton = document.getElementById('ingresar');
    boton.disabled = true;
    try {
      const s = await pedir('/login', 'POST', { idEntidad: Number(sel.value), usuario, contrasena });
      location.replace(`/${s.rol}/inicio.html`);
    } catch (err) {
      msj.innerHTML = `<div class="aviso error">${esc(err.message)}</div>`;
      boton.disabled = false;
    }
  };
}

/* ---------------------------- Cliente: Mis datos ---------------------------- */
async function clientePerfil() {
  await iniciarPagina('Mi perfil', 'Mis datos');
  const vista = document.getElementById('vista');
  const c = await pedir('/perfil');

  vista.innerHTML = `
    <div class="rejilla" style="grid-template-columns:minmax(240px,1fr) 2fr">
      <div class="tarjeta" style="text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
        <div class="avatar claro" style="width:120px;height:120px;font-size:42px;border-width:4px">${esc(iniciales(c.nombre))}</div>
        <div class="b" style="font-size:22px;margin-top:8px">${esc(c.nombre)}</div>
        <div class="small muted">Identificación ${esc(c.identificacion)}</div>
        ${chip(c.estado)}
        <div class="small muted">Cliente desde ${fecha(c.fechaRegistro, false)}</div>
      </div>
      <form class="tarjeta" id="f">
        <h2 style="margin-bottom:16px">Datos personales</h2>
        <label class="campo">Nombre(s)<input class="entrada" name="nombres" value="${esc(c.nombres)}" required></label>
        <div class="form-fila" style="margin-top:14px">
          <label class="campo">Primer apellido<input class="entrada" name="primerApellido" value="${esc(c.primerApellido)}" required></label>
          <label class="campo">Segundo apellido<input class="entrada" name="segundoApellido" value="${esc(c.segundoApellido)}" required></label>
        </div>
        <label class="campo" style="margin-top:14px">Correo electrónico<input class="entrada" type="email" name="correo" value="${esc(c.correo)}" required></label>
        <label class="campo" style="margin-top:14px">Identificación<input class="entrada mono" value="${esc(c.identificacion)}" readonly></label>
        <div class="form-pie"><button type="reset" class="boton sec">Cancelar</button><button class="boton">Guardar cambios</button></div>
      </form>
    </div>`;

  vista.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await pedir('/perfil', 'PUT', Object.fromEntries(new FormData(e.target)));
      toast('Datos actualizados');
      setTimeout(() => location.reload(), 700);
    } catch (err) { toast(err.message, 'error'); }
  };
}

/* ------------------------------ Admin: Clientes ------------------------------ */
async function adminClientes() {
  const sesion = await iniciarPagina('Clientes y cuentas', 'Clientes');
  const vista = document.getElementById('vista');
  let lista = await pedir('/clientes');
  const f = { q: '', estado: 'todos' };

  vista.innerHTML = `
    <div class="pila">
      <form class="tarjeta" id="nuevo">
        <div class="tarjeta-cab"><h2>Registrar cliente</h2><span class="small muted">Nuevo cliente de ${esc(sesion.entidad)}</span></div>
        <div class="form-fila">
          <label class="campo">Identificación<input class="entrada mono" name="identificacion" placeholder="0-0000-0000" required></label>
          <label class="campo">Nombre(s)<input class="entrada" name="nombres" placeholder="Ej. Carla" required></label>
          <label class="campo">Primer apellido<input class="entrada" name="primerApellido" placeholder="Ej. Vega" required></label>
          <label class="campo">Segundo apellido<input class="entrada" name="segundoApellido" placeholder="Ej. Mora" required></label>
        </div>
        <div class="form-fila" style="margin-top:14px;grid-template-columns:2fr 1fr;align-items:end">
          <label class="campo">Correo electrónico<input class="entrada" type="email" name="correo" placeholder="nombre@correo.cr" required></label>
          <button class="boton">Registrar cliente</button>
        </div>
      </form>

      <div class="tarjeta">
        <div class="tarjeta-cab"><h2>Clientes de ${esc(sesion.entidad)}</h2><span class="small muted" id="conteo"></span></div>
        <div class="filtros">
          <div class="buscador crece"><input class="entrada" id="q" type="search" placeholder="Buscar por identificación, nombre o correo" aria-label="Buscar cliente"></div>
          ${segmentado('seg', [['todos', 'Todos'], ['ACTIVO', 'Activos'], ['INACTIVO', 'Inactivos']], 'todos')}
        </div>
        <div class="tabla-caja"><table>
          <thead><tr><th>Identificación</th><th>Nombre completo</th><th>Correo</th><th>Registro</th><th>Estado</th><th>Cuentas</th><th class="der">Acción</th></tr></thead>
          <tbody id="filas"></tbody></table></div>
      </div>
    </div>`;

  function pintar() {
    const qn = norm(f.q), qd = digitos(f.q);
    const filas = lista.filter((c) => (f.estado === 'todos' || c.estado === f.estado) &&
      (!f.q || norm(c.nombre).includes(qn) || norm(c.correo).includes(qn) || (qd && digitos(c.identificacion).includes(qd))));
    vista.querySelector('#conteo').textContent = `${filas.length} ${filas.length === 1 ? 'cliente' : 'clientes'}`;
    vista.querySelector('#filas').innerHTML = filas.map((c) => `
      <tr><td class="mono small">${esc(c.identificacion)}</td><td class="b">${esc(c.nombre)}</td><td>${esc(c.correo)}</td>
      <td>${fecha(c.fechaRegistro, false)}</td><td>${chip(c.estado)}</td><td>${c.cuentas}</td>
      <td class="der"><button class="boton sec peque" data-editar="${c.idCliente}">Editar</button></td></tr>`).join('')
      || '<tr><td colspan="7" class="vacio">Ningún cliente coincide con la búsqueda.</td></tr>';
    vista.querySelectorAll('[data-editar]').forEach((b) => (b.onclick = () => editar(lista.find((c) => String(c.idCliente) === b.dataset.editar))));
  }

  function editar(c) {
    const m = modal(`
      <h2>Editar cliente</h2>
      <form id="fe">
        <label class="campo">Identificación<input class="entrada mono" value="${esc(c.identificacion)}" readonly></label>
        <label class="campo" style="margin-top:12px">Nombre(s)<input class="entrada" name="nombres" value="${esc(c.nombres)}" required></label>
        <div class="form-fila" style="margin-top:12px">
          <label class="campo">Primer apellido<input class="entrada" name="primerApellido" value="${esc(c.primerApellido)}" required></label>
          <label class="campo">Segundo apellido<input class="entrada" name="segundoApellido" value="${esc(c.segundoApellido)}" required></label>
        </div>
        <label class="campo" style="margin-top:12px">Correo electrónico<input class="entrada" type="email" name="correo" value="${esc(c.correo)}" required></label>
        <label class="campo" style="margin-top:12px">Estado
          <select class="entrada" name="estado">
            <option value="ACTIVO" ${c.estado === 'ACTIVO' ? 'selected' : ''}>Activo</option>
            <option value="INACTIVO" ${c.estado === 'INACTIVO' ? 'selected' : ''}>Inactivo</option>
          </select></label>
        <div class="form-pie"><button type="button" class="boton sec" id="cerrar">Cancelar</button><button class="boton">Guardar cambios</button></div>
      </form>`);
    m.querySelector('#cerrar').onclick = () => m.remove();
    m.querySelector('#fe').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await pedir(`/clientes/${c.idCliente}`, 'PUT', Object.fromEntries(new FormData(e.target)));
        m.remove();
        toast('Cliente actualizado');
        lista = await pedir('/clientes');
        pintar();
      } catch (err) { toast(err.message, 'error'); }
    };
  }

  vista.querySelector('#nuevo').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await pedir('/clientes', 'POST', Object.fromEntries(new FormData(e.target)));
      e.target.reset();
      const m = modal(`<h2>Cliente registrado</h2>
        <p>Entregue estas credenciales al cliente para que ingrese a ${esc(sesion.entidad)}:</p>
        <div class="tarjeta" style="background:var(--lila-fondo);border-color:var(--lila)">
          <div>Usuario: <b class="mono">${esc(r.usuario)}</b></div>
          <div>Contraseña temporal: <b class="mono">${esc(r.contrasenaTemporal)}</b></div></div>
        <div class="form-pie"><a class="boton sec" style="text-decoration:none" href="/admin/cuentas.html">Abrir cuenta IBAN</a>
        <button class="boton" id="ok">Listo</button></div>`);
      m.querySelector('#ok').onclick = () => m.remove();
      lista = await pedir('/clientes');
      pintar();
    } catch (err) { toast(err.message, 'error'); }
  };
  vista.querySelector('#q').oninput = (e) => { f.q = e.target.value; pintar(); };
  enganchar(vista, 'seg', (v) => { f.estado = v; pintar(); });
  pintar();
}
