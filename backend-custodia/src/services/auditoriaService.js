const db = require('../config/db');

async function registrarAuditoria({ id_usuario, accion, modulo, id_entidad_afectada = null, tipo_entidad = null, detalles = null, direccion_ip = null }) {
  await db.query(`
    INSERT INTO bitacora_auditoria
      (id_usuario, accion, modulo, id_entidad_afectada, tipo_entidad, detalles, direccion_ip)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [id_usuario, accion, modulo, id_entidad_afectada, tipo_entidad, detalles, direccion_ip]);
}

module.exports = { registrarAuditoria };
