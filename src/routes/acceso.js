// Persona 1: entidades, inicio y cierre de sesión
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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

// GET /api/entidades (público): llena el combo del login
router.get('/entidades', async (req, res) => {
  try {
    const [filas] = await db.query(
      'SELECT id_entidad AS idEntidad, codigo, nombre FROM entidad_financiera ORDER BY nombre'
    );
    res.json({ ok: true, datos: filas });
  } catch (err) {
    responderError(res, err);
  }
});

// POST /api/login (público): { idEntidad, usuario, contrasena }
router.post('/login', async (req, res) => {
  const { idEntidad, usuario, contrasena } = req.body;
  if (!idEntidad || !usuario || !contrasena) {
    return res.status(400).json({ ok: false, mensaje: 'Complete entidad, usuario y contraseña' });
  }
  try {
    // 1. MySQL busca la ficha del usuario en esa entidad (o lanza SIGNAL)
    const [resultados] = await db.query('CALL sp_login(?, ?)', [idEntidad, usuario]);
    const ficha = resultados[0][0];

    // 2. Node compara la contraseña escrita contra el hash guardado
    const coincide = await bcrypt.compare(contrasena, ficha.contrasena);
    if (!coincide) {
      return res.status(401).json({ ok: false, mensaje: 'Usuario o contraseña incorrectos' });
    }

    // 3. Se guarda la sesión SIN la contraseña
    delete ficha.contrasena;
    req.session.usuario = ficha;
    res.json({ ok: true, datos: ficha });
  } catch (err) {
    responderError(res, err);
  }
});

// POST /api/logout: borra la sesión
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true, datos: true }));
});

// GET /api/sesion: quién está conectado (lo usa el menú de todas las pantallas)
router.get('/sesion', (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({ ok: false, mensaje: 'No hay sesión' });
  }
  res.json({ ok: true, datos: req.session.usuario });
});

// ----------------------------------------------------------------------------
// Mis datos (cliente)
// ----------------------------------------------------------------------------

// GET /api/perfil: los datos del cliente que inició sesión
router.get('/perfil', auth(['cliente']), async (req, res) => {
  try {
    const [filas] = await db.query(
      `SELECT id_cliente AS idCliente, identificacion, nombres,
              primer_apellido AS primerApellido, segundo_apellido AS segundoApellido,
              CONCAT(nombres, ' ', primer_apellido, ' ', segundo_apellido) AS nombre,
              correo, fecha_registro AS fechaRegistro, estado
       FROM cliente WHERE id_cliente = ?`,
      [req.session.usuario.idCliente]
    );
    res.json({ ok: true, datos: filas[0] });
  } catch (err) {
    responderError(res, err);
  }
});

// PUT /api/perfil: { nombres, primerApellido, segundoApellido, correo }
// El cliente NO cambia su propio estado: se manda NULL.
router.put('/perfil', auth(['cliente']), async (req, res) => {
  const { nombres, primerApellido, segundoApellido, correo } = req.body;
  const { idEntidad, idCliente } = req.session.usuario;
  try {
    await db.query('CALL sp_editar_cliente(?, ?, ?, ?, ?, ?, NULL)',
      [idEntidad, idCliente, nombres, primerApellido, segundoApellido, correo]);
    // el nombre del menú sale de la sesión: se actualiza
    req.session.usuario.nombre = `${nombres} ${primerApellido} ${segundoApellido}`;
    res.json({ ok: true, datos: { mensaje: 'Datos actualizados' } });
  } catch (err) {
    responderError(res, err);
  }
});

// ----------------------------------------------------------------------------
// Clientes (administrador)
// ----------------------------------------------------------------------------

// GET /api/clientes: clientes de la entidad de la sesión
router.get('/clientes', auth(['admin']), async (req, res) => {
  try {
    const [resultados] = await db.query('CALL sp_listar_clientes(?)', [req.session.usuario.idEntidad]);
    const clientes = resultados[0].map((c) => ({
      ...c,
      telefonos: c.telefonos ? c.telefonos.split(',') : []   // '88881111,88882222' -> ['88881111', '88882222']
    }));
    res.json({ ok: true, datos: clientes });
  } catch (err) {
    responderError(res, err);
  }
});

// Usuario sugerido: primer nombre + primer apellido, sin tildes ni espacios ("ana.mora")
const limpiar = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '');

// POST /api/clientes: { identificacion, nombres, primerApellido, segundoApellido, correo }
router.post('/clientes', auth(['admin']), async (req, res) => {
  const { identificacion, nombres, primerApellido, segundoApellido, correo } = req.body;
  if (!identificacion || !nombres || !primerApellido || !segundoApellido || !correo) {
    return res.status(400).json({ ok: false, mensaje: 'Complete todos los datos del cliente' });
  }
  try {
    const usuario = `${limpiar(nombres.split(' ')[0])}.${limpiar(primerApellido)}`;
    const contrasenaTemporal = crypto.randomBytes(4).toString('hex');   // 8 caracteres, ej. 'a3f9c210'
    const hash = await bcrypt.hash(contrasenaTemporal, 10);

    const [resultados] = await db.query('CALL sp_registrar_cliente(?, ?, ?, ?, ?, ?, ?, ?)',
      [req.session.usuario.idEntidad, identificacion, nombres, primerApellido, segundoApellido, correo, usuario, hash]);
    const nuevo = resultados[0][0];   // { idCliente, usuario }

    // La contraseña temporal se muestra UNA vez al admin para entregarla; en la BD solo queda el hash
    res.json({ ok: true, datos: { idCliente: nuevo.idCliente, usuario: nuevo.usuario, contrasenaTemporal } });
  } catch (err) {
    responderError(res, err);
  }
});

// PUT /api/clientes/:id: { nombres, primerApellido, segundoApellido, correo, estado }
router.put('/clientes/:id', auth(['admin']), async (req, res) => {
  const { nombres, primerApellido, segundoApellido, correo, estado } = req.body;
  try {
    await db.query('CALL sp_editar_cliente(?, ?, ?, ?, ?, ?, ?)',
      [req.session.usuario.idEntidad, req.params.id, nombres, primerApellido, segundoApellido, correo, estado]);
    res.json({ ok: true, datos: { mensaje: 'Cliente actualizado' } });
  } catch (err) {
    responderError(res, err);
  }
});

module.exports = router;