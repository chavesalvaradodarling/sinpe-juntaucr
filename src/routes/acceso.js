// Persona 1: entidades, inicio y cierre de sesión
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

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

module.exports = router;