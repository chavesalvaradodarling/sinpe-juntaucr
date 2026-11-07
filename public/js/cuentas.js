// Persona 2: Cuentas IBAN y teléfonos.
// Rutas que usa (ver docs/API.md):
//   GET  /api/resumen (Inicio de cliente y admin)
//   GET  /api/cuentas (admin)     GET /api/mis-cuentas (cliente)    POST /api/cuentas
//   PATCH /api/cuentas/:id/estado
//   GET  /api/telefonos           POST /api/telefonos
//   GET  /api/clientes (buscador de titular del admin, Persona 1)

// Coincidencia de los buscadores de tablas: Todos / Titular / Teléfono / Cuenta
function coincideFiltro(q, por, { titular, identificacion, numeros = [], iban = '' }) {
  if (!q) return true;
  const qn = norm(q), qd = digitos(q), qi = q.replace(/\s/g, '').toUpperCase();
  const tit = norm(titular).includes(qn) || (qd && digitos(identificacion).includes(qd));
  const num = qd && numeros.some((n) => n.includes(qd));
  const cta = qi.length >= 3 && iban.includes(qi);
  return por === 'tit' ? tit : por === 'num' ? num : por === 'cta' ? cta : tit || num || cta;
}

const conteo = (n, total, palabra) => (n === total ? `${total} ${palabra}` : `${n} de ${total}`);

/* ---------------------------- Admin: Cuentas IBAN ---------------------------- */
async function adminCuentas() {
  const sesion = await iniciarPagina('Clientes y cuentas', 'Cuentas IBAN');
  const vista = document.getElementById('vista');
  const titulares = (await pedir('/clientes')).filter((c) => c.estado === 'ACTIVO');
  let lista = await pedir('/cuentas');
  const f = { q: '', por: 'todos' };
  const nueva = { idCliente: null, moneda: 'CRC' };

  vista.innerHTML = `
    <div class="pila">
      <form class="tarjeta" id="nueva" novalidate>
        <div class="tarjeta-cab"><h2>Abrir cuenta IBAN</h2><span class="small muted">Solo el banco abre cuentas</span></div>
        <div class="form-fila">
          <label class="campo">Entidad financiera<input class="entrada" value="${esc(sesion.entidad)} · ${esc(sesion.codigo)} (de la sesión)" readonly></label>
          <div class="campo"><span>Titular</span><div class="buscador"><input class="entrada" id="titular" type="search" autocomplete="off"
            placeholder="Nombre o identificación" aria-label="Titular"></div></div>
          <div class="campo"><span>Moneda</span>${segmentado('seg-moneda', [['CRC', 'CRC · Colones'], ['USD', 'USD · Dólares']], 'CRC')}</div>
        </div>
        <div class="form-fila" style="margin-top:14px">
          <label class="campo">IBAN<input class="entrada" value="Se genera al registrar" title="22 caracteres con el código ${esc(sesion.codigo)} de la entidad" readonly></label>
          <label class="campo">Saldo inicial<input class="entrada" id="saldo" inputmode="decimal" value="0"></label>
          <label class="campo">Fecha de apertura<input class="entrada" type="date" id="fecha" value="${hoyISO()}"></label>
        </div>
        <div class="form-pie"><button class="boton">Registrar cuenta</button></div>
      </form>

      <div class="tarjeta">
        <div class="tarjeta-cab"><h2>Cuentas de ${esc(sesion.entidad)}</h2><span class="small muted" id="conteo"></span></div>
        <div class="filtros">
          <div class="buscador crece"><input class="entrada" id="q" type="search" placeholder="Buscar por titular, teléfono o número de cuenta" aria-label="Buscar cuenta"></div>
          ${segmentado('seg', [['todos', 'Todos'], ['tit', 'Titular'], ['num', 'Teléfono'], ['cta', 'Cuenta']], 'todos')}
        </div>
        <div class="tabla-caja"><table class="compacta">
          <thead><tr><th>IBAN</th><th>Titular</th><th>Teléfono SINPE</th><th>Apertura</th><th>Estado</th><th class="der">Saldo</th><th class="der">Acciones</th></tr></thead>
          <tbody id="filas"></tbody></table></div>
      </div>
    </div>`;

  const $ = (id) => vista.querySelector(`#${id}`);

  function pintar() {
    const filas = lista.filter((c) => coincideFiltro(f.q, f.por, c));
    $('conteo').textContent = conteo(filas.length, lista.length, 'cuentas');
    $('filas').innerHTML = filas.map((c) => {
      const [estado, texto, clase] = c.estado === 'ACTIVA' ? ['BLOQUEADA', 'Bloquear', 'peligro'] : c.estado === 'BLOQUEADA' ? ['ACTIVA', 'Desbloquear', 'sec'] : ['ACTIVA', 'Activar', 'sec'];
      return `<tr><td class="mono small b">${ibanTxt(c.iban)}</td><td class="nw">${esc(c.titular)}</td>
        <td class="mono small">${(c.numeros || []).length ? c.numeros.map(tel).join('<br>') : '—'}</td>
        <td class="nw">${fecha(c.fechaApertura, false)}</td><td>${chip(c.estado)}</td>
        <td class="der monto nw">${dinero(c.saldo, c.moneda)}<div class="small muted" style="font-weight:500">${c.moneda === 'CRC' ? 'Colones' : 'Dólares'}</div></td>
        <td class="der"><button class="boton ${clase} peque" data-estado="${estado}" data-id="${c.idCuenta}" data-iban="${c.iban}">${texto}</button></td></tr>`;
    }).join('') || '<tr><td colspan="7" class="vacio">Ninguna cuenta coincide con la búsqueda.</td></tr>';

    vista.querySelectorAll('[data-estado]').forEach((b) => (b.onclick = () => {
      const verbo = b.textContent.trim().toLowerCase();
      const m = modal(`<h2>¿Desea ${verbo} la cuenta?</h2><p class="mono">${ibanTxt(b.dataset.iban)}</p>
        <div class="form-pie"><button class="boton sec" id="no">Cancelar</button><button class="boton" id="si">Sí, ${verbo}</button></div>`);
      m.querySelector('#no').onclick = () => m.remove();
      m.querySelector('#si').onclick = async () => {
        try {
          await pedir(`/cuentas/${b.dataset.id}/estado`, 'PATCH', { estado: b.dataset.estado });
          m.remove(); toast('Estado de la cuenta actualizado');
          lista = await pedir('/cuentas'); pintar();
        } catch (err) { toast(err.message, 'error'); }
      };
    }));
  }

  buscadorClientes($('titular'), titulares, { alElegir: (c) => { nueva.idCliente = c.idCliente; } });
  $('titular').addEventListener('input', () => { nueva.idCliente = null; });
  enganchar(vista, 'seg-moneda', (v) => { nueva.moneda = v; });
  $('nueva').onsubmit = async (e) => {
    e.preventDefault();
    if (!nueva.idCliente) { toast('Elija el titular de la lista', 'error'); $('titular').focus(); return; }
    try {
      const r = await pedir('/cuentas', 'POST', {
        idCliente: nueva.idCliente, moneda: nueva.moneda, saldo: montoNumero($('saldo').value), fechaApertura: $('fecha').value
      });
      toast(`Cuenta ${ibanTxt(r.iban)} registrada`);
      $('titular').value = ''; nueva.idCliente = null; $('saldo').value = '0';
      lista = await pedir('/cuentas'); pintar();
    } catch (err) { toast(err.message, 'error'); }
  };
  $('q').oninput = (e) => { f.q = e.target.value; pintar(); };
  enganchar(vista, 'seg', (v) => { f.por = v; pintar(); });
  pintar();
}

/* ------------------------------ Admin: Teléfonos ------------------------------ */
async function adminTelefonos() {
  const sesion = await iniciarPagina('Clientes y cuentas', 'Teléfonos');
  const vista = document.getElementById('vista');
  const titulares = (await pedir('/clientes')).filter((c) => c.estado === 'ACTIVO');
  let lista = await pedir('/telefonos');
  const f = { q: '', por: 'todos', sinpe: 'todos' };
  let idTitular = null;

  vista.innerHTML = `
    <div class="pila">
      <form class="tarjeta" id="nuevo" novalidate>
        <div class="tarjeta-cab"><h2>Registrar teléfono a un cliente</h2><span class="small muted">8 dígitos · un solo titular por número</span></div>
        <div class="form-fila" style="grid-template-columns:1fr 1fr auto;align-items:end">
          <div class="campo"><span>Titular</span><div class="buscador"><input class="entrada" id="titular" type="search" autocomplete="off"
            placeholder="Nombre o identificación" aria-label="Titular"></div></div>
          <label class="campo">Número celular<input class="entrada mono" id="numero" inputmode="numeric" maxlength="9" placeholder="0000-0000"></label>
          <button class="boton">Registrar teléfono</button>
        </div>
        <p class="small muted" style="margin-top:10px">Registrar no es afiliar: el número queda “no afiliado” hasta que se afilie a una cuenta.</p>
      </form>

      <div class="tarjeta">
        <div class="tarjeta-cab"><h2>Teléfonos de clientes de ${esc(sesion.entidad)}</h2><span class="small muted" id="conteo"></span></div>
        <div class="filtros">
          <div class="buscador crece"><input class="entrada" id="q" type="search" placeholder="Buscar por número o titular" aria-label="Buscar teléfono"></div>
          <select class="entrada" id="sinpe" aria-label="Estado SINPE Móvil" style="width:auto">
            <option value="todos">SINPE Móvil: Todos</option><option value="AFILIADO">Afiliados aquí</option>
            <option value="NO_AFILIADO">No afiliados</option><option value="AFILIADO_OTRA">Afiliados en otra entidad</option>
          </select>
          ${segmentado('seg', [['todos', 'Todos'], ['num', 'Número'], ['tit', 'Titular']], 'todos')}
        </div>
        <div class="tabla-caja"><table>
          <thead><tr><th>Número</th><th>Titular</th><th>Registro</th><th>SINPE Móvil</th><th>Cuenta afiliada</th><th class="der">Acción</th></tr></thead>
          <tbody id="filas"></tbody></table></div>
      </div>
    </div>`;

  const $ = (id) => vista.querySelector(`#${id}`);
  function pintar() {
    const filas = lista.filter((t) => (f.sinpe === 'todos' || t.estado === f.sinpe) &&
      coincideFiltro(f.q, f.por, { titular: t.titular, identificacion: t.identificacion, numeros: [t.numero] }));
    $('conteo').textContent = conteo(filas.length, lista.length, 'teléfonos');
    $('filas').innerHTML = filas.map((t) => `
      <tr><td class="mono b">${tel(t.numero)}</td><td>${esc(t.titular)}</td><td>${fecha(t.fechaRegistro, false)}</td>
      <td>${chip(t.estado)}</td>
      <td class="${t.estado === 'AFILIADO' ? 'mono small' : 'small'}">${t.estado === 'AFILIADO' ? ibanTxt(t.iban) : t.estado === 'AFILIADO_OTRA' ? `Cuenta en ${esc(t.entidad)}` : '—'}</td>
      <td class="der"><a class="boton sec peque" style="text-decoration:none" href="/admin/afiliaciones.html?cliente=${t.idCliente}">${t.estado === 'NO_AFILIADO' ? 'Afiliar' : 'Ver afiliación'}</a></td></tr>`).join('')
      || '<tr><td colspan="6" class="vacio">Ningún teléfono coincide con la búsqueda.</td></tr>';
  }

  buscadorClientes($('titular'), titulares, { alElegir: (c) => { idTitular = c.idCliente; } });
  $('titular').addEventListener('input', () => { idTitular = null; });
  mascaraTelefono($('numero'));
  $('nuevo').onsubmit = async (e) => {
    e.preventDefault();
    if (!idTitular) { toast('Elija el titular de la lista', 'error'); $('titular').focus(); return; }
    try {
      await pedir('/telefonos', 'POST', { idCliente: idTitular, numero: digitos($('numero').value) });
      toast(`Teléfono ${$('numero').value} registrado. Aún no está afiliado a SINPE Móvil.`);
      $('numero').value = '';
      lista = await pedir('/telefonos'); pintar();
    } catch (err) { toast(err.message, 'error'); }
  };
  $('q').oninput = (e) => { f.q = e.target.value; pintar(); };
  $('sinpe').onchange = (e) => { f.sinpe = e.target.value; pintar(); };
  enganchar(vista, 'seg', (v) => { f.por = v; pintar(); });
  pintar();
}

/* ---------------------------- Cliente: Mis teléfonos ---------------------------- */
async function clienteTelefonos() {
  const sesion = await iniciarPagina('Mi perfil', 'Mis teléfonos');
  const vista = document.getElementById('vista');

  async function pintar() {
    const lista = await pedir('/telefonos');
    vista.innerHTML = `
      <div class="pila">
        <form class="tarjeta" id="f" novalidate>
          <div class="tarjeta-cab"><h2>Registrar un número a mi nombre</h2><span class="small muted">Exactamente 8 dígitos</span></div>
          <div class="form-fila" style="grid-template-columns:1fr 1fr auto;align-items:end">
            <label class="campo">Titular<input class="entrada" value="${esc(sesion.nombre)} (usted)" readonly></label>
            <label class="campo">Número celular<input class="entrada mono" id="numero" inputmode="numeric" maxlength="9" placeholder="0000-0000"></label>
            <button class="boton">Registrar teléfono</button>
          </div>
        </form>
        <div class="tarjeta">
          <div class="tarjeta-cab"><h2>Mis números registrados</h2><a class="enlace" href="/cliente/afiliacion.html">Afiliar un número</a></div>
          <div class="tabla-caja"><table>
            <thead><tr><th>Número</th><th>Registro</th><th>SINPE Móvil</th><th>Cuenta afiliada</th></tr></thead>
            <tbody>${lista.map((t) => `
              <tr><td class="mono b">${tel(t.numero)}</td><td>${fecha(t.fechaRegistro, false)}</td><td>${chip(t.estado)}</td>
              <td class="${t.estado === 'AFILIADO' ? 'mono small' : 'small'}">${t.estado === 'AFILIADO' ? ibanTxt(t.iban) : t.estado === 'AFILIADO_OTRA' ? `Cuenta en ${esc(t.entidad)}` : '—'}</td></tr>`).join('')
              || '<tr><td colspan="4" class="vacio">No tiene teléfonos registrados.</td></tr>'}</tbody>
          </table></div>
        </div>
      </div>`;

    const num = vista.querySelector('#numero');
    mascaraTelefono(num);
    vista.querySelector('#f').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await pedir('/telefonos', 'POST', { numero: digitos(num.value) });
        toast(`Teléfono ${num.value} registrado. Para usarlo en SINPE Móvil, afílielo.`);
        pintar();
      } catch (err) { toast(err.message, 'error'); }
    };
  }
  await pintar();
}

// Las dos pantallas de Inicio leen un solo resumen (GET /api/resumen);
// la ruta devuelve una forma distinta según el rol (ver docs/API.md).

/* ---------------------------- Cliente: Inicio ---------------------------- */
async function clienteInicio() {
  const sesion = await iniciarPagina('Inicio', (s) => `Hola, ${s.nombre.split(' ')[0]}`);
  const vista = document.getElementById('vista');
  const r = await pedir('/resumen');
  const cuentas = r.cuentas;
  const activas = (m) => cuentas.filter((c) => c.moneda === m && c.estado === 'ACTIVA');
  const saldo = (m) => activas(m).reduce((t, c) => t + Number(c.saldo), 0);
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const afiliados = r.telefonos.afiliados;
  const ultimos = r.ultimos;

  vista.innerHTML = `
    <div class="pila">
      <div class="rejilla rejilla-3">
        <div class="tarjeta kpi"><div class="etq">Saldo en colones</div><div class="valor">${dinero(saldo('CRC'))}</div>
          <div class="small muted">${plural(activas('CRC').length, 'cuenta activa', 'cuentas activas')}</div></div>
        <div class="tarjeta kpi"><div class="etq">Saldo en dólares</div><div class="valor">${dinero(saldo('USD'), 'USD')}</div>
          <div class="small muted">${plural(activas('USD').length, 'cuenta activa', 'cuentas activas')}</div></div>
        <div class="tarjeta kpi"><div class="etq">Mis números SINPE Móvil</div><div class="valor">${afiliados} de ${r.telefonos.total}</div>
          <div class="small muted">${plural(r.telefonos.total - afiliados, 'número sin afiliar aquí', 'números sin afiliar aquí')}</div></div>
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
        }).join('') || '<div class="vacio">Todavía no hay movimientos.</div>'}</div>
      </div>

      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <a class="boton" href="/cliente/sinpe.html" style="text-decoration:none">Transferir SINPE Móvil</a>
        <a class="boton sec" href="/cliente/iban.html" style="text-decoration:none">Transferir por IBAN</a>
      </div>
    </div>`;
}

/* ------------------------------ Admin: Inicio ------------------------------ */
async function adminInicio() {
  const sesion = await iniciarPagina('Inicio', (s) => `Hola, ${s.nombre.split(' ')[0]}`);
  const vista = document.getElementById('vista');
  const r = await pedir('/resumen');
  const afiliaciones = r.afiliaciones;
  const f = { q: '', por: 'todos' };

  vista.innerHTML = `
    <div class="pila">
      <div class="rejilla rejilla-4">
        <div class="tarjeta kpi"><div class="etq">Clientes de la entidad</div><div class="valor">${r.clientes.activos + r.clientes.inactivos}</div>
          <div class="small muted">${r.clientes.activos} activos · ${r.clientes.inactivos} inactivos</div></div>
        <div class="tarjeta kpi"><div class="etq">Cuentas IBAN</div><div class="valor">${r.cuentas.total}</div>
          <div class="small muted">${r.cuentas.bloqueadas} bloqueadas · ${r.cuentas.inactivas} inactivas</div></div>
        <div class="tarjeta kpi"><div class="etq">Números afiliados a SINPE</div><div class="valor">${r.numerosAfiliados}</div>
          <div class="small muted">en ${esc(sesion.entidad)}</div></div>
        <div class="tarjeta kpi"><div class="etq">Movimientos del período</div><div class="valor">${r.movimientosPeriodo}</div>
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
    const filas = afiliaciones.filter((a) => coincideFiltro(f.q, f.por, { ...a, numeros: [a.numero] }));
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
