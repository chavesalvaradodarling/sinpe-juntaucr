// Persona 1: funciones de apoyo para dibujar la interfaz (las usan todas las pantallas)

// Escapa texto para insertarlo en HTML de forma segura
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ₡125 400,00 / $850,00
function dinero(monto, moneda = 'CRC') {
  const n = Number(monto || 0);
  const txt = Math.abs(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '−' : ''}${moneda === 'USD' ? '$' : '₡'}${txt}`;
}

// 88881111 -> 8888-1111
const tel = (n) => (n && String(n).length === 8 ? `${String(n).slice(0, 4)}-${String(n).slice(4)}` : esc(n || '—'));

// CR21018101001234567801 -> CR21 0181 0100 1234 5678 01
const ibanTxt = (i) => (i ? String(i).replace(/(.{4})/g, '$1 ').trim() : '—');

// CR21 …5678 01
const ibanCorto = (i) => (i ? `${i.slice(0, 4)} …${i.slice(-6, -2)} ${i.slice(-2)}` : '—');

// '2026-10-30 14:05:00' o '2026-10-30T14:05:00.000Z' -> 30/10/2026 · 14:05
function fecha(valor, conHora = true) {
  if (!valor) return '—';
  const [d, h] = String(valor).replace('T', ' ').split(' ');
  const [a, m, dia] = d.split('-');
  return conHora && h ? `${dia}/${m}/${a} · ${h.slice(0, 5)}` : `${dia}/${m}/${a}`;
}

function hoyISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const iniciales = (nombre) =>
  String(nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

// Siglas del logo de cada entidad (por código)
const SIGLAS = { '0181': 'JU', '0151': 'BN', '0152': 'BCR', '0161': 'BP', '0102': 'BAC', JUNTAUCR: 'JU' };
// Si no está en la lista, se usa el código cuando es corto (BAC, BCR, BN, BP) o las iniciales del nombre
const siglas = (codigo, nombre) =>
  SIGLAS[codigo] || (codigo && String(codigo).length <= 4 ? String(codigo) : iniciales(nombre || codigo));
const abreviarEntidad = (nombre) => ({
  'Banco de Costa Rica': 'BCR', 'Banco Nacional de Costa Rica': 'BN',
  'Banco Popular y de Desarrollo Comunal': 'BP', 'BAC Credomatic': 'BAC'
}[nombre] || nombre);

// Etiquetas de estado
const COLOR_ESTADO = {
  BLOQUEADA: 'rojo', DESAFILIACION: 'rojo', INACTIVA: 'gris', INACTIVO: 'gris',
  NO_AFILIADO: 'gris', AFILIADO_OTRA: 'rosa', SINPE_MOVIL: 'rosa', IBAN: 'gris'
};
const TEXTO_ESTADO = {
  NO_AFILIADO: 'NO AFILIADO', AFILIADO_OTRA: 'AFILIADO EN OTRA', SINPE_MOVIL: 'SINPE MÓVIL',
  AFILIACION: 'AFILIACIÓN', DESAFILIACION: 'DESAFILIACIÓN'
};
const chip = (estado, texto) =>
  `<span class="chip ${COLOR_ESTADO[estado] || ''}">${esc(texto || TEXTO_ESTADO[estado] || estado)}</span>`;

// Aviso flotante
function toast(mensaje, tipo = 'ok') {
  const t = document.createElement('div');
  t.className = `toast ${tipo === 'error' ? 'error' : ''}`;
  t.setAttribute('role', 'status');
  t.textContent = mensaje;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

// Ventana modal. Devuelve el elemento para enganchar eventos.
function modal(html) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  velo.addEventListener('click', (e) => { if (e.target === velo) velo.remove(); });
  const alEsc = (e) => { if (e.key === 'Escape') { velo.remove(); document.removeEventListener('keydown', alEsc); } };
  document.addEventListener('keydown', alEsc);
  document.body.appendChild(velo);
  velo.querySelector('input, select, button')?.focus();
  return velo;
}

// Control segmentado (Todos / Titular / ...): devuelve HTML; usar con enganchar()
const segmentado = (id, opciones, actual) =>
  `<div class="segmentado" role="group" id="${id}">${opciones
    .map(([v, t]) => `<button type="button" data-v="${v}" class="${v === actual ? 'on' : ''}" aria-pressed="${v === actual}">${t}</button>`)
    .join('')}</div>`;

function enganchar(contenedor, id, alCambiar) {
  const seg = contenedor.querySelector(`#${id}`);
  seg?.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    seg.querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    alCambiar(b.dataset.v);
  });
}

// Para buscar sin tildes ni mayúsculas
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const digitos = (t) => String(t || '').replace(/\D/g, '');

// Formatea un campo de teléfono mientras se escribe: 88881111 -> 8888-1111
function mascaraTelefono(input) {
  input.addEventListener('input', () => {
    const n = digitos(input.value);
    input.value = n.length > 4 ? `${n.slice(0, 4)}-${n.slice(4, 8)}` : n;
  });
}

// "15 000,50" o "15000.50" -> 15000.5
function montoNumero(texto) {
  const t = String(texto || '').replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

// Buscador de clientes con lista desplegable (por titular o por número).
// clientes: [{ idCliente, nombre, identificacion, telefonos: [] }]
function buscadorClientes(input, clientes, { porRef = () => 'todos', alElegir }) {
  const caja = input.closest('.buscador');
  const lista = document.createElement('div');
  lista.className = 'desplegable oculto';
  lista.setAttribute('role', 'listbox');
  caja.appendChild(lista);

  const coincide = (c, q, por) => {
    const qn = norm(q), qd = digitos(q);
    const porTitular = norm(c.nombre).includes(qn) || (qd && digitos(c.identificacion).includes(qd));
    const porNumero = qd.length > 0 && (c.telefonos || []).some((n) => n.includes(qd));
    return por === 'tit' ? porTitular : por === 'num' ? porNumero : porTitular || porNumero;
  };

  function mostrar() {
    const q = input.value.trim();
    if (!q) { lista.classList.add('oculto'); return; }
    const res = clientes.filter((c) => coincide(c, q, porRef())).slice(0, 12);
    lista.innerHTML = res.length
      ? res.map((c) => `
          <button type="button" role="option" data-id="${c.idCliente}">
            <span class="avatar claro peque">${esc(iniciales(c.nombre))}</span>
            <span><span class="b">${esc(c.nombre)}</span><br>
            <span class="small muted">${esc(c.identificacion)} · ${(c.telefonos || []).map(tel).join(', ') || 'sin teléfonos'}</span></span>
          </button>`).join('')
      : '<div class="sin">Ningún cliente coincide con la búsqueda.</div>';
    lista.classList.remove('oculto');
  }

  input.addEventListener('input', mostrar);
  input.addEventListener('focus', mostrar);
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') lista.classList.add('oculto'); });
  document.addEventListener('click', (e) => { if (!caja.contains(e.target)) lista.classList.add('oculto'); });
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    const c = clientes.find((x) => String(x.idCliente) === b.dataset.id);
    const escrito = input.value; // lo que había escrito (nombre o número)
    input.value = c.nombre;
    lista.classList.add('oculto');
    alElegir(c, escrito);
  });
  return { refrescar: mostrar };
}

// Íconos (trazos simples)
const ICONOS = {
  inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  enviar: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  mas: 'M12 8v8M8 12h8M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  historial: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2',
  cambio: 'M4 8h14l-3-3M20 16H6l3 3',
  lista: 'M4 5h6v6H4zM4 15h6v4H4zM14 6h6M14 10h6M14 15h6M14 19h6',
  persona: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  telefono: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  personas: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3',
  tarjeta: 'M3 6h18v12H3zM3 10h18M7 15h4',
  enlace: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  salir: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9',
  check: 'M5 12l5 5 9-10',
  flechaArriba: 'M7 17L17 7M9 7h8v8',
  flechaAbajo: 'M17 7L7 17M15 17H7V9',
  derecha: 'M9 6l6 6-6 6'
};
const icono = (n, tam = 20) =>
  `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONOS[n]}"/></svg>`;