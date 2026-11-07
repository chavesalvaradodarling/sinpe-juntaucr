// Persona 1: sesión, rol y entidad.
// PROVISIONAL: mientras no exista el login, simula una sesión para que todos puedan probar.
// Persona 1 reemplaza este archivo por la versión real.
module.exports = (rolesPermitidos = ['cliente', 'admin']) => (req, res, next) => {
  if (!req.session.usuario) {
    req.session.usuario = { idUsuario: 1, idCliente: 1, rol: 'admin', idEntidad: 1 }; // PROVISIONAL
  }
  if (!rolesPermitidos.includes(req.session.usuario.rol)) {
    return res.status(403).json({ ok: false, mensaje: 'No autorizado' });
  }
  next();
};
