// Persona 2: Cuentas IBAN y teléfonos.
// Rutas que usa (ver docs/API.md):
//   GET  /api/cuentas            GET /api/cuentas/iban-sugerido     POST /api/cuentas
//   PUT  /api/cuentas/:iban/estado
//   GET  /api/telefonos          POST /api/telefonos
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
          <label class="campo">IBAN (con el código de la entidad)
            <div style="display:flex;gap:8px"><input class="entrada mono" id="iban" readonly>
            <button type="button" class="boton sec peque" id="otro" title="Generar otro IBAN" aria-label="Generar otro IBAN">↻</button></div></label>
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
  const nuevoIban = async () => {
    try { $('iban').value = ibanTxt((await pedir('/cuentas/iban-sugerido')).iban); } catch (err) { toast(err.message, 'error'); }
  };

  function pintar() {
    const filas = lista.filter((c) => coincideFiltro(f.q, f.por, c));
    $('conteo').textContent = conteo(filas.length, lista.length, 'cuentas');
    $('filas').innerHTML = filas.map((c) => {
      const [estado, texto, clase] = c.estado === 'ACTIVA' ? ['BLOQUEADA', 'Bloquear', 'peligro'] : c.estado === 'BLOQUEADA' ? ['ACTIVA', 'Desbloquear', 'sec'] : ['ACTIVA', 'Activar', 'sec'];
      return `<tr><td class="mono small b">${ibanTxt(c.iban)}</td><td class="nw">${esc(c.titular)}</td>
        <td class="mono small">${(c.numeros || []).length ? c.numeros.map(tel).join('<br>') : '—'}</td>
        <td class="nw">${fecha(c.fechaApertura, false)}</td><td>${chip(c.estado)}</td>
        <td class="der monto nw">${dinero(c.saldo, c.moneda)}<div class="small muted" style="font-weight:500">${c.moneda === 'CRC' ? 'Colones' : 'Dólares'}</div></td>
        <td class="der"><button class="boton ${clase} peque" data-estado="${estado}" data-iban="${c.iban}">${texto}</button></td></tr>`;
    }).join('') || '<tr><td colspan="7" class="vacio">Ninguna cuenta coincide con la búsqueda.</td></tr>';

    vista.querySelectorAll('[data-estado]').forEach((b) => (b.onclick = () => {
      const verbo = b.textContent.trim().toLowerCase();
      const m = modal(`<h2>¿Desea ${verbo} la cuenta?</h2><p class="mono">${ibanTxt(b.dataset.iban)}</p>
        <div class="form-pie"><button class="boton sec" id="no">Cancelar</button><button class="boton" id="si">Sí, ${verbo}</button></div>`);
      m.querySelector('#no').onclick = () => m.remove();
      m.querySelector('#si').onclick = async () => {
        try {
          await pedir(`/cuentas/${b.dataset.iban}/estado`, 'PUT', { estado: b.dataset.estado });
          m.remove(); toast('Estado de la cuenta actualizado');
          lista = await pedir('/cuentas'); pintar();
        } catch (err) { toast(err.message, 'error'); }
      };
    }));
  }

  buscadorClientes($('titular'), titulares, { alElegir: (c) => { nueva.idCliente = c.idCliente; } });
  $('titular').addEventListener('input', () => { nueva.idCliente = null; });
  enganchar(vista, 'seg-moneda', (v) => { nueva.moneda = v; });
  $('otro').onclick = nuevoIban;
  $('nueva').onsubmit = async (e) => {
    e.preventDefault();
    if (!nueva.idCliente) { toast('Elija el titular de la lista', 'error'); $('titular').focus(); return; }
    const iban = $('iban').value.replace(/\s/g, '');
    try {
      await pedir('/cuentas', 'POST', {
        idCliente: nueva.idCliente, moneda: nueva.moneda, iban, saldo: montoNumero($('saldo').value), fechaApertura: $('fecha').value
      });
      toast(`Cuenta ${ibanTxt(iban)} registrada`);
      $('titular').value = ''; nueva.idCliente = null; $('saldo').value = '0';
      await nuevoIban();
      lista = await pedir('/cuentas'); pintar();
    } catch (err) { toast(err.message, 'error'); }
  };
  $('q').oninput = (e) => { f.q = e.target.value; pintar(); };
  enganchar(vista, 'seg', (v) => { f.por = v; pintar(); });
  await nuevoIban();
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
