const jwt = require('jsonwebtoken');
const db = require('../config/db');

const verificarToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ mensaje: 'No se proporcionó un token de seguridad válido' });
  }
  try {
    const token = authorization.slice(7);
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (_error) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
};

const verificarRol = (rolesPermitidos) => (req, res, next) => {
  if (!req.usuario || !rolesPermitidos.includes(req.usuario.id_rol)) {
    return res.status(403).json({ mensaje: 'Acceso denegado: no tienes el rol requerido' });
  }
  next();
};

// RBAC estricto: no existe bypass por Administrador. Todo acceso debe existir en rol_permiso.
const verificarPermiso = (modulo, accion) => async (req, res, next) => {
  try {
    if (!req.usuario) return res.status(401).json({ mensaje: 'Usuario no autenticado' });
    const result = await db.query(`
      SELECT 1
      FROM rol_permiso rp
      JOIN permiso p ON p.id_permiso = rp.id_permiso
      JOIN usuario u ON u.id_rol = rp.id_rol
      WHERE u.id_usuario = $1
        AND u.estado = 'activo'
        AND LOWER(p.modulo) = LOWER($2)
        AND LOWER(p.accion) = LOWER($3)
      LIMIT 1
    `, [req.usuario.id_usuario, modulo, accion]);
    if (result.rows.length) return next();
    return res.status(403).json({ mensaje: `Acceso denegado: falta permiso ${modulo}.${accion}` });
  } catch (error) {
    console.error('Error validando permiso:', error);
    return res.status(500).json({ mensaje: 'No fue posible validar los permisos' });
  }
};

module.exports = { verificarToken, verificarRol, verificarPermiso };
