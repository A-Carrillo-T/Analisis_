const db=require('../config/db');
const fs=require('fs');
const path=require('path');
const {registrarAuditoria}=require('../services/auditoriaService');

const listarCopias=async(req,res)=>{
  try{
    const vals=[];const f=[];
    if(req.usuario.id_rol===5){vals.push(req.usuario.id_usuario);f.push(`c.id_analista=$${vals.length}`);}
    const r=await db.query(`SELECT c.id_copia,c.codigo,c.id_evidencia,c.id_solicitud,c.id_analista,c.hash_copia,c.estado,c.fecha_generacion,e.codigo AS evidencia_codigo,e.descripcion AS evidencia_descripcion,u.nombre||' '||u.apellido AS analista,g.nombre||' '||g.apellido AS generador FROM copia_autorizada c JOIN evidencia e ON e.id_evidencia=c.id_evidencia JOIN usuario u ON u.id_usuario=c.id_analista JOIN usuario g ON g.id_usuario=c.id_generador ${f.length?'WHERE '+f.join(' AND '):''} ORDER BY c.fecha_generacion DESC`,vals);
    res.json(r.rows);
  }catch(e){console.error(e);res.status(500).json({mensaje:'Error al consultar copias autorizadas'});}
};

const descargarCopia=async(req,res)=>{
  try{
    const r=await db.query('SELECT * FROM copia_autorizada WHERE id_copia=$1',[req.params.id]);
    if(!r.rows.length)return res.status(404).json({mensaje:'Copia no encontrada'});
    const c=r.rows[0];
    if(req.usuario.id_rol===5&&c.id_analista!==req.usuario.id_usuario)return res.status(403).json({mensaje:'Esta copia fue autorizada para otro analista'});
    if(c.estado!=='Activa')return res.status(409).json({mensaje:'La copia ya no está activa'});
    if(!fs.existsSync(c.ruta_archivo))return res.status(404).json({mensaje:'El archivo de la copia no existe'});
    await registrarAuditoria({id_usuario:req.usuario.id_usuario,accion:'Descarga de Copia Autorizada',modulo:'Copias',id_entidad_afectada:c.id_copia,tipo_entidad:'copia_autorizada',detalles:c.codigo,direccion_ip:req.ip});
    res.download(c.ruta_archivo,`${c.codigo}-${path.basename(c.ruta_archivo)}`);
  }catch(e){console.error(e);res.status(500).json({mensaje:'Error al descargar copia'});}
};
module.exports={listarCopias,descargarCopia};
