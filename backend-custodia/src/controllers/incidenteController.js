const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const { registrarAuditoria } = require('../services/auditoriaService');
const { siguienteCodigo } = require('../services/codigoService');

const limpiarArchivos = (files=[]) => files.forEach(f => fs.unlink(f.path, () => {}));

const registrarIncidente = async (req,res)=>{
  const {titulo,descripcion,tipo_incidente,severidad,fecha_deteccion,area_afectada,observaciones}=req.body;
  const files=req.files||[];
  if(!titulo||!descripcion||!tipo_incidente||!severidad||!fecha_deteccion||!area_afectada){limpiarArchivos(files);return res.status(400).json({mensaje:'Faltan datos obligatorios'});}
  if(new Date(fecha_deteccion)>new Date()){limpiarArchivos(files);return res.status(400).json({mensaje:'La fecha de detección no puede estar en el futuro'});}
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');
    const codigo=await siguienteCodigo(client,'incidente');
    const r=await client.query(`INSERT INTO incidente(codigo,titulo,descripcion,tipo_incidente,severidad,fecha_deteccion,area_afectada,id_reportante,observaciones) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[codigo,titulo,descripcion,tipo_incidente,severidad,fecha_deteccion,area_afectada,req.usuario.id_usuario,observaciones||null]);
    for(const f of files){
      await client.query(`INSERT INTO incidente_adjunto(id_incidente,nombre_original,ruta_archivo,tipo_mime,tamano_bytes,id_usuario) VALUES($1,$2,$3,$4,$5,$6)`,[r.rows[0].id_incidente,f.originalname,f.path,f.mimetype,f.size,req.usuario.id_usuario]);
    }
    await client.query('COMMIT');
    await registrarAuditoria({id_usuario:req.usuario.id_usuario,accion:'Registro de Incidente Inicial',modulo:'Incidentes',id_entidad_afectada:r.rows[0].id_incidente,tipo_entidad:'incidente',detalles:`Código ${codigo}; adjuntos ${files.length}`,direccion_ip:req.ip});
    res.status(201).json({mensaje:'Incidente registrado exitosamente',datos:r.rows[0],adjuntos:files.length});
  }catch(e){await client.query('ROLLBACK');limpiarArchivos(files);console.error(e);res.status(500).json({mensaje:'Error al registrar el incidente'});}finally{client.release();}
};

const obtenerIncidentes=async(req,res)=>{
  try{
    const vals=[];const filtros=[];
    if(req.usuario.id_rol===1){vals.push(req.usuario.id_usuario);filtros.push(`i.id_reportante=$${vals.length}`);}
    if(req.query.estado){vals.push(req.query.estado);filtros.push(`LOWER(i.estado)=LOWER($${vals.length})`);}
    const r=await db.query(`SELECT i.*,u.nombre AS reportante_nombre,u.apellido AS reportante_apellido,(SELECT COUNT(*) FROM evidencia e WHERE e.id_incidente=i.id_incidente)::int AS total_evidencias,(SELECT COUNT(*) FROM incidente_adjunto a WHERE a.id_incidente=i.id_incidente)::int AS total_adjuntos FROM incidente i LEFT JOIN usuario u ON u.id_usuario=i.id_reportante ${filtros.length?'WHERE '+filtros.join(' AND '):''} ORDER BY i.fecha_registro DESC`,vals);
    res.json(r.rows);
  }catch(e){console.error(e);res.status(500).json({mensaje:'Error al obtener los incidentes'});}
};

const obtenerIncidente=async(req,res)=>{
  try{
    const vals=[req.params.id];let extra='';
    if(req.usuario.id_rol===1){vals.push(req.usuario.id_usuario);extra=' AND i.id_reportante=$2';}
    const r=await db.query(`SELECT i.*,u.nombre AS reportante_nombre,u.apellido AS reportante_apellido FROM incidente i LEFT JOIN usuario u ON u.id_usuario=i.id_reportante WHERE i.id_incidente=$1${extra}`,vals);
    if(!r.rows.length)return res.status(404).json({mensaje:'Incidente no encontrado'});
    const adj=await db.query(`SELECT id_adjunto,nombre_original,tipo_mime,tamano_bytes,fecha_registro FROM incidente_adjunto WHERE id_incidente=$1 ORDER BY fecha_registro`,[req.params.id]);
    res.json({...r.rows[0],adjuntos:adj.rows});
  }catch(e){console.error(e);res.status(500).json({mensaje:'Error al consultar incidente'});}
};

const actualizarIncidente=async(req,res)=>{
  const {titulo,descripcion,tipo_incidente,severidad,fecha_deteccion,area_afectada,observaciones}=req.body;
  try{
    const actual=await db.query('SELECT * FROM incidente WHERE id_incidente=$1',[req.params.id]);
    if(!actual.rows.length)return res.status(404).json({mensaje:'Incidente no encontrado'});
    if(req.usuario.id_rol===1&&actual.rows[0].id_reportante!==req.usuario.id_usuario)return res.status(403).json({mensaje:'Solo puedes editar tus propios incidentes'});
    if(req.usuario.id_rol===1&&actual.rows[0].estado!=='Abierto')return res.status(409).json({mensaje:'Solo se puede editar un incidente mientras está Abierto'});
    if(fecha_deteccion&&new Date(fecha_deteccion)>new Date())return res.status(400).json({mensaje:'La fecha de detección no puede estar en el futuro'});
    const r=await db.query(`UPDATE incidente SET titulo=COALESCE($1,titulo),descripcion=COALESCE($2,descripcion),tipo_incidente=COALESCE($3,tipo_incidente),severidad=COALESCE($4,severidad),fecha_deteccion=COALESCE($5,fecha_deteccion),area_afectada=COALESCE($6,area_afectada),observaciones=COALESCE($7,observaciones) WHERE id_incidente=$8 RETURNING *`,[titulo,descripcion,tipo_incidente,severidad,fecha_deteccion,area_afectada,observaciones,req.params.id]);
    await registrarAuditoria({id_usuario:req.usuario.id_usuario,accion:'Actualización de Incidente',modulo:'Incidentes',id_entidad_afectada:Number(req.params.id),tipo_entidad:'incidente',direccion_ip:req.ip});
    res.json({mensaje:'Incidente actualizado',datos:r.rows[0]});
  }catch(e){console.error(e);res.status(500).json({mensaje:'Error al actualizar incidente'});}
};

const cerrarIncidente=async(req,res)=>{
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');
    const inc=await client.query('SELECT * FROM incidente WHERE id_incidente=$1 FOR UPDATE',[req.params.id]);
    if(!inc.rows.length){await client.query('ROLLBACK');return res.status(404).json({mensaje:'Incidente no encontrado'});}
    if(inc.rows[0].estado==='Cerrado'){await client.query('ROLLBACK');return res.status(409).json({mensaje:'El caso ya se encuentra cerrado'});}
    const evidencias=await client.query('SELECT id_evidencia,estado,estado_integridad FROM evidencia WHERE id_incidente=$1',[req.params.id]);
    if(!evidencias.rows.length){await client.query('ROLLBACK');return res.status(409).json({mensaje:'RN-012: el incidente debe tener al menos una evidencia antes de cerrarse'});}
    const alertas=await client.query(`SELECT COUNT(*)::int AS total FROM alerta a JOIN evidencia e ON e.id_evidencia=a.id_evidencia WHERE e.id_incidente=$1 AND LOWER(a.estado)<>'resuelta'`,[req.params.id]);
    if(alertas.rows[0].total>0){await client.query('ROLLBACK');return res.status(409).json({mensaje:'RN-011: no se puede cerrar el caso porque existen alertas de integridad sin resolver'});}
    if(evidencias.rows.some(e=>e.estado==='Comprometida')){await client.query('ROLLBACK');return res.status(409).json({mensaje:'CP-014: no se puede cerrar el caso mientras exista evidencia en estado Comprometida'});}
    if(evidencias.rows.some(e=>e.estado!=='Archivada')){await client.query('ROLLBACK');return res.status(409).json({mensaje:'Todas las evidencias deben estar en estado Archivada antes de cerrar el caso'});}
    const r=await client.query(`UPDATE incidente SET estado='Cerrado' WHERE id_incidente=$1 RETURNING *`,[req.params.id]);
    await client.query('COMMIT');
    await registrarAuditoria({id_usuario:req.usuario.id_usuario,accion:'Cierre de Caso autorizado',modulo:'Incidentes',id_entidad_afectada:Number(req.params.id),tipo_entidad:'incidente',detalles:req.body?.observaciones||'Cierre validado por Supervisor',direccion_ip:req.ip});
    res.json({mensaje:'Caso cerrado correctamente. El reporte final está disponible en la opción PDF FINAL.',datos:r.rows[0]});
  }catch(e){await client.query('ROLLBACK');console.error(e);res.status(500).json({mensaje:'Error al cerrar el caso'});}finally{client.release();}
};

const descargarAdjunto=async(req,res)=>{
  try{
    const vals=[req.params.idAdjunto];let extra='';
    if(req.usuario.id_rol===1){vals.push(req.usuario.id_usuario);extra=' AND i.id_reportante=$2';}
    const r=await db.query(`SELECT a.*,i.id_reportante FROM incidente_adjunto a JOIN incidente i ON i.id_incidente=a.id_incidente WHERE a.id_adjunto=$1${extra}`,vals);
    if(!r.rows.length)return res.status(404).json({mensaje:'Adjunto no encontrado'});
    if(!fs.existsSync(r.rows[0].ruta_archivo))return res.status(404).json({mensaje:'El archivo adjunto ya no existe'});
    await registrarAuditoria({id_usuario:req.usuario.id_usuario,accion:'Descarga de adjunto de incidente',modulo:'Incidentes',id_entidad_afectada:Number(r.rows[0].id_incidente),tipo_entidad:'incidente',detalles:r.rows[0].nombre_original,direccion_ip:req.ip});
    res.download(r.rows[0].ruta_archivo,r.rows[0].nombre_original||path.basename(r.rows[0].ruta_archivo));
  }catch(e){console.error(e);res.status(500).json({mensaje:'Error al descargar adjunto'});}
};

module.exports={registrarIncidente,obtenerIncidentes,obtenerIncidente,actualizarIncidente,cerrarIncidente,descargarAdjunto};
