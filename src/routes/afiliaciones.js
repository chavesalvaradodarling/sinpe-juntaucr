// Persona 3: afiliaciones SINPE Móvil e historial
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Formato de respuesta: { ok: true, datos } o { ok: false, mensaje }

// Los errores de SIGNAL SQLSTATE '45000' llegan tal cual a la pantalla;
// cualquier otro error se registra y se responde con un mensaje general.
function responderError(res, err) {
  if (err.sqlState === '45000') return res.status(400).json({ ok: false, mensaje: err.message });
  console.error(err);
  res.status(500).json({ ok: false, mensaje: 'Error en el servidor' });
}

// MySQL devuelve DECIMAL como texto y GROUP_CONCAT como '88881111,88882222'
const aLista = (texto) => (texto ? String(texto).split(',') : []);
const cuentaJson = (c) => ({ ...c, saldo: Number(c.saldo), numeros: aLista(c.numeros) });

const soloDigitos = (v) => String(v || '').replace(/\D/g, '');            // '8888-1111' -> '88881111'
const limpiarIban = (v) => String(v || '').replace(/\s/g, '').toUpperCase(); // 'CR00 0000…' -> 'CR000000…'

// El cliente siempre opera sobre sí mismo; el admin elige el cliente (de su entidad).
// Para desafiliar y trasladar, el admin manda NULL: el SP solo revisa que sea de su entidad.
const clienteObjetivo = (req, delCuerpo) =>
  req.session.usuario.rol === 'admin' ? delCuerpo ?? null : req.session.usuario.idCliente;

// ----------------------------------------------------------------------------
// GET /api/afiliaciones/:idCliente (ambos): teléfonos y cuentas del cliente
// El cliente solo puede pedir los suyos.
// ----------------------------------------------------------------------------
router.get('/afiliaciones/:idCliente', auth(), async (req, res) => {
  const { rol, idEntidad, idCliente } = req.session.usuario;
  const pedido = Number(req.params.idCliente);
  if (rol === 'cliente' && pedido !== idCliente) {
    return res.status(403).json({ ok: false, mensaje: 'No autorizado' });
  }
  try {
    const [resultados] = await db.query('CALL sp_afiliaciones_cliente(?, ?)', [idEntidad, pedido]);
    res.json({
      ok: true,
      datos: {
        cliente: resultados[0][0],
        telefonos: resultados[1],
        cuentas: resultados[2].map(cuentaJson)
      }
    });
  } catch (err) {
    responderError(res, err);
  }
});

// ----------------------------------------------------------------------------
// POST /api/afiliaciones (ambos): { numero, iban, idCliente }
// El cliente NO manda idCliente: se usa el de su sesión.
// ----------------------------------------------------------------------------
router.post('/afiliaciones', auth(), async (req, res) => {
  const { idEntidad, idUsuario } = req.session.usuario;
  const titular = clienteObjetivo(req, req.body.idCliente);
  const numero = soloDigitos(req.body.numero);
  const iban = limpiarIban(req.body.iban);
  if (!titular) return res.status(400).json({ ok: false, mensaje: 'Elija el titular' });
  if (!numero || !iban) return res.status(400).json({ ok: false, mensaje: 'Elija el número y la cuenta' });
  try {
    const [resultados] = await db.query('CALL sp_afiliar(?, ?, ?, ?, ?)', [idEntidad, titular, numero, iban, idUsuario]);
    res.json({ ok: true, datos: { mensaje: resultados[0][0].mensaje } });
  } catch (err) {
    responderError(res, err);
  }
});

// ----------------------------------------------------------------------------
// DELETE /api/afiliaciones/:numero (ambos)
// ----------------------------------------------------------------------------
router.delete('/afiliaciones/:numero', auth(), async (req, res) => {
  const { idEntidad, idUsuario } = req.session.usuario;
  try {
    const [resultados] = await db.query('CALL sp_desafiliar(?, ?, ?, ?)', [
      idEntidad,
      clienteObjetivo(req, null),
      soloDigitos(req.params.numero),
      idUsuario
    ]);
    res.json({ ok: true, datos: { mensaje: resultados[0][0].mensaje } });
  } catch (err) {
    responderError(res, err);
  }
});

// ----------------------------------------------------------------------------
// POST /api/afiliaciones/:numero/traslado (ambos): { iban } = cuenta nueva
// Desafiliar + afiliar en una sola transacción (sp_trasladar).
// ----------------------------------------------------------------------------
router.post('/afiliaciones/:numero/traslado', auth(), async (req, res) => {
  const { idEntidad, idUsuario } = req.session.usuario;
  const iban = limpiarIban(req.body.iban);
  if (!iban) return res.status(400).json({ ok: false, mensaje: 'Elija la cuenta nueva' });
  try {
    const [resultados] = await db.query('CALL sp_trasladar(?, ?, ?, ?, ?)', [
      idEntidad,
      clienteObjetivo(req, null),
      soloDigitos(req.params.numero),
      iban,
      idUsuario
    ]);
    res.json({ ok: true, datos: { mensaje: resultados[0][0].mensaje } });
  } catch (err) {
    responderError(res, err);
  }
});

// ----------------------------------------------------------------------------
// GET /api/historial-afiliaciones (ambos): el cliente ve lo suyo; el admin, toda la entidad.
// Más recientes primero. Los filtros se hacen en la pantalla.
// ----------------------------------------------------------------------------
router.get('/historial-afiliaciones', auth(), async (req, res) => {
  const { rol, idEntidad, idCliente } = req.session.usuario;
  try {
    const [resultados] = await db.query('CALL sp_historial_afiliacion(?, ?)', [
      idEntidad,
      rol === 'admin' ? null : idCliente
    ]);
    res.json({ ok: true, datos: resultados[0] });
  } catch (err) {
    responderError(res, err);
  }
});

module.exports = router;
