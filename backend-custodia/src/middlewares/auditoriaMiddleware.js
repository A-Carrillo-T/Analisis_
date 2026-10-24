const { registrarAuditoria } = require('../services/auditoriaService');

function auditarConsulta(modulo, accion = 'Consulta') {
  return (req, res, next) => {
    res.on('finish', () => {
      if (!req.usuario || res.statusCode >= 400) return;
      registrarAuditoria({
        id_usuario: req.usuario.id_usuario,
        accion,
        modulo,
        tipo_entidad: 'consulta',
        detalles: `${req.method} ${req.originalUrl}`,
        direccion_ip: req.ip,
      }).catch((e) => console.error('No se pudo auditar consulta:', e.message));
    });
    next();
  };
}

module.exports = { auditarConsulta };
