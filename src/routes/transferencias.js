// Persona 4: transferencias SINPE Móvil / IBAN, cuentas matriculadas y movimientos
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Formato de respuesta: { ok: true, datos } o { ok: false, mensaje }

// Los errores de SIGNAL SQLSTATE '45000' llegan tal cual a la pantalla de rechazo;
// cualquier otro error se registra y se responde con un mensaje general.

function responderError(res, err) {
  if (err.sqlState === '45000') return res.status(400).json({ ok: false, mensaje: err.message });
  console.error(err);
  res.status(500).json({ ok: false, mensaje: 'Error en el servidor' });
}

const soloDigitos = (v) => String(v || '').replace(/\D/g, '');               
const limpiarIban = (v) => String(v || '').replace(/\s/g, '').toUpperCase(); 
const textoONull = (v) => {
  const t = String(v ?? '').trim();
  return t === '' ? null : t;
};

// Las transferencias y las cuentas matriculadas son solo del cliente.
function soloCliente(req, res, next) {
  if (req.session.usuario.rol !== 'cliente') {
    return res.status(403).json({ ok: false, mensaje: 'Solo para clientes' });
  }
  next();
}

// Acepta 15000, "15000" o "15 000"; rechaza texto, cero y negativos.
function leerMonto(valor) {
  const n = typeof valor === 'number' ? valor : Number(String(valor ?? '').replace(/\s/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// MySQL devuelve DECIMAL como texto: se pasan a número para la pantalla.
const comprobanteJson = (c) => ({
  ...c,
  monto: Number(c.monto),
  saldoAntes: Number(c.saldoAntes),
  saldoDespues: Number(c.saldoDespues)
});
const movimientoJson = (m) => ({ ...m, monto: Number(m.monto) });

const FECHA = /^\d{4}-\d{2}-\d{2}$/;


// GET /api/sinpe/destino/:numero (cliente): valida el número y devuelve el titular

router.get('/sinpe/destino/:numero', auth(), soloCliente, async (req, res) => {
  try {
    const [resultados] = await db.query('CALL sp_sinpe_destino(?)', [soloDigitos(req.params.numero)]);
    const d = resultados[0][0];
    res.json({ ok: true, datos: { ...d, afiliado: Boolean(d.afiliado) } });
  } catch (err) {
    responderError(res, err);
  }
});


// POST /api/transferencias/sinpe (cliente): { numeroOrigen, numeroDestino, monto, detalle }

router.post('/transferencias/sinpe', auth(), soloCliente, async (req, res) => {
  const { idEntidad, idCliente } = req.session.usuario;
  const numeroOrigen = soloDigitos(req.body.numeroOrigen);
  const numeroDestino = soloDigitos(req.body.numeroDestino);
  const monto = leerMonto(req.body.monto);
  if (!numeroOrigen || !numeroDestino) {
    return res.status(400).json({ ok: false, mensaje: 'Elija el número de origen y el de destino' });
  }
  if (monto === null) return res.status(400).json({ ok: false, mensaje: 'Digite un monto válido' });
  try {
    const [resultados] = await db.query('CALL sp_transferir_sinpe(?, ?, ?, ?, ?, ?)', [
      idEntidad,
      idCliente,
      numeroOrigen,
      numeroDestino,
      monto,
      textoONull(req.body.detalle)
    ]);
    res.json({ ok: true, datos: comprobanteJson(resultados[0][0]) });
  } catch (err) {
    responderError(res, err);
  }
});


// POST /api/transferencias/iban (cliente): { ibanOrigen, ibanDestino, monto, detalle }

router.post('/transferencias/iban', auth(), soloCliente, async (req, res) => {
  const { idEntidad, idCliente } = req.session.usuario;
  const ibanOrigen = limpiarIban(req.body.ibanOrigen);
  const ibanDestino = limpiarIban(req.body.ibanDestino);
  const monto = leerMonto(req.body.monto);
  if (!ibanOrigen || !ibanDestino) {
    return res.status(400).json({ ok: false, mensaje: 'Elija la cuenta de origen y la de destino' });
  }
  if (monto === null) return res.status(400).json({ ok: false, mensaje: 'Digite un monto válido' });
  try {
    const [resultados] = await db.query('CALL sp_transferir_iban(?, ?, ?, ?, ?, ?)', [
      idEntidad,
      idCliente,
      ibanOrigen,
      ibanDestino,
      monto,
      textoONull(req.body.detalle)
    ]);
    res.json({ ok: true, datos: comprobanteJson(resultados[0][0]) });
  } catch (err) {
    responderError(res, err);
  }
});


// GET /api/cuentas-matriculadas (cliente): terceros del cliente

router.get('/cuentas-matriculadas', auth(), soloCliente, async (req, res) => {
  try {
    const [resultados] = await db.query('CALL sp_listar_matriculadas(?)', [req.session.usuario.idCliente]);
    res.json({ ok: true, datos: resultados[0] });
  } catch (err) {
    responderError(res, err);
  }
});


// POST /api/cuentas-matriculadas (cliente): { iban } -> la cuenta matriculada

router.post('/cuentas-matriculadas', auth(), soloCliente, async (req, res) => {
  const iban = limpiarIban(req.body.iban);
  if (!iban) return res.status(400).json({ ok: false, mensaje: 'Digite el IBAN' });
  try {
    const [resultados] = await db.query('CALL sp_matricular_cuenta(?, ?)', [req.session.usuario.idCliente, iban]);
    res.json({ ok: true, datos: resultados[0][0] });
  } catch (err) {
    responderError(res, err);
  }
});


// GET /api/movimientos?desde=&hasta=&cuenta= (ambos)
// El cliente ve lo suyo; el admin, toda la entidad. Fechas AAAA-MM-DD; cuenta = IBAN.

router.get('/movimientos', auth(), async (req, res) => {
  const { rol, idEntidad, idCliente } = req.session.usuario;
  const desde = textoONull(req.query.desde);
  const hasta = textoONull(req.query.hasta);
  if ((desde && !FECHA.test(desde)) || (hasta && !FECHA.test(hasta))) {
    return res.status(400).json({ ok: false, mensaje: 'Las fechas deben tener el formato AAAA-MM-DD' });
  }
  const cuenta = textoONull(req.query.cuenta);
  try {
    const [resultados] = await db.query('CALL sp_movimientos(?, ?, ?, ?, ?)', [
      idEntidad,
      rol === 'admin' ? null : idCliente,
      desde,
      hasta,
      cuenta ? limpiarIban(cuenta) : null
    ]);
    res.json({ ok: true, datos: resultados[0].map(movimientoJson) });
  } catch (err) {
    responderError(res, err);
  }
});

module.exports = router;
