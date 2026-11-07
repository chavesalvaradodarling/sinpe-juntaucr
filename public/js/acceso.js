// Persona 1: inicio de sesión, pantallas de Inicio, Mis datos y Clientes.
// Rutas que usa (ver docs/API.md):
//   GET /api/entidades   POST /api/login   GET /api/sesion   POST /api/logout
//   GET/PUT /api/perfil  GET/POST /api/clientes   PUT /api/clientes/:id
//   Inicio también lee: /api/cuentas, /api/telefonos, /api/afiliaciones, /api/movimientos

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

// Rango por defecto para los resúmenes: últimos 30 días
function ultimos30() {
  const d = new Date(Date.now() - 30 * 864e5);
  return { desde: new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10), hasta: hoyISO() };
}

/* ---------------------------- Cliente: Inicio ---------------------------- */
async function clienteInicio() {
  const sesion = await iniciarPagina('Inicio', (s) => `Hola, ${s.nombre.split(' ')[0]}`);
  const vista = document.getElementById('vista');
  const [cuentas, telefonos, movs] = await Promise.all([
    pedir('/cuentas'), pedir('/telefonos'), pedir(`/movimientos?${new URLSearchParams(ultimos30())}`)
  ]);
  const activas = (m) => cuentas.filter((c) => c.moneda === m && c.estado === 'ACTIVA');
  const saldo = (m) => activas(m).reduce((t, c) => t + Number(c.saldo), 0);
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const afiliados = telefonos.filter((t) => t.estado === 'AFILIADO').length;
  const ultimos = movs.slice(0, 5);

  vista.innerHTML = `
    <div class="pila">
      <div class="rejilla rejilla-3">
        <div class="tarjeta kpi"><div class="etq">Saldo en colones</div><div class="valor">${dinero(saldo('CRC'))}</div>
          <div class="small muted">${plural(activas('CRC').length, 'cuenta activa', 'cuentas activas')}</div></div>
        <div class="tarjeta kpi"><div class="etq">Saldo en dólares</div><div class="valor">${dinero(saldo('USD'), 'USD')}</div>
          <div class="small muted">${plural(activas('USD').length, 'cuenta activa', 'cuentas activas')}</div></div>
        <div class="tarjeta kpi"><div class="etq">Mis números SINPE Móvil</div><div class="valor">${afiliados} de ${telefonos.length}</div>
          <div class="small muted">${plural(telefonos.length - afiliados, 'número sin afiliar aquí', 'números sin afiliar aquí')}</div></div>
      </div>

      <div class="tarjeta">
        <div class="tarjeta-cab"><h2>Mis cuentas IBAN</h2><span class="small muted">Solo cuentas de ${esc(sesion.entidad)} · las abre el banco</span></div>
        <div class="tabla-caja"><table>
          <thead><tr><th>IBAN</th><th>Moneda</th><th>Estado</th><th>SINPE</th><th class="der">Saldo</th></tr></thead>
          <tbody>${cuentas.map((c) => `
            <tr><td class="mono b">${ibanTxt(c.iban)}</td><td>${c.moneda}</td><td>${chip(c.estado)}</td>
            <td>${(c.numeros || []).length ? c.numeros.map(tel).join(', ') : c.moneda !== 'CRC' ? 'No admite' : c.estado !== 'ACTIVA' ? 'No opera' : '—'}</td>
            <td class="der monto">${dinero(c.saldo, c.moneda)}</td></tr>`).join('')
            || '<tr><td colspan="5" class="vacio">Todavía no tiene cuentas en esta entidad.</td></tr>'}</tbody>
        </table></div>
      </div>

      <div class="tarjeta">
        <div class="tarjeta-cab"><h2>Últimos movimientos</h2><a class="enlace" href="/cliente/movimientos.html">Ver todos</a></div>
        <div class="movs">${ultimos.map((m) => {
          const sale = m.movimiento === 'ENVIADA';
          const propia = m.movimiento === 'ENTRE_MIS_CUENTAS';
          const otro = sale ? m.titularDestino : m.titularOrigen;
          const ref = m.tipo === 'SINPE_MOVIL' ? tel(sale ? m.telefonoDestino : m.telefonoOrigen) : ibanCorto(sale ? m.ibanDestino : m.ibanOrigen);
          return `<div class="mov"><span class="ic ${sale ? 'sale' : 'entra'}">${icono(propia ? 'cambio' : sale ? 'flechaArriba' : 'flechaAbajo', 18)}</span>
            <div class="crece"><div class="b">${propia ? 'Entre mis cuentas' : `${m.tipo === 'SINPE_MOVIL' ? 'SINPE' : 'IBAN'} ${sale ? 'a' : 'de'} ${esc(otro)}`}</div>
            <div class="small muted">${fecha(m.fecha, false).slice(0, 5)} · ${ref}</div></div>
            <span class="monto">${propia ? '' : sale ? '−' : '+'}${dinero(m.monto, m.moneda)}</span></div>`;
        }).join('') || '<div class="vacio">No hay movimientos en los últimos 30 días.</div>'}</div>
      </div>

      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <a class="boton" href="/cliente/sinpe.html" style="text-decoration:none">Transferir SINPE Móvil</a>
        <a class="boton sec" href="/cliente/iban.html" style="text-decoration:none">Transferir por IBAN</a>
      </div>
    </div>`;
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

/* ------------------------------ Admin: Inicio ------------------------------ */
async function adminInicio() {
  const sesion = await iniciarPagina('Inicio', (s) => `Hola, ${s.nombre.split(' ')[0]}`);
  const vista = document.getElementById('vista');
  const [clientes, cuentas, afiliaciones, movs] = await Promise.all([
    pedir('/clientes'), pedir('/cuentas'), pedir('/afiliaciones'), pedir(`/movimientos?${new URLSearchParams(ultimos30())}`)
  ]);
  const cuenta = (e) => cuentas.filter((c) => c.estado === e).length;
  const activos = clientes.filter((c) => c.estado === 'ACTIVO').length;
  const f = { q: '', por: 'todos' };

  vista.innerHTML = `
    <div class="pila">
      <div class="rejilla rejilla-4">
        <div class="tarjeta kpi"><div class="etq">Clientes de la entidad</div><div class="valor">${clientes.length}</div>
          <div class="small muted">${activos} activos · ${clientes.length - activos} inactivos</div></div>
        <div class="tarjeta kpi"><div class="etq">Cuentas IBAN</div><div class="valor">${cuentas.length}</div>
          <div class="small muted">${cuenta('BLOQUEADA')} bloqueadas · ${cuenta('INACTIVA')} inactivas</div></div>
        <div class="tarjeta kpi"><div class="etq">Números afiliados a SINPE</div><div class="valor">${afiliaciones.length}</div>
          <div class="small muted">en ${esc(sesion.entidad)}</div></div>
        <div class="tarjeta kpi"><div class="etq">Movimientos del período</div><div class="valor">${movs.length}</div>
          <div class="small muted">últimos 30 días</div></div>
      </div>

      <div class="tarjeta">
        <div class="tarjeta-cab"><h2>Afiliaciones vigentes</h2><span class="small muted" id="conteo"></span></div>
        <div class="filtros">
          <div class="buscador crece"><input class="entrada" id="q" type="search" placeholder="Buscar por titular, teléfono o número de cuenta" aria-label="Buscar afiliación"></div>
          ${segmentado('seg', [['todos', 'Todos'], ['tit', 'Titular'], ['num', 'Teléfono'], ['cta', 'Cuenta']], 'todos')}
        </div>
        <div class="tabla-caja"><table>
          <thead><tr><th>Número</th><th>Titular</th><th>Identificación</th><th>Cuenta</th><th>Desde</th><th>Estado</th><th class="der">Acción</th></tr></thead>
          <tbody id="filas"></tbody></table></div>
      </div>

      <div class="tarjeta">
        <h2 style="margin-bottom:16px">Acciones rápidas</h2>
        <div class="rejilla rejilla-4" style="gap:12px">
          ${[['clientes', 'Registrar cliente', `Nuevo cliente de ${sesion.entidad}`], ['cuentas', 'Abrir cuenta IBAN', 'En colones o dólares'],
             ['telefonos', 'Registrar teléfono', 'A nombre de un cliente'], ['afiliaciones', 'Afiliar número', 'A SINPE Móvil']]
            .map(([p, t, d]) => `<a class="opcion" href="/admin/${p}.html" style="text-decoration:none;color:inherit">
              <span class="crece"><span class="b" style="color:var(--indigo-oscuro)">${t}</span><br><span class="small muted">${esc(d)}</span></span>
              <span style="color:var(--indigo)">${icono('derecha')}</span></a>`).join('')}
        </div>
      </div>
    </div>`;

  function pintar() {
    const filas = afiliaciones.filter((a) => coincideBusqueda(f.q, f.por, a));
    vista.querySelector('#conteo').textContent = filas.length === afiliaciones.length ? `${filas.length} afiliaciones` : `${filas.length} de ${afiliaciones.length}`;
    vista.querySelector('#filas').innerHTML = filas.map((a) => `
      <tr><td class="mono b">${tel(a.numero)}</td><td>${esc(a.titular)}</td><td class="mono small">${esc(a.identificacion)}</td>
      <td class="mono small">${ibanTxt(a.iban)}</td><td>${fecha(a.fechaAfiliacion, false)}</td><td>${chip('AFILIADO')}</td>
      <td class="der"><a class="boton sec peque" style="text-decoration:none" href="/admin/afiliaciones.html?cliente=${a.idCliente}">Ver</a></td></tr>`).join('')
      || '<tr><td colspan="7" class="vacio">Ninguna afiliación coincide con la búsqueda.</td></tr>';
  }
  vista.querySelector('#q').oninput = (e) => { f.q = e.target.value; pintar(); };
  enganchar(vista, 'seg', (v) => { f.por = v; pintar(); });
  pintar();
}

function coincideBusqueda(q, por, { titular, identificacion, numero, iban }) {
  if (!q) return true;
  const qn = norm(q), qd = digitos(q), qi = q.replace(/\s/g, '').toUpperCase();
  const tit = norm(titular).includes(qn) || (qd && digitos(identificacion).includes(qd));
  const num = qd && String(numero).includes(qd);
  const cta = qi.length >= 3 && String(iban).includes(qi);
  return por === 'tit' ? tit : por === 'num' ? num : por === 'cta' ? cta : tit || num || cta;
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
