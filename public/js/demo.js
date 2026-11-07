// Persona 1: DATOS DE EJEMPLO (solo mientras el backend no tenga la ruta)
// ---------------------------------------------------------------------
// api.js llama a demoApi() cuando Express responde 404 porque la ruta todavía
// no existe. Aquí se simulan esas rutas con los datos del prototipo y las
// mismas reglas del enunciado, para poder ver y probar las pantallas.
// Los cambios se guardan en sessionStorage (se pierden al cerrar la pestaña).
//
// Cuando las 4 personas terminen sus rutas, este archivo deja de usarse solo.
// El contrato de cada ruta está en docs/API.md.

const DEMO_CLAVE = 'sinpe-demo-datos';
const DEMO_SESION = 'sinpe-demo-sesion';
window.rutasDemo = window.rutasDemo || new Set();

const ENTIDADES = [
  { idEntidad: 1, codigo: '0181', nombre: 'Banco JUNTAUCR' },
  { idEntidad: 2, codigo: '0151', nombre: 'Banco Nacional de Costa Rica' },
  { idEntidad: 3, codigo: '0152', nombre: 'Banco de Costa Rica' },
  { idEntidad: 4, codigo: '0161', nombre: 'Banco Popular y de Desarrollo Comunal' },
  { idEntidad: 5, codigo: '0102', nombre: 'BAC Credomatic' }
];

function datosIniciales() {
  return {
    clientes: [
      { idCliente: 1, identificacion: '1-1234-0567', nombres: 'Ana', primerApellido: 'Mora', segundoApellido: 'Solís', correo: 'ana.mora@correo.cr', fechaRegistro: '2026-08-10 09:00:00', estado: 'ACTIVO' },
      { idCliente: 2, identificacion: '2-0456-0789', nombres: 'Luis', primerApellido: 'Rojas', segundoApellido: 'Vargas', correo: 'luis.rojas@correo.cr', fechaRegistro: '2026-08-01 10:00:00', estado: 'ACTIVO' },
      { idCliente: 3, identificacion: '3-0789-0123', nombres: 'María', primerApellido: 'Solano', segundoApellido: 'Brenes', correo: 'maria.solano@correo.cr', fechaRegistro: '2026-09-11 08:30:00', estado: 'INACTIVO' },
      { idCliente: 4, identificacion: '1-0987-0654', nombres: 'Carla', primerApellido: 'Vega', segundoApellido: 'Mora', correo: 'carla.vega@correo.cr', fechaRegistro: '2026-09-20 14:00:00', estado: 'ACTIVO' }
    ],
    usuarios: [
      { idUsuario: 1, idEntidad: 1, usuario: 'admin.juntaucr', rol: 'admin', idCliente: null, nombre: 'Carlos Jiménez' },
      { idUsuario: 2, idEntidad: 1, usuario: 'ana.mora', rol: 'cliente', idCliente: 1 },
      { idUsuario: 3, idEntidad: 1, usuario: 'luis.rojas', rol: 'cliente', idCliente: 2 },
      { idUsuario: 4, idEntidad: 1, usuario: 'maria.solano', rol: 'cliente', idCliente: 3 },
      { idUsuario: 5, idEntidad: 2, usuario: 'admin.bn', rol: 'admin', idCliente: null, nombre: 'Andrea Quesada' },
      { idUsuario: 6, idEntidad: 2, usuario: 'luis.rojas', rol: 'cliente', idCliente: 2 },
      { idUsuario: 7, idEntidad: 3, usuario: 'admin.bcr', rol: 'admin', idCliente: null, nombre: 'Diego Arias' },
      { idUsuario: 8, idEntidad: 3, usuario: 'ana.mora', rol: 'cliente', idCliente: 1 },
      { idUsuario: 9, idEntidad: 1, usuario: 'carla.vega', rol: 'cliente', idCliente: 4 }
    ],
    cuentas: [
      { idCuenta: 1, idCliente: 1, idEntidad: 1, moneda: 'CRC', iban: 'CR21018101001234567801', saldo: 125400, estado: 'ACTIVA', fechaApertura: '2026-09-02' },
      { idCuenta: 2, idCliente: 1, idEntidad: 1, moneda: 'USD', iban: 'CR21018101001234567802', saldo: 850, estado: 'ACTIVA', fechaApertura: '2026-09-02' },
      { idCuenta: 3, idCliente: 1, idEntidad: 1, moneda: 'CRC', iban: 'CR21018101001234567803', saldo: 40000, estado: 'BLOQUEADA', fechaApertura: '2026-09-10' },
      { idCuenta: 4, idCliente: 1, idEntidad: 1, moneda: 'CRC', iban: 'CR21018101001234567804', saldo: 62000, estado: 'ACTIVA', fechaApertura: '2026-10-01' },
      { idCuenta: 5, idCliente: 2, idEntidad: 1, moneda: 'CRC', iban: 'CR21018101004321876510', saldo: 18000, estado: 'ACTIVA', fechaApertura: '2026-09-05' },
      { idCuenta: 6, idCliente: 3, idEntidad: 1, moneda: 'USD', iban: 'CR21018101009988776655', saldo: 0, estado: 'INACTIVA', fechaApertura: '2026-09-11' },
      { idCuenta: 7, idCliente: 2, idEntidad: 2, moneda: 'CRC', iban: 'CR15015100011234567890', saldo: 300000, estado: 'ACTIVA', fechaApertura: '2026-08-01' },
      { idCuenta: 8, idCliente: 1, idEntidad: 3, moneda: 'CRC', iban: 'CR05015202001234567899', saldo: 50000, estado: 'ACTIVA', fechaApertura: '2026-08-15' },
      { idCuenta: 9, idCliente: 4, idEntidad: 1, moneda: 'CRC', iban: 'CR21018101005555666677', saldo: 80000, estado: 'ACTIVA', fechaApertura: '2026-09-20' }
    ],
    telefonos: [
      { numero: '88881111', idCliente: 1, fechaRegistro: '2026-09-02 09:00:00' },
      { numero: '88882222', idCliente: 1, fechaRegistro: '2026-09-02 09:05:00' },
      { numero: '87774444', idCliente: 1, fechaRegistro: '2026-10-12 16:00:00' },
      { numero: '86667777', idCliente: 1, fechaRegistro: '2026-08-20 11:00:00' },
      { numero: '88883333', idCliente: 2, fechaRegistro: '2026-09-05 10:00:00' },
      { numero: '70001111', idCliente: 2, fechaRegistro: '2026-08-18 08:00:00' },
      { numero: '61112222', idCliente: 4, fechaRegistro: '2026-09-20 14:10:00' }
    ],
    afiliaciones: [
      { numero: '88881111', idCuenta: 1, fecha: '2026-10-20 10:05:00' },
      { numero: '88882222', idCuenta: 1, fecha: '2026-09-05 09:20:00' },
      { numero: '86667777', idCuenta: 8, fecha: '2026-08-25 15:00:00' },
      { numero: '88883333', idCuenta: 5, fecha: '2026-09-06 11:00:00' },
      { numero: '70001111', idCuenta: 7, fecha: '2026-08-20 10:00:00' }
    ],
    historial: [
      { id: 1, numero: '70001111', idCuenta: 7, accion: 'AFILIACION', fecha: '2026-08-20 10:00:00', idUsuario: 5 },
      { id: 2, numero: '86667777', idCuenta: 8, accion: 'AFILIACION', fecha: '2026-08-25 15:00:00', idUsuario: 7 },
      { id: 3, numero: '88881111', idCuenta: 1, accion: 'AFILIACION', fecha: '2026-09-05 09:12:00', idUsuario: 1 },
      { id: 4, numero: '88882222', idCuenta: 1, accion: 'AFILIACION', fecha: '2026-09-05 09:20:00', idUsuario: 1 },
      { id: 5, numero: '88883333', idCuenta: 5, accion: 'AFILIACION', fecha: '2026-09-06 11:00:00', idUsuario: 1 },
      { id: 6, numero: '88881111', idCuenta: 1, accion: 'DESAFILIACION', fecha: '2026-10-14 15:40:00', idUsuario: 2 },
      { id: 7, numero: '88881111', idCuenta: 4, accion: 'AFILIACION', fecha: '2026-10-14 15:40:00', idUsuario: 2 },
      { id: 8, numero: '88881111', idCuenta: 4, accion: 'DESAFILIACION', fecha: '2026-10-20 10:05:00', idUsuario: 1 },
      { id: 9, numero: '88881111', idCuenta: 1, accion: 'AFILIACION', fecha: '2026-10-20 10:05:00', idUsuario: 1 }
    ],
    transferencias: [
      { id: 1, origen: 5, destino: 4, monto: 22000, tipo: 'SINPE_MOVIL', detalle: 'Almuerzo', fecha: '2026-10-15 12:00:00', telO: '88883333', telD: '88881111' },
      { id: 2, origen: 4, destino: 5, monto: 7500, tipo: 'SINPE_MOVIL', detalle: 'Pasajes', fecha: '2026-10-16 08:45:00', telO: '88881111', telD: '88883333' },
      { id: 3, origen: 1, destino: 7, monto: 25000, tipo: 'IBAN', detalle: 'Alquiler octubre', fecha: '2026-10-22 18:12:00' },
      { id: 4, origen: 7, destino: 1, monto: 40000, tipo: 'IBAN', detalle: 'Pago de préstamo', fecha: '2026-10-28 09:30:00' },
      { id: 5, origen: 1, destino: 5, monto: 15000, tipo: 'SINPE_MOVIL', detalle: 'Transferencia SINPE Móvil', fecha: '2026-10-30 14:05:00', telO: '88881111', telD: '88883333' }
    ]
  };
}

// ---------- almacenamiento (con try/catch: sessionStorage puede fallar) ----------
function demoLeer(clave, porDefecto) {
  try { const v = sessionStorage.getItem(clave); return v ? JSON.parse(v) : porDefecto(); } catch { return porDefecto(); }
}
function demoGuardar(clave, valor) {
  try { sessionStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: solo en memoria */ }
}

// ---------- utilidades ----------
const dOk = (datos) => ({ ok: true, datos });
const dError = (mensaje, estado = 400) => ({ ok: false, mensaje, estado });
const dAhora = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace('T', ' ');
};
const dNombre = (c) => `${c.nombres} ${c.primerApellido} ${c.segundoApellido}`;

function demoApi(ruta, metodo = 'GET', cuerpo = {}) {
  const BD = demoLeer(DEMO_CLAVE, datosIniciales);
  const [camino, consulta] = ruta.split('?');
  const q = new URLSearchParams(consulta || '');
  const b = cuerpo || {};

  // Si el login real ya existe, se usa esa sesión. Si no, la de ejemplo; y si se
  // abre una página directamente, entra con un usuario de prueba.
  let sesion = (camino !== '/sesion' && window.sesionActual) || demoLeer(DEMO_SESION, () => null);
  if (!sesion && /^\/(cliente|admin)\//.test(location.pathname) && camino !== '/login') {
    sesion = armarSesion(BD, BD.usuarios.find((u) => u.usuario === (location.pathname.startsWith('/admin') ? 'admin.juntaucr' : 'ana.mora') && u.idEntidad === 1));
    demoGuardar(DEMO_SESION, sesion);
  }

  const ent = sesion?.idEntidad;
  const esAdmin = sesion?.rol === 'admin';
  const cliente = (id) => BD.clientes.find((c) => c.idCliente === Number(id));
  const cuenta = (id) => BD.cuentas.find((c) => c.idCuenta === id);
  const cuentaIban = (i) => BD.cuentas.find((c) => c.iban === String(i || '').replace(/\s/g, '').toUpperCase());
  const entidad = (id) => ENTIDADES.find((e) => e.idEntidad === id);
  const afil = (numero) => BD.afiliaciones.find((a) => a.numero === numero);
  const clientesEntidad = () => [...new Set([
    ...BD.usuarios.filter((u) => u.idEntidad === ent && u.rol === 'cliente').map((u) => u.idCliente),
    ...BD.cuentas.filter((c) => c.idEntidad === ent).map((c) => c.idCliente)
  ])];
  const estadoTel = (t) => {
    const a = afil(t.numero);
    if (!a) return { estado: 'NO_AFILIADO', iban: null, entidad: null, fechaAfiliacion: null };
    const c = cuenta(a.idCuenta);
    return { estado: c.idEntidad === ent ? 'AFILIADO' : 'AFILIADO_OTRA', iban: c.iban, entidad: entidad(c.idEntidad).nombre, fechaAfiliacion: a.fecha };
  };
  const telefonosDe = (idCliente) => BD.telefonos.filter((t) => t.idCliente === idCliente)
    .map((t) => ({ numero: t.numero, fechaRegistro: t.fechaRegistro, ...estadoTel(t) }));
  const cuentasDe = (idCliente) => BD.cuentas.filter((c) => c.idCliente === idCliente && c.idEntidad === ent)
    .map((c) => ({ ...c, numeros: BD.afiliaciones.filter((a) => a.idCuenta === c.idCuenta).map((a) => a.numero) }));
  const guardar = () => demoGuardar(DEMO_CLAVE, BD);
  const idObjetivo = () => (esAdmin ? Number(b.idCliente ?? q.get('idCliente')) : sesion.idCliente);
  const registrarHistorial = (numero, idCuenta, accion) =>
    BD.historial.push({ id: BD.historial.length + 1, numero, idCuenta, accion, fecha: dAhora(), idUsuario: sesion.idUsuario });

  const rutas = [
    // ================= Persona 1 · Acceso y clientes =================
    ['GET', /^\/entidades$/, () => dOk(ENTIDADES)],
    ['POST', /^\/login$/, () => {
      const u = BD.usuarios.find((x) => x.idEntidad === Number(b.idEntidad) && x.usuario === String(b.usuario || '').trim().toLowerCase());
      if (!u || b.contrasena !== 'prueba123') return dError('Usuario o contraseña incorrectos para esta entidad', 401);
      if (u.rol === 'cliente' && cliente(u.idCliente).estado !== 'ACTIVO') return dError('Su usuario está inactivo. Comuníquese con su entidad.', 403);
      const s = armarSesion(BD, u);
      demoGuardar(DEMO_SESION, s);
      return dOk(s);
    }],
    ['POST', /^\/logout$/, () => { try { sessionStorage.removeItem(DEMO_SESION); } catch { /* nada */ } return dOk(true); }],
    ['GET', /^\/sesion$/, () => (sesion ? dOk(sesion) : dError('Sin sesión', 401))],
    ['GET', /^\/perfil$/, () => { const c = cliente(sesion.idCliente); return dOk({ ...c, nombre: dNombre(c) }); }],
    ['PUT', /^\/perfil$/, () => actualizarCliente(sesion.idCliente, b, false)],
    ['GET', /^\/clientes$/, () => dOk(clientesEntidad().map(cliente).map((c) => ({
      ...c, nombre: dNombre(c),
      cuentas: BD.cuentas.filter((x) => x.idCliente === c.idCliente && x.idEntidad === ent).length,
      telefonos: BD.telefonos.filter((t) => t.idCliente === c.idCliente).map((t) => t.numero)
    })).sort((x, y) => x.primerApellido.localeCompare(y.primerApellido)))],
    ['POST', /^\/clientes$/, () => {
      for (const k of ['identificacion', 'nombres', 'primerApellido', 'segundoApellido', 'correo']) if (!String(b[k] || '').trim()) return dError('Complete todos los campos');
      if (BD.clientes.some((c) => c.identificacion === b.identificacion.trim())) return dError('Ya existe un cliente con esa identificación');
      if (BD.clientes.some((c) => c.correo === b.correo.trim().toLowerCase())) return dError('Ya existe un cliente con ese correo');
      const c = { idCliente: BD.clientes.length + 1, identificacion: b.identificacion.trim(), nombres: b.nombres.trim(), primerApellido: b.primerApellido.trim(), segundoApellido: b.segundoApellido.trim(), correo: b.correo.trim().toLowerCase(), fechaRegistro: dAhora(), estado: 'ACTIVO' };
      const usuario = `${c.nombres.split(/\s+/)[0]}.${c.primerApellido}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      BD.clientes.push(c);
      BD.usuarios.push({ idUsuario: BD.usuarios.length + 1, idEntidad: ent, usuario, rol: 'cliente', idCliente: c.idCliente });
      guardar();
      return dOk({ idCliente: c.idCliente, usuario, contrasenaTemporal: 'prueba123' });
    }],
    ['PUT', /^\/clientes\/(\d+)$/, (m) => actualizarCliente(Number(m[1]), b, true)],

    // ================= Persona 2 · Cuentas y teléfonos =================
    ['GET', /^\/cuentas$/, () => {
      const lista = esAdmin ? BD.cuentas.filter((c) => c.idEntidad === ent) : BD.cuentas.filter((c) => c.idEntidad === ent && c.idCliente === sesion.idCliente);
      return dOk(lista.map((c) => {
        const cl = cliente(c.idCliente);
        return { ...c, titular: dNombre(cl), identificacion: cl.identificacion, numeros: BD.afiliaciones.filter((a) => a.idCuenta === c.idCuenta).map((a) => a.numero) };
      }));
    }],
    ['GET', /^\/cuentas\/iban-sugerido$/, () => {
      const cod = entidad(ent).codigo.slice(-3);
      const n = (k) => Array.from({ length: k }, () => Math.floor(Math.random() * 10)).join('');
      return dOk({ iban: `CR${n(2)}0${cod}${n(14)}` });
    }],
    ['POST', /^\/cuentas$/, () => {
      const c = cliente(b.idCliente);
      const iban = String(b.iban || '').replace(/\s/g, '').toUpperCase();
      if (!c) return dError('No existe el titular');
      if (c.estado !== 'ACTIVO') return dError('El titular está inactivo');
      if (!['CRC', 'USD'].includes(b.moneda)) return dError('La moneda no existe');
      if (iban.length !== 22) return dError('El IBAN debe tener 22 caracteres');
      if (cuentaIban(iban)) return dError('El IBAN ya existe');
      if (Number(b.saldo) < 0) return dError('El saldo no puede ser negativo');
      BD.cuentas.push({ idCuenta: BD.cuentas.length + 1, idCliente: c.idCliente, idEntidad: ent, moneda: b.moneda, iban, saldo: Number(b.saldo) || 0, estado: 'ACTIVA', fechaApertura: b.fechaApertura || dAhora().slice(0, 10) });
      guardar();
      return dOk({ mensaje: 'Cuenta registrada' });
    }],
    ['PUT', /^\/cuentas\/([A-Z0-9]+)\/estado$/, (m) => {
      const c = cuentaIban(m[1]);
      if (!c || c.idEntidad !== ent) return dError('La cuenta no existe', 404);
      if (c.estado === b.estado) return dError('La cuenta ya tiene ese estado');
      c.estado = b.estado; guardar();
      return dOk({ mensaje: 'Estado actualizado' });
    }],
    ['GET', /^\/telefonos$/, () => {
      const ids = esAdmin ? clientesEntidad() : [sesion.idCliente];
      return dOk(BD.telefonos.filter((t) => ids.includes(t.idCliente)).map((t) => {
        const cl = cliente(t.idCliente);
        return { numero: t.numero, fechaRegistro: t.fechaRegistro, idCliente: cl.idCliente, titular: dNombre(cl), identificacion: cl.identificacion, ...estadoTel(t) };
      }));
    }],
    ['POST', /^\/telefonos$/, () => {
      const id = idObjetivo();
      const c = cliente(id);
      const numero = String(b.numero || '').replace(/\D/g, '');
      if (!c) return dError('No existe el titular');
      if (c.estado !== 'ACTIVO') return dError('El titular está inactivo');
      if (!/^\d{8}$/.test(numero)) return dError('El teléfono debe tener 8 dígitos');
      if (BD.telefonos.some((t) => t.numero === numero)) return dError('El teléfono ya está registrado');
      BD.telefonos.push({ numero, idCliente: c.idCliente, fechaRegistro: dAhora() });
      guardar();
      return dOk({ mensaje: 'Teléfono registrado' });
    }],

    // ================= Persona 3 · Afiliaciones SINPE Móvil =================
    ['GET', /^\/afiliaciones$/, () => dOk(BD.afiliaciones
      .map((a) => ({ a, c: cuenta(a.idCuenta) }))
      .filter(({ c }) => c.idEntidad === ent && (esAdmin || c.idCliente === sesion.idCliente))
      .map(({ a, c }) => { const cl = cliente(c.idCliente); return { numero: a.numero, idCliente: cl.idCliente, titular: dNombre(cl), identificacion: cl.identificacion, iban: c.iban, fechaAfiliacion: a.fecha }; }))],
    ['GET', /^\/afiliaciones\/ficha$/, () => {
      const c = cliente(idObjetivo());
      if (!c) return dError('No existe el cliente', 404);
      return dOk({ cliente: { ...c, nombre: dNombre(c) }, telefonos: telefonosDe(c.idCliente), cuentas: cuentasDe(c.idCliente) });
    }],
    ['POST', /^\/afiliaciones$/, () => {
      const numero = String(b.numero || ''); const c = cuentaIban(b.iban); const t = BD.telefonos.find((x) => x.numero === numero);
      if (!t) return dError('El teléfono no está registrado');
      if (!c || c.idEntidad !== ent) return dError('La cuenta no existe en esta entidad');
      if (afil(numero)) return dError('El teléfono ya está afiliado');
      if (t.idCliente !== c.idCliente || t.idCliente !== idObjetivo()) return dError('El teléfono y la cuenta no son del mismo titular');
      if (c.estado !== 'ACTIVA') return dError('La cuenta no está activa');
      if (c.moneda !== 'CRC') return dError('La cuenta debe ser en colones');
      BD.afiliaciones.push({ numero, idCuenta: c.idCuenta, fecha: dAhora() });
      registrarHistorial(numero, c.idCuenta, 'AFILIACION'); guardar();
      return dOk({ mensaje: 'Teléfono afiliado' });
    }],
    ['PUT', /^\/afiliaciones\/(\d{8})$/, (m) => {
      const a = afil(m[1]); const nueva = cuentaIban(b.iban);
      if (!a || cuenta(a.idCuenta).idEntidad !== ent) return dError('El teléfono no está afiliado en esta entidad');
      if (!nueva || nueva.idEntidad !== ent) return dError('La cuenta nueva no existe');
      if (nueva.idCuenta === a.idCuenta) return dError('El teléfono ya está en esa cuenta');
      // paso 2 inválido -> se revierte todo (no se toca nada)
      if (nueva.idCliente !== cuenta(a.idCuenta).idCliente) return dError('El teléfono y la cuenta no son del mismo titular');
      if (nueva.estado !== 'ACTIVA') return dError('La cuenta no está activa');
      if (nueva.moneda !== 'CRC') return dError('La cuenta debe ser en colones');
      registrarHistorial(m[1], a.idCuenta, 'DESAFILIACION');
      a.idCuenta = nueva.idCuenta; a.fecha = dAhora();
      registrarHistorial(m[1], nueva.idCuenta, 'AFILIACION'); guardar();
      return dOk({ mensaje: 'Afiliación trasladada' });
    }],
    ['DELETE', /^\/afiliaciones\/(\d{8})$/, (m) => {
      const a = afil(m[1]);
      if (!a) return dError('El teléfono no está afiliado');
      if (cuenta(a.idCuenta).idEntidad !== ent) return dError('El número está afiliado en otra entidad: debe desafiliarse allá');
      registrarHistorial(m[1], a.idCuenta, 'DESAFILIACION');
      BD.afiliaciones = BD.afiliaciones.filter((x) => x !== a); guardar();
      return dOk({ mensaje: 'Teléfono desafiliado' });
    }],
    ['GET', /^\/afiliaciones\/historial$/, () => dOk(BD.historial
      .map((h) => ({ h, c: cuenta(h.idCuenta) }))
      .filter(({ c }) => c.idEntidad === ent && (esAdmin || c.idCliente === sesion.idCliente))
      .map(({ h, c }) => {
        const u = BD.usuarios.find((x) => x.idUsuario === h.idUsuario);
        const cl = cliente(c.idCliente);
        return {
          idHistorial: h.id, fechaEvento: h.fecha, accion: h.accion, numero: h.numero, iban: c.iban, idCliente: cl.idCliente, titular: dNombre(cl),
          usuario: !u ? 'Sistema' : u.rol === 'admin' ? u.nombre : `${cliente(u.idCliente).nombres} ${cliente(u.idCliente).primerApellido} (cliente)`
        };
      })
      .sort((x, y) => (x.fechaEvento < y.fechaEvento ? 1 : x.fechaEvento > y.fechaEvento ? -1 : y.idHistorial - x.idHistorial)))],

    // ================= Persona 4 · Transferencias y movimientos =================
    ['GET', /^\/transferencias\/origenes$/, () => dOk(BD.afiliaciones
      .map((a) => ({ a, c: cuenta(a.idCuenta) }))
      .filter(({ c }) => c.idEntidad === ent && c.idCliente === sesion.idCliente && c.estado === 'ACTIVA' && c.moneda === 'CRC')
      .map(({ a, c }) => ({ iban: c.iban, saldo: c.saldo, numero: a.numero })))],
    ['GET', /^\/transferencias\/destino-sinpe\/(\d+)$/, (m) => {
      const t = BD.telefonos.find((x) => x.numero === m[1]);
      if (!t) return dError('Ese número no está registrado en SINPE Móvil', 404);
      const a = afil(t.numero); const c = a && cuenta(a.idCuenta);
      return dOk({ numero: t.numero, titular: dNombre(cliente(t.idCliente)), afiliado: !!a, iban: c?.iban || null, entidad: c ? entidad(c.idEntidad).nombre : null });
    }],
    ['GET', /^\/transferencias\/destino-iban\/([A-Z0-9]+)$/, (m) => {
      const c = cuentaIban(m[1]);
      if (!c) return dError('No existe una cuenta con ese IBAN', 404);
      return dOk({ iban: c.iban, titular: dNombre(cliente(c.idCliente)), entidad: entidad(c.idEntidad).nombre, moneda: c.moneda, estado: c.estado });
    }],
    ['POST', /^\/transferencias\/sinpe$/, () => {
      const monto = Number(b.monto);
      const aO = afil(String(b.numeroOrigen || '')); const aD = afil(String(b.numeroDestino || '').replace(/\D/g, ''));
      if (!(monto > 0)) return dError('El monto debe ser positivo');
      if (!aO) return dError('El teléfono origen no está afiliado');
      const o = cuenta(aO.idCuenta);
      if (o.idCliente !== sesion.idCliente || o.idEntidad !== ent) return dError('Elija una de sus cuentas con número SINPE afiliado');
      if (!aD) return dError('El teléfono destino no está afiliado');
      if (aO.idCuenta === aD.idCuenta) return dError('Los teléfonos están afiliados a la misma cuenta');
      const d = cuenta(aD.idCuenta);
      if (o.estado !== 'ACTIVA' || d.estado !== 'ACTIVA') return dError('Las dos cuentas deben estar activas');
      if (o.moneda !== 'CRC' || d.moneda !== 'CRC') return dError('SINPE Móvil solo funciona en colones');
      if (o.saldo < monto) return dError('Saldo insuficiente');
      o.saldo -= monto; d.saldo += monto;
      const t = { id: BD.transferencias.length + 1, origen: o.idCuenta, destino: d.idCuenta, monto, tipo: 'SINPE_MOVIL', detalle: b.detalle || null, fecha: dAhora(), telO: aO.numero, telD: aD.numero };
      BD.transferencias.push(t); guardar();
      return dOk(comprobante(t));
    }],
    ['POST', /^\/transferencias\/iban$/, () => {
      const monto = Number(b.monto); const o = cuentaIban(b.ibanOrigen); const d = cuentaIban(b.ibanDestino);
      if (!(monto > 0)) return dError('El monto debe ser positivo');
      if (!o || !d) return dError('Una de las cuentas no existe');
      if (o.idCliente !== sesion.idCliente || o.idEntidad !== ent) return dError('La cuenta origen no es suya en esta entidad');
      if (o.idCuenta === d.idCuenta) return dError('No se puede transferir a la misma cuenta');
      if (o.estado !== 'ACTIVA' || d.estado !== 'ACTIVA') return dError('Las dos cuentas deben estar activas');
      if (o.moneda !== d.moneda) return dError('Las cuentas deben tener la misma moneda');
      if (o.saldo < monto) return dError('Saldo insuficiente');
      o.saldo -= monto; d.saldo += monto;
      const t = { id: BD.transferencias.length + 1, origen: o.idCuenta, destino: d.idCuenta, monto, tipo: 'IBAN', detalle: b.detalle || null, fecha: dAhora() };
      BD.transferencias.push(t); guardar();
      return dOk(comprobante(t));
    }],
    ['GET', /^\/movimientos$/, () => {
      const desde = q.get('desde') || '2000-01-01'; const hasta = q.get('hasta') || '2100-01-01';
      const mias = esAdmin ? null : new Set(BD.cuentas.filter((c) => c.idCliente === sesion.idCliente && c.idEntidad === ent).map((c) => c.idCuenta));
      const filtroIban = q.get('iban') ? cuentaIban(q.get('iban'))?.idCuenta : null;
      const filtroCliente = q.get('idCliente') ? Number(q.get('idCliente')) : null;
      return dOk(BD.transferencias.filter((t) => {
        const dia = t.fecha.slice(0, 10);
        if (dia < desde || dia > hasta) return false;
        const o = cuenta(t.origen), d = cuenta(t.destino);
        if (esAdmin) {
          if (o.idEntidad !== ent && d.idEntidad !== ent) return false;
          return !filtroCliente || o.idCliente === filtroCliente || d.idCliente === filtroCliente;
        }
        if (filtroIban) return t.origen === filtroIban || t.destino === filtroIban;
        return mias.has(t.origen) || mias.has(t.destino);
      }).map((t) => {
        const o = cuenta(t.origen), d = cuenta(t.destino);
        let movimiento = null;
        if (!esAdmin) {
          const sale = filtroIban ? t.origen === filtroIban : mias.has(t.origen);
          const entra = filtroIban ? t.destino === filtroIban : mias.has(t.destino);
          movimiento = sale && entra ? 'ENTRE_MIS_CUENTAS' : sale ? 'ENVIADA' : 'RECIBIDA';
        }
        return {
          idTransferencia: t.id, fecha: t.fecha, tipo: t.tipo, movimiento, monto: t.monto, moneda: o.moneda, detalle: t.detalle,
          ibanOrigen: o.iban, titularOrigen: `${cliente(o.idCliente).nombres} ${cliente(o.idCliente).primerApellido}`, codigoOrigen: entidad(o.idEntidad).codigo,
          ibanDestino: d.iban, titularDestino: `${cliente(d.idCliente).nombres} ${cliente(d.idCliente).primerApellido}`, codigoDestino: entidad(d.idEntidad).codigo,
          telefonoOrigen: t.telO || null, telefonoDestino: t.telD || null
        };
      }).sort((x, y) => (x.fecha < y.fecha ? 1 : x.fecha > y.fecha ? -1 : y.idTransferencia - x.idTransferencia)));
    }]
  ];

  function actualizarCliente(id, datos, puedeEstado) {
    const c = cliente(id);
    if (!c) return dError('No existe el cliente', 404);
    for (const k of ['nombres', 'primerApellido', 'segundoApellido', 'correo']) if (!String(datos[k] || '').trim()) return dError('Nombre, apellidos y correo son obligatorios');
    if (BD.clientes.some((x) => x.correo === datos.correo.trim().toLowerCase() && x.idCliente !== id)) return dError('Ya existe un cliente con ese correo');
    Object.assign(c, { nombres: datos.nombres.trim(), primerApellido: datos.primerApellido.trim(), segundoApellido: datos.segundoApellido.trim(), correo: datos.correo.trim().toLowerCase() });
    if (puedeEstado && datos.estado) c.estado = datos.estado;
    guardar();
    if (!puedeEstado) demoGuardar(DEMO_SESION, { ...sesion, nombre: dNombre(c) });
    return dOk({ mensaje: 'Cliente actualizado' });
  }

  function comprobante(t) {
    const o = cuenta(t.origen), d = cuenta(t.destino);
    return {
      idTransferencia: t.id, fecha: t.fecha, tipo: t.tipo, monto: t.monto, moneda: o.moneda, detalle: t.detalle,
      ibanOrigen: o.iban, entidadOrigen: entidad(o.idEntidad).nombre, ibanDestino: d.iban, entidadDestino: entidad(d.idEntidad).nombre,
      titularDestino: dNombre(cliente(d.idCliente)), telefonoOrigen: t.telO || null, telefonoDestino: t.telD || null,
      saldoAntes: o.saldo + t.monto, saldoDespues: o.saldo
    };
  }

  for (const [m, patron, fn] of rutas) {
    const coincide = metodo === m && camino.match(patron);
    if (coincide) {
      window.rutasDemo.add(`${m} /api${camino.replace(/\/\d{8}$|\/\d+$|\/[A-Z]{2}\d{20}(?=\/|$)/, '/:id')}`);
      window.dispatchEvent(new Event('demo-usada'));
      if (!sesion && !['/entidades', '/login', '/sesion'].includes(camino)) return dError('Inicie sesión', 401);
      return fn(coincide);
    }
  }
  return dError(`La ruta ${metodo} /api${camino} no existe todavía`, 404);
}

function armarSesion(BD, u) {
  const e = ENTIDADES.find((x) => x.idEntidad === u.idEntidad);
  const c = u.idCliente ? BD.clientes.find((x) => x.idCliente === u.idCliente) : null;
  return {
    idUsuario: u.idUsuario, idCliente: u.idCliente, rol: u.rol, idEntidad: u.idEntidad,
    nombre: c ? dNombre(c) : u.nombre, identificacion: c ? c.identificacion : null,
    entidad: e.nombre, codigo: e.codigo
  };
}
