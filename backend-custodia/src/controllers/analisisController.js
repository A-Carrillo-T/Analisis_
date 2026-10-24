const db=require('../config/db');
const fs=require('fs');
const {registrarAuditoria}=require('../services/auditoriaService');

const serializarAdjuntos=(files=[])=>files.length?JSON.stringify(files.map(f=>({nombre:f.originalname,ruta:f.path,mime:f.mimetype,tamano:f.size}))):null;
const limpiar=(files=[])=>files.forEach(f=>fs.unlink(f.path,()=>{}));

const crearAnalisis=async(req,res)=>{
  const {id_copia,herramientas,procedimiento,hallazgos,conclusiones}=req.body;
  const files=req.files||[];
  if(!id_copia||!herramientas||!procedimiento||!hallazgos||!conclusiones){limpiar(files);return res.status(400).json({mensaje:'Copia autorizada, herramientas, procedimiento, hallazgos y conclusiones son obligatorios'});}
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');
    const copia=await client.query(`SELECT c.*,e.id_incidente,e.estado_integridad FROM copia_autorizada c JOIN evidencia e ON e.id_evidencia=c.id_evidencia WHERE c.id_copia=$1`,[id_copia]);
    if(!copia.rows.length){await client.query('ROLLBACK');limpiar(files);return res.status(404).json({mensaje:'Copia autorizada no encontrada'});}
    if(copia.rows[0].id_analista!==req.usuario.id_usuario){await client.query('ROLLBACK');limpiar(files);return res.status(403).json({mensaje:'La copia no fue autorizada para este analista'});}
    if(copia.rows[0].estado!=='Activa'){await client.query('ROLLBACK');limpiar(files);return res.status(409).json({mensaje:'La copia autorizada no está activa'});}
    if(String(copia.rows[0].estado_integridad).toLowerCase()==='comprometida'){await client.query('ROLLBACK');limpiar(files);return res.status(409).json({mensaje:'No puede analizarse una evidencia comprometida'});}
    const prev=await client.query('SELECT 1 FROM analisis_forense WHERE id_copia=$1 AND fecha_fin IS NULL LIMIT 1',[id_copia]);
    if(prev.rows.length){await client.query('ROLLBACK');limpiar(files);return res.status(409).json({mensaje:'Ya existe un análisis en proceso para esta copia'});}
    const archivos=serializarAdjuntos(files);
    const r=await client.query(`INSERT INTO analisis_forense(id_evidencia,id_copia,id_analista,herramientas,procedimiento,hallazgos,conclusiones,archivos_adjuntos,fecha_inicio) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,[copia.rows[0].id_evidencia,id_copia,req.usuario.id_usuario,herramientas,procedimiento,hallazgos,conclusiones,archivos]);
    await client.query(`UPDATE evidencia SET estado='En Análisis' WHERE id_evidencia=$1 AND estado<>'Comprometida'`,[copia.rows[0].id_evidencia]);
    await client.query(`UPDATE incidente SET estado=CASE WHEN estado='Abierto' THEN 'En Investigación' ELSE estado END WHERE id_incidente=$1`,[copia.rows[0].id_incidente]);
    await client.query('COMMIT');
    await registrarAuditoria({id_usuario:req.usuario.id_usuario,accion:'Análisis forense iniciado sobre copia autorizada',modulo:'Análisis Forense',id_entidad_afectada:r.rows[0].id_analisis,tipo_entidad:'analisis_forense',detalles:`Copia ${copia.rows[0].codigo}`,direccion_ip:req.ip});
    res.status(201).json({mensaje:'Análisis registrado sobre copia autorizada',datos:r.rows[0]});
  }catch(e){await client.query('ROLLBACK');limpiar(files);console.error(e);res.status(500).json({mensaje:'Error al registrar análisis'});}finally{client.release();}
};

const listarAnalisis=async(req,res)=>{
  try{
    const vals=[];const f=[];
    if(req.usuario.id_rol===5){vals.push(req.usuario.id_usuario);f.push(`a.id_analista=$${vals.length}`);}
    if(req.query.id_evidencia){vals.push(req.query.id_evidencia);f.push(`a.id_evidencia=$${vals.length}`);}
    const r=await db.query(`SELECT a.*,e.codigo AS evidencia_codigo,c.codigo AS copia_codigo,u.nombre||' '||u.apellido AS analista FROM analisis_forense a JOIN evidencia e ON e.id_evidencia=a.id_evidencia LEFT JOIN copia_autorizada c ON c.id_copia=a.id_copia LEFT JOIN usuario u ON u.id_usuario=a.id_analista ${f.length?'WHERE '+f.join(' AND '):''} ORDER BY a.fecha_inicio DESC`,vals);
    res.json(r.rows);
  }catch(e){console.error(e);res.status(500).json({mensaje:'Error al consultar análisis'});}
};

const actualizarAnalisis=async(req,res)=>{
  const {herramientas,procedimiento,hallazgos,conclusiones,finalizar}=req.body;
  try{
    const a=await db.query('SELECT * FROM analisis_forense WHERE id_analisis=$1',[req.params.id]);
    if(!a.rows.length)return res.status(404).json({mensaje:'Análisis no encontrado'});
    if(a.rows[0].id_analista!==req.usuario.id_usuario)return res.status(403).json({mensaje:'Solo el analista responsable puede actualizar este análisis'});
    if(a.rows[0].fecha_fin)return res.status(409).json({mensaje:'El análisis ya fue finalizado y es de solo lectura'});
    const r=await db.query(`UPDATE analisis_forense SET herramientas=COALESCE($1,herramientas),procedimiento=COALESCE($2,procedimiento),hallazgos=COALESCE($3,hallazgos),conclusiones=COALESCE($4,conclusiones),fecha_fin=CASE WHEN $5::boolean THEN NOW() ELSE fecha_fin END WHERE id_analisis=$6 RETURNING *`,[herramientas,procedimiento,hallazgos,conclusiones,Boolean(finalizar),req.params.id]);
    await registrarAuditoria({id_usuario:req.usuario.id_usuario,accion:finalizar?'Análisis forense finalizado':'Análisis forense actualizado',modulo:'Análisis Forense',id_entidad_afectada:Number(req.params.id),tipo_entidad:'analisis_forense',direccion_ip:req.ip});
    res.json({mensaje:finalizar?'Análisis finalizado':'Análisis actualizado',datos:r.rows[0]});
  }catch(e){console.error(e);res.status(500).json({mensaje:'Error al actualizar análisis'});}
};

const descargarAdjuntoAnalisis=async(req,res)=>{try{const vals=[req.params.id];let filtro='';if(req.usuario.id_rol===5){vals.push(req.usuario.id_usuario);filtro=' AND id_analista=$2';}const r=await db.query(`SELECT archivos_adjuntos FROM analisis_forense WHERE id_analisis=$1${filtro}`,vals);if(!r.rows.length)return res.status(404).json({mensaje:'Análisis no encontrado o no autorizado'});let archivos=[];try{archivos=JSON.parse(r.rows[0].archivos_adjuntos||'[]');}catch{archivos=[];}const a=archivos[Number(req.params.indice)];if(!a)return res.status(404).json({mensaje:'Adjunto no encontrado'});if(!fs.existsSync(a.ruta))return res.status(404).json({mensaje:'El archivo adjunto no existe en el servidor'});await registrarAuditoria({id_usuario:req.usuario.id_usuario,accion:'Descarga de informe técnico de análisis',modulo:'Análisis Forense',id_entidad_afectada:Number(req.params.id),tipo_entidad:'analisis_forense',detalles:a.nombre,direccion_ip:req.ip});res.download(a.ruta,a.nombre||require('path').basename(a.ruta));}catch(e){console.error(e);res.status(500).json({mensaje:'Error al descargar informe técnico'});}};

module.exports={crearAnalisis,listarAnalisis,actualizarAnalisis,descargarAdjuntoAnalisis};
