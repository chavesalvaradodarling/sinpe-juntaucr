// Persona 2: cuentas y teléfonos
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

// MySQL devuelve los DECIMAL y los SUM como texto ('123991.00'): se pasan a número.
// GROUP_CONCAT devuelve '88881111,88882222': se pasa a lista.
const aLista = (texto) => (texto ? String(texto).split(',') : []);
const cuentaJson = (c) => ({ ...c, saldo: Number(c.saldo), numeros: aLista(c.numeros) });

// ----------------------------------------------------------------------------
// Inicio (cliente y admin)
// ----------------------------------------------------------------------------

// GET /api/resumen: tarjetas de Inicio según el rol
router.get('/resumen', auth(), async (req, res) => {
  const { rol, idEntidad, idCliente } = req.session.usuario;
  try {
    if (rol === 'admin') {
      // resultados[0] = contadores (1 fila), resultados[1] = afiliaciones vigentes
      const [resultados] = await db.query('CALL sp_resumen_entidad(?)', [idEntidad]);
      const k = resultados[0][0];
      return res.json({
        ok: true,
        datos: {
          clientes: { activos: Number(k.clientesActivos), inactivos: Number(k.clientesInactivos) },
          cuentas: {
            total: Number(k.cuentasTotal),
            bloqueadas: Number(k.cuentasBloqueadas),
            inactivas: Number(k.cuentasInactivas)
          },
          numerosAfiliados: Number(k.numerosAfiliados),
          movimientosPeriodo: Number(k.movimientosPeriodo),
          afiliaciones: resultados[1]
        }
      });
    }

    // cliente: resultados[0] = cuentas, [1] = teléfonos (1 fila), [2] = últimos movimientos
    const [resultados] = await db.query('CALL sp_resumen_cliente(?, ?)', [idEntidad, idCliente]);
    const tel = resultados[1][0];
    res.json({
      ok: true,
      datos: {
        cuentas: resultados[0].map(cuentaJson),
        telefonos: { total: Number(tel.total), afiliados: Number(tel.afiliados) },
        ultimos: resultados[2].map((m) => ({ ...m, monto: Number(m.monto) }))
      }
    });
  } catch (err) {
    responderError(res, err);
  }
});

// ----------------------------------------------------------------------------
// Cuentas IBAN
// ----------------------------------------------------------------------------

// GET /api/cuentas (admin): todas las cuentas de la entidad
router.get('/cuentas', auth(['admin']), async (req, res) => {
  try {
    const [resultados] = await db.query('CALL sp_listar_cuentas(?, NULL)', [req.session.usuario.idEntidad]);
    res.json({ ok: true, datos: resultados[0].map(cuentaJson) });
  } catch (err) {
    responderError(res, err);
  }
});

// GET /api/mis-cuentas (cliente): sus cuentas en la entidad (las usa Persona 4)
router.get('/mis-cuentas', auth(['cliente']), async (req, res) => {
  const { idEntidad, idCliente } = req.session.usuario;
  try {
    const [resultados] = await db.query('CALL sp_listar_cuentas(?, ?)', [idEntidad, idCliente]);
    res.json({ ok: true, datos: resultados[0].map(cuentaJson) });
  } catch (err) {
    responderError(res, err);
  }
});

// POST /api/cuentas (admin): { idCliente, moneda: 'CRC'|'USD', saldo, fechaApertura }
// El IBAN NO lo manda el navegador: lo genera sp_abrir_cuenta.
router.post('/cuentas', auth(['admin']), async (req, res) => {
  const { idCliente, moneda, saldo, fechaApertura } = req.body;
  if (!idCliente || !moneda) {
    return res.status(400).json({ ok: false, mensaje: 'Elija el titular y la moneda' });
  }
  try {
    const [resultados] = await db.query('CALL sp_abrir_cuenta(?, ?, ?, ?, ?)', [
      req.session.usuario.idEntidad,
      idCliente,
      moneda,
      Number(saldo) || 0,
      fechaApertura || null
    ]);
    res.json({ ok: true, datos: resultados[0][0] }); // { iban, idCuenta }
  } catch (err) {
    responderError(res, err);
  }
});

// PATCH /api/cuentas/:id/estado (admin): { estado: 'ACTIVA'|'BLOQUEADA'|'INACTIVA' }
router.patch('/cuentas/:id/estado', auth(['admin']), async (req, res) => {
  try {
    await db.query('CALL sp_cambiar_estado_cuenta(?, ?, ?)', [
      req.session.usuario.idEntidad,
      req.params.id,
      req.body.estado
    ]);
    res.json({ ok: true, datos: { mensaje: 'Estado actualizado' } });
  } catch (err) {
    responderError(res, err);
  }
});

// ----------------------------------------------------------------------------
// Teléfonos
// ----------------------------------------------------------------------------

// GET /api/telefonos (ambos): el cliente ve los suyos; el admin, los de toda la entidad
router.get('/telefonos', auth(), async (req, res) => {
  const { rol, idEntidad, idCliente } = req.session.usuario;
  try {
    const [resultados] = await db.query('CALL sp_listar_telefonos(?, ?)', [
      idEntidad,
      rol === 'admin' ? null : idCliente
    ]);
    res.json({ ok: true, datos: resultados[0] });
  } catch (err) {
    responderError(res, err);
  }
});

// POST /api/telefonos (ambos): { numero, idCliente }
// El cliente NO manda idCliente: se usa el de su sesión. Registrar NO afilia.
router.post('/telefonos', auth(), async (req, res) => {
  const { rol, idEntidad, idCliente } = req.session.usuario;
  const titular = rol === 'admin' ? req.body.idCliente : idCliente;
  const numero = String(req.body.numero || '').replace(/\D/g, ''); // '8888-1111' -> '88881111'
  if (!titular) {
    return res.status(400).json({ ok: false, mensaje: 'Elija el titular' });
  }
  try {
    await db.query('CALL sp_registrar_telefono(?, ?, ?)', [idEntidad, titular, numero]);
    res.json({ ok: true, datos: { mensaje: 'Teléfono registrado' } });
  } catch (err) {
    responderError(res, err);
  }
});

module.exports = router;
