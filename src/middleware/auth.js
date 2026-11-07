// Persona 1: protege las rutas. Uso en cualquier ruta:
//   router.get('/cuentas', auth(['admin']), ...)        solo administrador
//   router.get('/telefonos', auth(), ...)               cliente o administrador
// Dentro de la ruta, la sesión está en req.session.usuario:
//   { idUsuario, idCliente, rol, idEntidad, entidad, codigo, nombre, identificacion }
module.exports = (rolesPermitidos = ['cliente', 'admin']) => (req, res, next) => {
  const usuario = req.session.usuario;
  if (!usuario) {
    return res.status(401).json({ ok: false, mensaje: 'Debe iniciar sesión' });
  }
  if (!rolesPermitidos.includes(usuario.rol)) {
    return res.status(403).json({ ok: false, mensaje: 'No autorizado' });
  }
  next();
};