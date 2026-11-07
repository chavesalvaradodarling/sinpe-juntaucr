// Persona 4: Transferir SINPE Móvil, Transferir por IBAN y Movimientos.
// Rutas que usa (ver docs/API.md):
//   GET  /api/transferencias/origenes            GET /api/transferencias/destino-sinpe/:numero
//   POST /api/transferencias/sinpe               GET /api/transferencias/destino-iban/:iban
//   POST /api/transferencias/iban                GET /api/movimientos?desde=&hasta=[&iban=|&idCliente=]
//   GET  /api/cuentas (origen IBAN y filtro)     GET /api/clientes (filtro del admin)

/* ------------------------ Comprobante y rechazo ------------------------ */
function verComprobante(vista, t, otraVez) {
  const esSinpe = t.tipo === 'SINPE_MOVIL';
  const conversion = t.monedaDestino && t.monedaDestino !== t.moneda
    ? `<div class="small" style="margin-top:12px"><span class="muted">Monto acreditado:</span> ${dinero(t.montoDestino, t.monedaDestino)}
       ${t.tipoCambio ? ` · tipo de cambio ${dinero(t.tipoCambio)}` : ''}</div>` : '';
  vista.innerHTML = `
    <div class="centro">
      <div class="comprobante-cab">
        <div class="check">${icono('check', 28)}</div>
        <div class="b" style="font-size:20px">Transferencia enviada</div>
        <div class="total">${dinero(t.monto, t.moneda)}</div>
        <div class="small" style="opacity:.85">${fecha(t.fecha)} · Referencia ${String(t.idTransferencia).padStart(6, '0')} · ${esSinpe ? 'SINPE Móvil' : 'IBAN'}</div>
      </div>
      <div class="comprobante-cuerpo">
        <div class="form-fila">
          <div><div class="small muted">Desde</div><div class="mono b small">${ibanTxt(t.ibanOrigen)}</div>
            <div class="small">${esc(t.entidadOrigen)}${esSinpe ? ` · ${tel(t.telefonoOrigen)}` : ''}</div></div>
          <div><div class="small muted">Para</div><div class="b">${esc(t.titularDestino)}</div>
            <div class="small">${esSinpe ? tel(t.telefonoDestino) : `<span class="mono">${ibanTxt(t.ibanDestino)}</span>`} · ${esc(t.entidadDestino)}</div></div>
        </div>
        ${t.detalle ? `<div class="small" style="margin-top:12px"><span class="muted">Detalle:</span> ${esc(t.detalle)}</div>` : ''}
        ${conversion}
        <div style="background:#fbf6f6;border-radius:12px;padding:14px 16px;margin-top:16px">
          <div class="b" style="margin-bottom:6px">Saldo de su cuenta</div>
          <div style="display:flex;justify-content:space-between"><span>Antes</span><span>${dinero(t.saldoAntes, t.moneda)}</span></div>
          <div style="display:flex;justify-content:space-between"><span>Después</span><span class="b">${dinero(t.saldoDespues, t.moneda)}</span></div>
        </div>
        <div class="form-pie">
          <a class="boton sec" href="/cliente/inicio.html" style="text-decoration:none">Volver al inicio</a>
          <button class="boton" id="otra">Hacer otra</button>
          <a class="boton sec" href="/cliente/movimientos.html" style="text-decoration:none">Ver mis movimientos</a>
        </div>
      </div>
    </div>`;
  vista.querySelector('#otra').onclick = otraVez;
}

function verRechazo(vista, mensaje, corregir) {
  vista.innerHTML = `
    <div class="centro tarjeta" style="text-align:center">
      <div class="cruz">×</div>
      <h2>Transferencia rechazada</h2>
      <p class="muted">No se realizó ningún cargo. Todos los cambios de la operación se revirtieron.</p>
      <div class="motivo" style="text-align:left"><div class="small b" style="letter-spacing:.06em">MOTIVO</div>
        <div class="b">${esc(mensaje)}</div></div>
      <div class="form-pie" style="justify-content:center">
        <a class="boton sec" href="/cliente/inicio.html" style="text-decoration:none">Volver al inicio</a>
        <button class="boton" id="corregir">Corregir datos</button>
      </div>
    </div>`;
  vista.querySelector('#corregir').onclick = corregir;
}

/* ----------------------------- SINPE Móvil ----------------------------- */
// El cliente elige la CUENTA origen, pero solo aparecen cuentas con número
// afiliado y cada opción lleva su número: así el backend recibe el teléfono
// origen que pide el enunciado (2.8) sin cambiar el procedimiento.
async function clienteSinpe() {
  const sesion = await iniciarPagina('SINPE Móvil', 'Transferencia SINPE Móvil');
  const vista = document.getElementById('vista');
  let origenes = await pedir('/transferencias/origenes');
  const datos = { origen: origenes[0]?.numero || '', monto: '', destino: '', detalle: '' };

  function formulario() {
    if (!origenes.length) {
      vista.innerHTML = `<div class="centro tarjeta vacio">No tiene cuentas con un número SINPE afiliado en ${esc(sesion.entidad)}.<br>
        <a class="enlace" href="/cliente/afiliacion.html">Afiliar un número</a></div>`;
      return;
    }
    vista.innerHTML = `
      <form class="centro tarjeta" id="f" novalidate>
        <label class="campo">Cuenta origen
          <select class="entrada" id="origen">${origenes.map((o) => `
            <option value="${o.numero}" ${o.numero === datos.origen ? 'selected' : ''}>
              ${ibanTxt(o.iban)} · SINPE ${tel(o.numero)} · disponible ${dinero(o.saldo)}</option>`).join('')}</select></label>
        <div class="small muted" style="margin-top:6px">Solo cuentas con un número SINPE afiliado en ${esc(sesion.entidad)}</div>
        <label class="campo" style="margin-top:18px">Monto (CRC)
          <input class="entrada grande" id="monto" inputmode="decimal" placeholder="0,00" value="${esc(datos.monto)}" required></label>
        <label class="campo" style="margin-top:18px">Número destino
          <input class="entrada mono" id="destino" inputmode="numeric" maxlength="9" placeholder="0000-0000" value="${esc(datos.destino)}" required></label>
        <div id="persona" style="margin-top:12px"></div>
        <label class="campo" style="margin-top:18px"><span>Detalle <span class="muted small" style="font-weight:500">(opcional)</span></span>
          <input class="entrada" id="detalle" maxlength="100" placeholder="Ej. Almuerzo" value="${esc(datos.detalle)}"></label>
        <button class="boton ancho" style="margin-top:22px" id="enviar">Transferir</button>
      </form>`;

    const $ = (id) => vista.querySelector(`#${id}`);
    const actualizarBoton = () => {
      const m = montoNumero($('monto').value);
      $('enviar').textContent = m > 0 ? `Transferir ${dinero(m)}` : 'Transferir';
    };
    const buscarDestino = async () => {
      const n = digitos($('destino').value);
      $('destino').value = n.length > 4 ? `${n.slice(0, 4)}-${n.slice(4, 8)}` : n;
      if (n.length !== 8) { $('persona').innerHTML = ''; return; }
      try {
        const d = await pedir(`/transferencias/destino-sinpe/${n}`);
        $('persona').innerHTML = `<div class="persona"><span class="avatar claro peque">${esc(iniciales(d.titular))}</span>
          <div class="crece"><div class="b">${esc(d.titular)}</div>
          <div class="small">${d.afiliado ? `${esc(d.entidad)} · cuenta ${ibanCorto(d.iban)}` : 'Este número no está afiliado a SINPE Móvil'}</div></div>
          ${d.afiliado ? chip('AFILIADO') : chip('NO_AFILIADO')}</div>`;
      } catch (err) {
        $('persona').innerHTML = `<div class="aviso error">${esc(err.message)}</div>`;
      }
    };
    $('monto').oninput = actualizarBoton;
    $('destino').oninput = buscarDestino;
    actualizarBoton();
    if (datos.destino) buscarDestino();

    $('f').onsubmit = async (e) => {
      e.preventDefault();
      Object.assign(datos, { origen: $('origen').value, monto: $('monto').value, destino: $('destino').value, detalle: $('detalle').value });
      $('enviar').disabled = true;
      try {
        const t = await pedir('/transferencias/sinpe', 'POST', {
          numeroOrigen: datos.origen, numeroDestino: digitos(datos.destino), monto: montoNumero(datos.monto), detalle: datos.detalle
        });
        verComprobante(vista, t, async () => {
          Object.assign(datos, { monto: '', destino: '', detalle: '' });
          origenes = await pedir('/transferencias/origenes');
          formulario();
        });
      } catch (err) {
        verRechazo(vista, err.message, formulario);
      }
    };
  }
  formulario();
}

/* ------------------------- Transferencia por IBAN ------------------------- */
async function clienteIban() {
  const sesion = await iniciarPagina('Cuentas', 'Transferencia por IBAN');
  const vista = document.getElementById('vista');
  let cuentas = await pedir('/cuentas');
  const datos = { origen: '', tipo: 'terceros', propia: '', tercero: '', monto: '', detalle: '' };

  function formulario() {
    const activas = cuentas.filter((c) => c.estado === 'ACTIVA');
    if (!activas.length) {
      vista.innerHTML = '<div class="centro tarjeta vacio">No tiene cuentas activas en esta entidad.</div>';
      return;
    }
    if (!activas.some((c) => c.iban === datos.origen)) datos.origen = activas[0].iban;
    const origen = cuentas.find((c) => c.iban === datos.origen);
    const propias = cuentas.filter((c) => c.iban !== datos.origen);

    vista.innerHTML = `
      <form class="centro tarjeta" id="f" novalidate>
        <h2>Nueva transferencia por IBAN</h2>
        <p class="small muted" style="margin:4px 0 20px">Sale de una de sus cuentas de ${esc(sesion.entidad)}.</p>

        <div class="seccion"><div class="paso"><span class="num">1</span>Cuenta origen</div>
          <select class="entrada" id="origen">${cuentas.map((c) => `
            <option value="${c.iban}" ${c.iban === datos.origen ? 'selected' : ''} ${c.estado !== 'ACTIVA' ? 'disabled' : ''}>
              ${ibanTxt(c.iban)} · ${c.moneda === 'CRC' ? 'Colones' : 'Dólares'} · ${c.estado === 'ACTIVA' ? `disponible ${dinero(c.saldo, c.moneda)}` : c.estado.toLowerCase()}</option>`).join('')}
          </select></div>

        <div class="seccion">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
            <div class="paso" style="margin:0"><span class="num">2</span>Cuenta destino</div>
            ${segmentado('seg-tipo', [['propias', 'Propias'], ['terceros', 'Terceros']], datos.tipo)}
          </div>
          ${datos.tipo === 'propias'
            ? `<select class="entrada" id="propia">${propias.map((c) => `
                <option value="${c.iban}" ${c.iban === datos.propia ? 'selected' : ''}>${ibanTxt(c.iban)} · ${c.moneda} · ${c.estado.toLowerCase()}</option>`).join('')
                || '<option value="">No tiene otras cuentas</option>'}</select>`
            : `<input class="entrada mono" id="tercero" maxlength="27" placeholder="CR00 0000 0000 0000 0000 00" value="${esc(datos.tercero)}" aria-label="IBAN destino">
               <div id="titular" style="margin-top:10px"></div>`}
        </div>

        <div class="seccion"><div class="paso"><span class="num">3</span>Monto (${origen.moneda})</div>
          <input class="entrada grande" id="monto" inputmode="decimal" placeholder="0,00" value="${esc(datos.monto)}" aria-label="Monto">
          <label class="campo" style="margin-top:16px"><span>Detalle <span class="muted small" style="font-weight:500">(opcional)</span></span>
            <input class="entrada" id="detalle" maxlength="100" value="${esc(datos.detalle)}"></label>
          <button class="boton ancho" style="margin-top:22px" id="enviar">Transferir</button>
        </div>
      </form>`;

    const $ = (id) => vista.querySelector(`#${id}`);
    const guardar = () => {
      datos.origen = $('origen').value; datos.monto = $('monto').value; datos.detalle = $('detalle').value;
      if ($('propia')) datos.propia = $('propia').value;
      if ($('tercero')) datos.tercero = $('tercero').value;
    };
    const actualizarBoton = () => {
      const m = montoNumero($('monto').value);
      $('enviar').textContent = m > 0 ? `Transferir ${dinero(m, origen.moneda)}` : 'Transferir';
    };
    const buscarTitular = async () => {
      const limpio = $('tercero').value.replace(/\s/g, '').toUpperCase();
      $('tercero').value = limpio.replace(/(.{4})/g, '$1 ').trim();
      if (limpio.length !== 22) { $('titular').innerHTML = ''; return; }
      try {
        const d = await pedir(`/transferencias/destino-iban/${limpio}`);
        $('titular').innerHTML = `<div class="persona"><span class="avatar claro peque">${esc(iniciales(d.titular))}</span>
          <div class="crece"><div class="b">${esc(d.titular)}</div><div class="small">${esc(d.entidad)} · ${d.moneda === 'CRC' ? 'Colones' : 'Dólares'}</div></div>
          ${chip(d.estado)}</div>`;
      } catch (err) {
        $('titular').innerHTML = `<div class="aviso error">${esc(err.message)}</div>`;
      }
    };

    $('origen').onchange = () => { guardar(); formulario(); };
    enganchar(vista, 'seg-tipo', (v) => { guardar(); datos.tipo = v; formulario(); });
    $('monto').oninput = actualizarBoton;
    if ($('tercero')) { $('tercero').oninput = buscarTitular; if (datos.tercero) buscarTitular(); }
    actualizarBoton();

    $('f').onsubmit = async (e) => {
      e.preventDefault();
      guardar();
      const destino = (datos.tipo === 'propias' ? datos.propia : datos.tercero).replace(/\s/g, '');
      $('enviar').disabled = true;
      try {
        const t = await pedir('/transferencias/iban', 'POST', {
          ibanOrigen: datos.origen, ibanDestino: destino, monto: montoNumero(datos.monto), detalle: datos.detalle
        });
        verComprobante(vista, t, async () => {
          Object.assign(datos, { monto: '', detalle: '', tercero: '' });
          cuentas = await pedir('/cuentas');
          formulario();
        });
      } catch (err) {
        verRechazo(vista, err.message, formulario);
      }
    };
  }
  formulario();
}

/* ------------------------------ Movimientos ------------------------------ */
async function vistaMovimientos() {
  const esAdmin = document.body.dataset.rol === 'admin';
  const sesion = await iniciarPagina(esAdmin ? 'Consultas' : 'Cuentas', esAdmin ? 'Movimientos de la entidad' : 'Mis movimientos');
  const vista = document.getElementById('vista');

  const opciones = esAdmin
    ? [['', `Todos los clientes de ${sesion.entidad}`], ...(await pedir('/clientes')).map((c) => [c.idCliente, `${c.nombre} · ${c.identificacion}`])]
    : [['', `Todas mis cuentas de ${sesion.entidad}`], ...(await pedir('/cuentas')).map((c) => [c.iban, `${ibanTxt(c.iban)} · ${c.moneda} · ${c.estado.toLowerCase()}`])];

  const d = new Date();
  const inicioMesAnterior = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const iso = (x) => new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  vista.innerHTML = `
    <div class="pila">
      <form class="tarjeta" id="filtro">
        <label class="campo">Filtrar por
          <select class="entrada" id="sel">${opciones.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></label>
        <div class="form-fila" style="margin-top:14px;align-items:end;grid-template-columns:1fr 1fr auto">
          <label class="campo">Desde<input class="entrada" type="date" id="desde" value="${iso(inicioMesAnterior)}" required></label>
          <label class="campo">Hasta<input class="entrada" type="date" id="hasta" value="${hoyISO()}" required></label>
          <button class="boton">Consultar</button>
        </div>
      </form>
      <div class="tarjeta"><div class="tabla-caja"><table class="compacta">
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Origen</th><th>Destino</th><th>Detalle</th><th class="der">Monto</th></tr></thead>
        <tbody id="filas"><tr><td colspan="6" class="cargando">Cargando…</td></tr></tbody></table></div>
        <div id="totales" class="small muted" style="margin-top:12px"></div></div>
    </div>`;

  async function consultar() {
    const sel = vista.querySelector('#sel').value;
    const desde = vista.querySelector('#desde').value;
    const hasta = vista.querySelector('#hasta').value;
    if (desde > hasta) { toast('La fecha inicial no puede ser mayor que la final', 'error'); return; }
    const qs = new URLSearchParams({ desde, hasta });
    if (sel) qs.set(esAdmin ? 'idCliente' : 'iban', sel);
    const tbody = vista.querySelector('#filas');
    try {
      const movimientos = await pedir(`/movimientos?${qs}`);
      tbody.innerHTML = movimientos.map(filaMovimiento(esAdmin)).join('')
        || '<tr><td colspan="6" class="vacio">No hay movimientos en ese período.</td></tr>';
      if (!esAdmin) {
        const suma = (tipo) => movimientos.filter((m) => m.movimiento === tipo && m.moneda === 'CRC').reduce((t, m) => t + Number(m.monto), 0);
        vista.querySelector('#totales').innerHTML =
          `Total enviado: <b>${dinero(suma('ENVIADA'))}</b> · Total recibido: <b>${dinero(suma('RECIBIDA'))}</b> (colones, en el período)`;
      }
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="aviso error">${esc(err.message)}</div></td></tr>`;
    }
  }

  vista.querySelector('#filtro').onsubmit = (e) => { e.preventDefault(); consultar(); };
  consultar();
}

const ladoMovimiento = (titular, iban, codigo, telefono) =>
  `<div>${esc(titular)}</div><div class="small muted" style="white-space:nowrap">${ibanCorto(iban)} (${esc(siglas(codigo, ''))})${telefono ? ` · ${tel(telefono)}` : ''}</div>`;

const filaMovimiento = (esAdmin) => (m) => {
  const signo = esAdmin || m.movimiento === 'ENTRE_MIS_CUENTAS' ? '' : m.movimiento === 'ENVIADA' ? '−' : '+';
  return `<tr>
    <td class="nw">${fecha(m.fecha)}<div class="small muted mono">Ref. ${String(m.idTransferencia).padStart(6, '0')}</div></td>
    <td>${chip(m.tipo)}</td>
    <td>${ladoMovimiento(m.titularOrigen, m.ibanOrigen, m.codigoOrigen, m.telefonoOrigen)}</td>
    <td>${ladoMovimiento(m.titularDestino, m.ibanDestino, m.codigoDestino, m.telefonoDestino)}</td>
    <td class="small">${esc(m.detalle || '—')}</td>
    <td class="der monto nw">${signo}${dinero(m.monto, m.moneda)}</td></tr>`;
};
