const db=require('../config/db');
async function permiso(idRol,modulo,accion){const r=await db.query(`SELECT 1 FROM rol_permiso rp JOIN permiso p ON p.id_permiso=rp.id_permiso WHERE rp.id_rol=$1 AND LOWER(p.modulo)=LOWER($2) AND LOWER(p.accion)=LOWER($3) LIMIT 1`,[idRol,modulo,accion]);return Boolean(r.rows.length);}
const dashboard=async(req,res)=>{try{
  const own=req.usuario.id_rol===1;const vals=own?[req.usuario.id_usuario]:[];const incWhere=own?'WHERE id_reportante=$1':'';
  const incidentes=(await db.query(`SELECT COUNT(*)::int total FROM incidente ${incWhere} ${incWhere?'AND':'WHERE'} estado<>'Cerrado'`,vals)).rows[0].total;
  const puedeEv=await permiso(req.usuario.id_rol,'Evidencias','ver');const puedeAl=await permiso(req.usuario.id_rol,'Alertas','ver');const puedeSol=await permiso(req.usuario.id_rol,'Solicitudes','ver');
  let evidencias=0,alertas=0,solicitudes=0,semaforo={Integra:0,Pendiente:0,Comprometida:0};
  if(puedeEv){evidencias=(await db.query(`SELECT COUNT(*)::int total FROM evidencia WHERE estado<>'Archivada'`)).rows[0].total;const s=await db.query(`SELECT estado_integridad,COUNT(*)::int total FROM evidencia GROUP BY estado_integridad`);for(const x of s.rows)semaforo[x.estado_integridad]=x.total;}
  if(puedeAl)alertas=(await db.query(`SELECT COUNT(*)::int total FROM alerta WHERE LOWER(estado)<>'resuelta'`)).rows[0].total;
  if(puedeSol)solicitudes=req.usuario.id_rol===5?(await db.query(`SELECT COUNT(*)::int total FROM solicitud_acceso WHERE id_solicitante=$1 AND estado='Pendiente'`,[req.usuario.id_usuario])).rows[0].total:(await db.query(`SELECT COUNT(*)::int total FROM solicitud_acceso WHERE estado='Pendiente'`)).rows[0].total;
  const auditVals=[req.usuario.id_usuario];let auditWhere='WHERE b.id_usuario=$1';if(await permiso(req.usuario.id_rol,'Auditoria','ver')){auditVals.length=0;auditWhere='';}
  const actividad=(await db.query(`SELECT b.id_registro,b.fecha_hora,b.accion,b.modulo,b.tipo_entidad,b.id_entidad_afectada,u.nombre,u.apellido FROM bitacora_auditoria b LEFT JOIN usuario u ON u.id_usuario=b.id_usuario ${auditWhere} ORDER BY b.fecha_hora DESC LIMIT 8`,auditVals)).rows;
  res.json({incidentes,evidencias,alertas,solicitudes,semaforo,actividad,visibilidad:{evidencias:puedeEv,alertas:puedeAl,solicitudes:puedeSol}});
}catch(e){console.error(e);res.status(500).json({mensaje:'Error al cargar el panel'});}};
module.exports={dashboard};
