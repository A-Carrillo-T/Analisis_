const db=require('../config/db');
const {registrarAuditoria}=require('../services/auditoriaService');
const {generarCopiaAutorizada}=require('../services/copiaService');

const crearSolicitud=async(req,res)=>{
  const {id_evidencia,motivo,tipo_acceso='Análisis'}=req.body;
  if(!id_evidencia||!motivo)return res.status(400).json({mensaje:'Evidencia y motivo son obligatorios'});
  try{
    const ev=await db.query('SELECT id_evidencia,estado FROM evidencia WHERE id_evidencia=$1',[id_evidencia]);
    if(!ev.rows.length)return res.status(404).json({mensaje:'Evidencia no encontrada'});
    if(ev.rows[0].estado==='Comprometida')return res.status(409).json({mensaje:'No se puede solicitar acceso de análisis a una evidencia comprometida'});
    const pendiente=await db.query(`SELECT 1 FROM solicitud_acceso WHERE id_evidencia=$1 AND id_solicitante=$2 AND estado='Pendiente' LIMIT 1`,[id_evidencia,req.usuario.id_usuario]);
    if(pendiente.rows.length)return res.status(409).json({mensaje:'Ya existe una solicitud pendiente para esta evidencia'});
    const r=await db.query(`INSERT INTO solicitud_acceso(id_evidencia,id_solicitante,motivo,tipo_acceso) VALUES($1,$2,$3,$4) RETURNING *`,[id_evidencia,req.usuario.id_usuario,motivo,tipo_acceso]);
    await registrarAuditoria({id_usuario:req.usuario.id_usuario,accion:'Solicitud de acceso a copia creada',modulo:'Solicitudes',id_entidad_afectada:r.rows[0].id_solicitud,tipo_entidad:'solicitud_acceso',direccion_ip:req.ip});
    res.status(201).json({mensaje:'Solicitud creada y pendiente de aprobación del Supervisor',datos:r.rows[0]});
  }catch(e){console.error(e);res.status(500).json({mensaje:'Error al crear solicitud'});}
};

const listarSolicitudes=async(req,res)=>{
  try{
    const vals=[];const f=[];
    if(req.usuario.id_rol===5){vals.push(req.usuario.id_usuario);f.push(`s.id_solicitante=$${vals.length}`);}
    if(req.query.estado){vals.push(req.query.estado);f.push(`LOWER(s.estado)=LOWER($${vals.length})`);}
    const r=await db.query(`SELECT s.*,e.codigo AS evidencia_codigo,e.descripcion AS evidencia_descripcion,us.nombre||' '||us.apellido AS solicitante,ua.nombre||' '||ua.apellido AS aprobador,c.codigo AS copia_codigo,c.id_copia FROM solicitud_acceso s JOIN evidencia e ON e.id_evidencia=s.id_evidencia LEFT JOIN usuario us ON us.id_usuario=s.id_solicitante LEFT JOIN usuario ua ON ua.id_usuario=s.id_aprobador LEFT JOIN copia_autorizada c ON c.id_solicitud=s.id_solicitud ${f.length?'WHERE '+f.join(' AND '):''} ORDER BY s.fecha_solicitud DESC`,vals);
    res.json(r.rows);
  }catch(e){console.error(e);res.status(500).json({mensaje:'Error al consultar solicitudes'});}
};

const resolverSolicitud=async(req,res)=>{
  const {estado,observaciones}=req.body;
  if(!['Aprobada','Rechazada'].includes(estado))return res.status(400).json({mensaje:'Estado debe ser Aprobada o Rechazada'});
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');
    const q=await client.query(`SELECT s.*,e.ruta_archivo,e.id_evidencia,e.estado AS evidencia_estado FROM solicitud_acceso s JOIN evidencia e ON e.id_evidencia=s.id_evidencia WHERE s.id_solicitud=$1 FOR UPDATE`,[req.params.id]);
    if(!q.rows.length){await client.query('ROLLBACK');return res.status(404).json({mensaje:'Solicitud no encontrada'});}
    const solicitud=q.rows[0];
    if(solicitud.estado!=='Pendiente'){await client.query('ROLLBACK');return res.status(409).json({mensaje:'La solicitud ya fue resuelta'});}
    if(estado==='Aprobada'&&solicitud.evidencia_estado==='Comprometida'){await client.query('ROLLBACK');return res.status(409).json({mensaje:'No puede aprobarse acceso a una evidencia comprometida'});}
    const r=await client.query(`UPDATE solicitud_acceso SET estado=$1,id_aprobador=$2,fecha_resolucion=NOW(),observaciones=$3 WHERE id_solicitud=$4 RETURNING *`,[estado,req.usuario.id_usuario,observaciones||null,req.params.id]);
    let copia=null;
    if(estado==='Aprobada')copia=await generarCopiaAutorizada(client,{solicitud:r.rows[0],evidencia:solicitud,idGenerador:req.usuario.id_usuario});
    await client.query('COMMIT');
    await registrarAuditoria({id_usuario:req.usuario.id_usuario,accion:`Solicitud ${estado}`,modulo:'Solicitudes',id_entidad_afectada:Number(req.params.id),tipo_entidad:'solicitud_acceso',detalles:copia?`Copia autorizada ${copia.codigo} generada`:(observaciones||null),direccion_ip:req.ip});
    res.json({mensaje:estado==='Aprobada'?`Solicitud aprobada y copia autorizada ${copia.codigo} generada`:'Solicitud rechazada',datos:r.rows[0],copia});
  }catch(e){await client.query('ROLLBACK');console.error(e);res.status(500).json({mensaje:e.message||'Error al resolver solicitud'});}finally{client.release();}
};

module.exports={crearSolicitud,listarSolicitudes,resolverSolicitud};
