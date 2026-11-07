// Persona 3: pantallas de Afiliación SINPE Móvil e Historial de afiliaciones
// (las usan el cliente y el administrador; la diferencia la pone el rol).
// Rutas que usa (ver docs/API.md):
//   GET    /api/afiliaciones/ficha[?idCliente=]   POST /api/afiliaciones
//   PUT    /api/afiliaciones/:numero               DELETE /api/afiliaciones/:numero
//   GET    /api/afiliaciones/historial             GET /api/clientes (buscador del admin)

/* =====================================================================
   AFILIACIÓN SINPE MÓVIL · modos: 'afiliar' (por defecto), 'trasladar', 'desafiliar'
   ===================================================================== */
async function vistaAfiliacion() {
  const esAdmin = document.body.dataset.rol === 'admin';
  const sesion = await iniciarPagina('SINPE Móvil', esAdmin ? 'Afiliaciones SINPE Móvil' : 'Afiliación SINPE Móvil');
  const vista = document.getElementById('vista');
  const params = new URLSearchParams(location.search);

  const st = {
    clientes: esAdmin ? (await pedir('/clientes')).filter((c) => c.estado === 'ACTIVO') : [],
    idCliente: esAdmin ? Number(params.get('cliente')) || null : sesion.idCliente,
    busqueda: '', por: 'todos',
    datos: null, modo: 'afiliar', numSel: null, ctaSel: null, numOp: null, ctaNueva: null
  };
  const valida = (c) => c.moneda === 'CRC' && c.estado === 'ACTIVA';
  const ORDEN = { NO_AFILIADO: 0, AFILIADO: 1, AFILIADO_OTRA: 2 };
  const ordenar = (l) => [...l].sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || a.numero.localeCompare(b.numero));
  const afiliadosAqui = () => (st.datos ? st.datos.telefonos.filter((t) => t.estado === 'AFILIADO') : []);
  const extra = () => (esAdmin ? { idCliente: st.idCliente } : {});

  async function cargar() {
    st.datos = st.idCliente ? await pedir(`/afiliaciones/ficha${esAdmin ? `?idCliente=${st.idCliente}` : ''}`) : null;
    st.modo = 'afiliar'; st.numOp = null; st.ctaNueva = null;
    const libres = st.datos ? st.datos.telefonos.filter((t) => t.estado === 'NO_AFILIADO') : [];
    if (!libres.some((t) => t.numero === st.numSel)) st.numSel = libres[0]?.numero || null;
    const validas = st.datos ? st.datos.cuentas.filter(valida) : [];
    if (!validas.some((c) => c.iban === st.ctaSel)) st.ctaSel = validas[0]?.iban || null;
    if (st.datos && esAdmin) st.busqueda = st.datos.cliente.nombre;
  }

  function dibujar() {
    const d = st.datos;
    vista.innerHTML = `
      <div class="pila">
        ${esAdmin ? `
          <div class="tarjeta">
            <h2 style="margin-bottom:14px">Afiliar número a SINPE Móvil</h2>
            <div class="filtros" style="margin:0">
              <div class="buscador"><input class="entrada" id="buscar" type="search" autocomplete="off"
                placeholder="Buscar cliente por titular o número" aria-label="Buscar cliente" value="${esc(st.busqueda)}"></div>
              <select class="entrada" id="por" aria-label="Buscar por">
                ${[['todos', 'Todos'], ['tit', 'Titular'], ['num', 'Número']].map(([v, t]) =>
                  `<option value="${v}" ${st.por === v ? 'selected' : ''}>Buscar por: ${t}</option>`).join('')}
              </select>
            </div>
          </div>` : ''}

        ${!d ? '<div class="tarjeta vacio">Busque un cliente por titular o por número para ver sus teléfonos y cuentas.</div>' : `
        <div class="rejilla rejilla-2">
          <div class="tarjeta">
            <div class="ficha-cab">
              <div class="avatar">${esc(iniciales(d.cliente.nombre))}</div>
              <div style="flex:1"><div class="b" style="font-size:18px">${esc(d.cliente.nombre)}</div>
                <div class="small muted">Identificación <span class="mono">${esc(d.cliente.identificacion)}</span></div></div>
              ${chip(d.cliente.estado)}
            </div>
            <div class="tarjeta-cab" style="margin-bottom:12px"><h2 style="font-size:17px">Teléfonos registrados</h2>
              <span class="small muted">${d.telefonos.length} ${d.telefonos.length === 1 ? 'número' : 'números'}</span></div>
            <div class="lista-scroll">${ordenar(d.telefonos).map(itemTelefono).join('') || '<div class="vacio">No tiene teléfonos registrados.</div>'}</div>
          </div>

          <div class="tarjeta">
            <div class="ficha-cab">
              <div class="avatar cuadro">${esc(siglas(sesion.codigo, sesion.entidad))}</div>
              <div style="flex:1"><div class="b" style="font-size:18px">${esc(sesion.entidad)}</div>
                <div class="small muted">Código ${esc(sesion.codigo)} · solo cuentas en colones y activas</div></div>
            </div>
            <div class="tarjeta-cab" style="margin-bottom:12px"><h2 style="font-size:17px">Cuentas del titular</h2>
              <span class="small muted">${d.cuentas.length} ${d.cuentas.length === 1 ? 'cuenta' : 'cuentas'}</span></div>
            <div class="lista-scroll">${d.cuentas.map(itemCuenta).join('') || `<div class="vacio">No tiene cuentas en ${esc(sesion.entidad)}.</div>`}</div>
          </div>
        </div>

        ${barra()}

        ${!esAdmin ? `
          <div class="tarjeta">
            <div class="tarjeta-cab"><h2>Afiliados en ${esc(sesion.entidad)}</h2>
              <span class="small muted">${afiliadosAqui().length} ${afiliadosAqui().length === 1 ? 'número afiliado' : 'números afiliados'}</span></div>
            <div class="rejilla rejilla-2" style="gap:12px">
              ${afiliadosAqui().map((t) => `
                <div class="opcion ${st.numOp === t.numero ? 'on' : ''}" style="cursor:default">
                  <span class="crece"><span class="mono b" style="font-size:16px">${tel(t.numero)}</span>
                  <span class="small">Cuenta ${ibanCorto(t.iban)} · desde ${fecha(t.fechaAfiliacion, false)}</span></span>
                  <span class="acciones">
                    <button class="boton sec peque" data-tras="${t.numero}">Trasladar</button>
                    <button class="boton peligro peque" data-desaf="${t.numero}">Desafiliar</button>
                  </span>
                </div>`).join('') || '<div class="vacio">No tiene números afiliados en esta entidad.</div>'}
            </div>
          </div>` : ''}
        `}
      </div>`;
    eventos();
  }

  function itemTelefono(t) {
    const enOp = st.numOp === t.numero;
    if (t.estado === 'AFILIADO') {
      return `<div class="opcion ${enOp ? 'on' : ''}" style="cursor:default">
        <span class="radio"></span>
        <span class="crece"><span class="mono b" style="font-size:16px">${tel(t.numero)}</span>
          <span class="small">Afiliado a ${ibanCorto(t.iban)}</span></span>
        ${esAdmin ? `<span class="acciones">
          <button class="boton sec peque" data-tras="${t.numero}">Trasladar</button>
          <button class="boton peligro peque" data-desaf="${t.numero}">Desafiliar</button></span>` : chip('AFILIADO')}
      </div>`;
    }
    if (t.estado === 'AFILIADO_OTRA') {
      return `<div class="opcion off"><span class="radio"></span>
        <span class="crece"><span class="mono b" style="font-size:16px">${tel(t.numero)}</span>
          <span class="small">Afiliado en ${esc(t.entidad)}: debe desafiliarse allá</span></span>
        ${chip('AFILIADO_OTRA', `AFILIADO EN ${abreviarEntidad(t.entidad)}`)}</div>`;
    }
    const on = st.modo === 'afiliar' && st.numSel === t.numero;
    const bloqueado = st.modo !== 'afiliar';
    return `<button type="button" class="opcion ${on ? 'on' : ''} ${bloqueado ? 'off' : ''}" data-num="${t.numero}" ${bloqueado ? 'disabled' : ''} aria-pressed="${on}">
      <span class="radio"></span>
      <span class="crece"><span class="mono b" style="font-size:16px">${tel(t.numero)}</span>
        <span class="small">Disponible para afiliar</span></span>${chip('NO_AFILIADO')}</button>`;
  }

  function itemCuenta(c) {
    const ok = valida(c);
    const op = st.numOp ? st.datos.telefonos.find((t) => t.numero === st.numOp) : null;
    const actual = op && op.iban === c.iban;
    let seleccionable = ok, on;
    if (st.modo === 'trasladar') { seleccionable = ok && !actual; on = seleccionable && st.ctaNueva === c.iban; }
    else if (st.modo === 'desafiliar') { seleccionable = false; on = actual; }
    else on = ok && st.ctaSel === c.iban;
    const desc = !ok ? (c.moneda !== 'CRC' ? 'No permitida: cuenta en dólares' : `No permitida: cuenta ${c.estado.toLowerCase()}`)
      : actual ? 'Cuenta actual del número'
      : `Colones · ${(c.numeros || []).length ? 'números: ' + c.numeros.map(tel).join(', ') : 'sin números afiliados'}`;
    const etiqueta = ok ? chip('ACTIVA') : c.moneda !== 'CRC' ? chip('IBAN', 'USD') : chip(c.estado);
    return `<button type="button" class="opcion ${on ? 'on' : ''} ${seleccionable ? '' : 'off'}" data-cta="${c.iban}"
      ${seleccionable ? '' : 'disabled'} aria-pressed="${!!on}">
      <span class="radio"></span>
      <span class="crece"><span class="mono b" style="font-size:14px">${ibanTxt(c.iban)}</span><span class="small">${desc}</span></span>
      ${etiqueta}</button>`;
  }

  function barra() {
    const d = st.datos;
    if (st.modo === 'desafiliar') {
      const t = d.telefonos.find((x) => x.numero === st.numOp);
      return `<div class="barra-accion peligro" id="barra">
        <span class="pregunta">¿Desea desafiliar el número ${tel(t.numero)} de la cuenta ${ibanCorto(t.iban)}?</span>
        <span class="botones"><button class="boton sec" id="cancelar">Cancelar</button>
        <button class="boton peligro lleno" id="confirmar">Desafiliar</button></span></div>`;
    }
    if (st.modo === 'trasladar') {
      const t = d.telefonos.find((x) => x.numero === st.numOp);
      const hay = d.cuentas.some((c) => valida(c) && c.iban !== t.iban);
      const texto = !hay ? `${esc(d.cliente.nombres)} no tiene otra cuenta en colones y activa para trasladar el ${tel(t.numero)}.`
        : st.ctaNueva ? `¿Desea trasladar el ${tel(t.numero)} de la cuenta ${ibanCorto(t.iban)} a la cuenta ${ibanCorto(st.ctaNueva)}?`
        : `Elija en "Cuentas del titular" la cuenta nueva para el ${tel(t.numero)}.`;
      return `<div class="barra-accion" id="barra"><span class="pregunta">${texto}</span>
        <span class="botones"><button class="boton sec" id="cancelar">Cancelar</button>
        <button class="boton" id="confirmar" ${st.ctaNueva ? '' : 'disabled'}>Trasladar</button></span></div>`;
    }
    const listo = st.numSel && st.ctaSel;
    const texto = listo ? `¿Desea afiliar el número ${tel(st.numSel)} a la cuenta ${ibanCorto(st.ctaSel)}?`
      : !st.numSel ? 'No hay números disponibles para afiliar.' : 'No hay cuentas en colones y activas para afiliar.';
    return `<div class="barra-accion" id="barra"><span class="pregunta">${texto}</span>
      <span class="botones"><button class="boton sec" id="cancelar">Cancelar</button>
      <button class="boton" id="confirmar" ${listo ? '' : 'disabled'}>Afiliar</button></span></div>`;
  }

  function eventos() {
    if (esAdmin) {
      const entrada = vista.querySelector('#buscar');
      const buscador = buscadorClientes(entrada, st.clientes, {
        porRef: () => st.por,
        alElegir: async (c, escrito) => {
          const q = digitos(escrito); // si buscó por número, quedan los dígitos
          st.idCliente = c.idCliente; st.numSel = null; st.ctaSel = null;
          await cargar();
          const libre = q && st.datos.telefonos.find((t) => t.numero.includes(q) && t.estado === 'NO_AFILIADO');
          if (libre) st.numSel = libre.numero;
          history.replaceState(null, '', `?cliente=${c.idCliente}`);
          dibujar();
        }
      });
      vista.querySelector('#por').onchange = (e) => { st.por = e.target.value; buscador.refrescar(); };
      entrada.addEventListener('input', () => { st.busqueda = entrada.value; });
    }
    if (!st.datos) return;

    vista.querySelectorAll('[data-num]').forEach((b) => (b.onclick = () => { st.numSel = b.dataset.num; dibujar(); }));
    vista.querySelectorAll('[data-cta]').forEach((b) => (b.onclick = () => {
      if (st.modo === 'trasladar') st.ctaNueva = b.dataset.cta; else st.ctaSel = b.dataset.cta;
      dibujar();
    }));
    vista.querySelectorAll('[data-tras]').forEach((b) => (b.onclick = () => {
      st.modo = 'trasladar'; st.numOp = b.dataset.tras; st.ctaNueva = null; dibujar(); irABarra();
    }));
    vista.querySelectorAll('[data-desaf]').forEach((b) => (b.onclick = () => {
      st.modo = 'desafiliar'; st.numOp = b.dataset.desaf; dibujar(); irABarra();
    }));

    vista.querySelector('#cancelar').onclick = () => {
      if (st.modo !== 'afiliar') { st.modo = 'afiliar'; st.numOp = null; st.ctaNueva = null; }
      else if (esAdmin) { st.idCliente = null; st.datos = null; st.busqueda = ''; history.replaceState(null, '', location.pathname); }
      dibujar();
    };

    vista.querySelector('#confirmar').onclick = async (e) => {
      e.target.disabled = true;
      try {
        if (st.modo === 'afiliar') {
          await pedir('/afiliaciones', 'POST', { ...extra(), numero: st.numSel, iban: st.ctaSel });
          toast(`Número ${tel(st.numSel)} afiliado a ${ibanCorto(st.ctaSel)}`);
        } else if (st.modo === 'trasladar') {
          await pedir(`/afiliaciones/${st.numOp}`, 'PUT', { ...extra(), iban: st.ctaNueva });
          toast(`Número ${tel(st.numOp)} trasladado a ${ibanCorto(st.ctaNueva)}`);
        } else {
          await pedir(`/afiliaciones/${st.numOp}`, 'DELETE');
          toast(`Número ${tel(st.numOp)} desafiliado`);
        }
        await cargar();
        dibujar();
      } catch (err) {
        toast(err.message, 'error');
        e.target.disabled = false;
      }
    };
  }

  const irABarra = () => vista.querySelector('#barra')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  await cargar();
  dibujar();
}

/* =====================================================================
   HISTORIAL DE AFILIACIONES
   ===================================================================== */
async function vistaHistorial() {
  const esAdmin = document.body.dataset.rol === 'admin';
  await iniciarPagina('SINPE Móvil', esAdmin ? 'Historial de afiliaciones' : 'Historial de mis afiliaciones');
  const vista = document.getElementById('vista');
  const eventos = await pedir('/afiliaciones/historial');
  const numeros = [...new Set(eventos.map((e) => e.numero))].sort();
  const f = { num: 'all', evento: 'todos', q: '', por: 'todos', desde: '', hasta: '' };

  vista.innerHTML = `
    <div class="tarjeta">
      <div class="tarjeta-cab"><h2>${esAdmin ? 'Eventos de la entidad' : 'Eventos de mis números'}</h2>
        <span class="small muted" id="conteo"></span></div>
      ${esAdmin ? `
        <div class="filtros">
          <input class="entrada" id="q" type="search" placeholder="Buscar por titular, número o cuenta" aria-label="Buscar en el historial">
          <select class="entrada" id="por" aria-label="Buscar por">
            ${[['todos', 'Todos'], ['tit', 'Titular'], ['num', 'Número'], ['cta', 'Cuenta']].map(([v, t]) => `<option value="${v}">Buscar por: ${t}</option>`).join('')}
          </select>
          <select class="entrada" id="evento" aria-label="Evento">
            <option value="todos">Evento: Todos</option><option value="AFILIACION">Afiliación</option><option value="DESAFILIACION">Desafiliación</option>
          </select>
        </div>
        <div class="filtros">
          <label class="campo" style="flex:0 0 200px">Desde<input class="entrada" type="date" id="desde"></label>
          <label class="campo" style="flex:0 0 200px">Hasta<input class="entrada" type="date" id="hasta"></label>
        </div>` : `
        <div class="filtros">
          ${segmentado('seg-num', [['all', 'Todos'], ...numeros.map((n) => [n, tel(n)])], 'all')}
          ${segmentado('seg-ev', [['todos', 'Todos'], ['AFILIACION', 'Afiliación'], ['DESAFILIACION', 'Desafiliación']], 'todos')}
        </div>`}
      <div class="tabla-caja"><table>
        <thead><tr><th>Fecha y hora</th><th>Número</th><th>Titular</th><th>Evento</th><th>Cuenta</th>${esAdmin ? '<th>Usuario</th>' : ''}</tr></thead>
        <tbody id="filas"></tbody></table></div>
    </div>`;

  function pintar() {
    const qn = norm(f.q), qd = digitos(f.q), qi = f.q.replace(/\s/g, '').toUpperCase();
    const filas = eventos.filter((e) => {
      if (f.num !== 'all' && e.numero !== f.num) return false;
      if (f.evento !== 'todos' && e.accion !== f.evento) return false;
      const dia = String(e.fechaEvento).slice(0, 10);
      if (f.desde && dia < f.desde) return false;
      if (f.hasta && dia > f.hasta) return false;
      if (!f.q) return true;
      const tit = norm(e.titular).includes(qn);
      const num = qd && e.numero.includes(qd);
      const cta = qi.length >= 3 && e.iban.includes(qi);
      return f.por === 'tit' ? tit : f.por === 'num' ? num : f.por === 'cta' ? cta : tit || num || cta;
    });
    vista.querySelector('#conteo').textContent = `${filas.length} ${filas.length === 1 ? 'evento' : 'eventos'} · más recientes primero`;
    vista.querySelector('#filas').innerHTML = filas.map((e) => `
      <tr><td>${fecha(e.fechaEvento)}</td><td class="mono b">${tel(e.numero)}</td><td>${esc(e.titular)}</td>
      <td>${chip(e.accion)}</td><td class="mono small">${ibanTxt(e.iban)}</td>${esAdmin ? `<td>${esc(e.usuario || '—')}</td>` : ''}</tr>`).join('')
      || `<tr><td colspan="6" class="vacio">${eventos.length ? 'Ningún evento coincide con los filtros.' : 'Todavía no hay afiliaciones registradas.'}</td></tr>`;
  }

  if (esAdmin) {
    vista.querySelector('#q').oninput = (e) => { f.q = e.target.value; pintar(); };
    vista.querySelector('#por').onchange = (e) => { f.por = e.target.value; pintar(); };
    vista.querySelector('#evento').onchange = (e) => { f.evento = e.target.value; pintar(); };
    vista.querySelector('#desde').onchange = (e) => { f.desde = e.target.value; pintar(); };
    vista.querySelector('#hasta').onchange = (e) => { f.hasta = e.target.value; pintar(); };
  } else {
    enganchar(vista, 'seg-num', (v) => { f.num = v; pintar(); });
    enganchar(vista, 'seg-ev', (v) => { f.evento = v; pintar(); });
  }
  pintar();
}
