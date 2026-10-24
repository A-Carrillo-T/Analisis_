const db=require('../config/db');
const fs=require('fs');
const path=require('path');
const {calcularHashSHA256}=require('../services/hashService');
const {generarQR}=require('../services/qrService');
const {registrarAuditoria}=require('../services/auditoriaService');
const {siguienteCodigo}=require('../services/codigoService');

const registrarEvidencia=async(req,res)=>{
  const {descripcion,tipo_evidencia,origen,metodo_recoleccion,id_incidente,fecha_recoleccion,ubicacion_fisica,ubicacion_logica,observaciones}=req.body;
  const archivo=req.file;
  if(!archivo)return res.status(400).json({mensaje:'Debe adjuntar un archivo de evidencia'});
  if(!descripcion||!tipo_evidencia||!origen||!id_incidente||!fecha_recoleccion){fs.unlink(archivo.path,()=>{});return res.status(400).json({mensaje:'Descripción, tipo, origen, fecha de recolección, incidente y archivo son obligatorios'});}
  if(new Date(fecha_recoleccion)>new Date()){fs.unlink(archivo.path,()=>{});return res.status(400).json({mensaje:'La fecha de recolección no puede estar en el futuro'});}
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');
    const inc=await client.query('SELECT id_incidente,estado FROM incidente WHERE id_incidente=$1',[id_incidente]);
    if(!inc.rows.length){await client.query('ROLLBACK');fs.unlink(archivo.path,()=>{});return res.status(404).json({mensaje:'Incidente no encontrado'});}
    if(inc.rows[0].estado==='Cerrado'){await client.query('ROLLBACK');fs.unlink(archivo.path,()=>{});return res.status(409).json({mensaje:'No se puede registrar evidencia en un caso cerrado'});}
    const hash=await calcularHashSHA256(archivo.path);
    const codigo=await siguienteCodigo(client,'evidencia');
    const qr=await generarQR(codigo);
    const r=await client.query(`INSERT INTO evidencia(fecha_recoleccion,codigo,descripcion,tipo_evidencia,origen,metodo_recoleccion,hash_original,estado_integridad,ruta_archivo,codigo_qr,ubicacion_fisica,ubicacion_logica,id_incidente,id_recolector,id_custodio_actual,observaciones) VALUES($1,$2,$3,$4,$5,$6,$7,'Pendiente',$8,$9,$10,$11,$12,$13,$13,$14) RETURNING *`,[fecha_recoleccion,codigo,descripcion,tipo_evidencia,origen,metodo_recoleccion||null,hash,archivo.path,qr,ubicacion_fisica||null,ubicacion_logica||null,id_incidente,req.usuario.id_usuario,observaciones||null]);
    await client.query(`UPDATE incidente SET estado=CASE WHEN estado='Abierto' THEN 'En Investigación' ELSE estado END WHERE id_incidente=$1`,[id_incidente]);
    await client.query('COMMIT');
    await registrarAuditoria({id_usuario:req.usuario.id_usuario,accion:'Registro de Evidencia y Cálculo Hash SHA-256',modulo:'Evidencias',id_entidad_afectada:r.rows[0].id_evidencia,tipo_entidad:'evidencia',detalles:`${codigo}; SHA-256 ${hash}`,direccion_ip:req.ip});
    res.status(201).json({mensaje:'Evidencia registrada exitosamente',datos:r.rows[0]});
  }catch(e){await client.query('ROLLBACK');console.error(e);if(archivo?.path)fs.unlink(archivo.path,()=>{});res.status(500).json({mensaje:'Error al registrar la evidencia'});}finally{client.release();}
};

const filtrosVisibilidad=(req,alias='e')=>{
  const vals=[];const f=[];
  // El reportante no tiene permiso Evidencias.ver, pero se conserva defensa en profundidad.
  if(req.usuario.id_rol===1){vals.push(req.usuario.id_usuario);f.push(`${alias}.id_incidente IN (SELECT id_incidente FROM incidente WHERE id_reportante=$${vals.length})`);}
  return {vals,f};
};

const listarEvidencias=async(req,res)=>{
  try{
    const {vals,f}=filtrosVisibilidad(req);
    if(req.query.id_incidente){vals.push(req.query.id_incidente);f.push(`e.id_incidente=$${vals.length}`);}
    if(req.query.estado){vals.push(req.query.estado);f.push(`LOWER(e.estado)=LOWER($${vals.length})`);}
    const r=await db.query(`SELECT e.*,i.codigo AS incidente_codigo,i.titulo AS incidente_titulo,ur.nombre||' '||ur.apellido AS recolector,uc.nombre||' '||uc.apellido AS custodio_actual,uc.area AS custodio_area FROM evidencia e LEFT JOIN incidente i ON i.id_incidente=e.id_incidente LEFT JOIN usuario ur ON ur.id_usuario=e.id_recolector LEFT JOIN usuario uc ON uc.id_usuario=e.id_custodio_actual ${f.length?'WHERE '+f.join(' AND '):''} ORDER BY e.fecha_registro DESC`,vals);
    res.json(r.rows);
  }catch(e){console.error(e);res.status(500).json({mensaje:'Error al obtener evidencias'});}
};

const obtenerEvidencia=async(req,res)=>{
  try{
    const r=await db.query(`SELECT e.*,i.codigo AS incidente_codigo,i.titulo AS incidente_titulo,ur.nombre||' '||ur.apellido AS recolector,uc.nombre||' '||uc.apellido AS custodio_actual,uc.area AS custodio_area FROM evidencia e LEFT JOIN incidente i ON i.id_incidente=e.id_incidente LEFT JOIN usuario ur ON ur.id_usuario=e.id_recolector LEFT JOIN usuario uc ON uc.id_usuario=e.id_custodio_actual WHERE e.id_evidencia=$1`,[req.params.id]);
    if(!r.rows.length)return res.status(404).json({mensaje:'Evidencia no encontrada'});
    res.json(r.rows[0]);
  }catch(e){console.error(e);res.status(500).json({mensaje:'Error al consultar evidencia'});}
};

const actualizarEvidencia=async(req,res)=>{
  const {estado,ubicacion_fisica,ubicacion_logica,observaciones}=req.body;
  const estados=['Recolectada','En Custodia','En Análisis','Archivada','Comprometida'];

  if(estado&&!estados.includes(estado)){
    return res.status(400).json({mensaje:'Estado de evidencia no permitido'});
  }

  try{
    const actual=await db.query(
      `SELECT id_evidencia,id_custodio_actual,estado,estado_integridad
       FROM evidencia
       WHERE id_evidencia=$1`,
      [req.params.id]
    );

    if(!actual.rows.length){
      return res.status(404).json({mensaje:'Evidencia no encontrada'});
    }

    const evidencia=actual.rows[0];

    if(evidencia.id_custodio_actual!==req.usuario.id_usuario){
      return res.status(403).json({
        mensaje:'Solo el custodio actual puede actualizar la ubicación o archivar esta evidencia'
      });
    }

    if(['Archivada','Comprometida'].includes(evidencia.estado)){
      return res.status(409).json({
        mensaje:`La evidencia en estado ${evidencia.estado} ya no admite modificaciones operativas`
      });
    }

    const estadoDestino=estado||evidencia.estado;

    if(estadoDestino!==evidencia.estado){
      const transicionPermitida=
        evidencia.estado==='En Custodia'&&
        estadoDestino==='Archivada';

      if(!transicionPermitida){
        return res.status(409).json({
          mensaje:`Transición de estado no permitida: ${evidencia.estado} -> ${estadoDestino}`
        });
      }
    }

    if(estadoDestino==='Archivada'){
      const [al,analisis]=await Promise.all([
        db.query(
          `SELECT 1
           FROM alerta
           WHERE id_evidencia=$1
             AND LOWER(estado)<>'resuelta'
           LIMIT 1`,
          [req.params.id]
        ),
        db.query(
          `SELECT 1
           FROM analisis_forense
           WHERE id_evidencia=$1
             AND fecha_fin IS NULL
           LIMIT 1`,
          [req.params.id]
        )
      ]);

      if(al.rows.length){
        return res.status(409).json({
          mensaje:'No se puede archivar una evidencia mientras tenga alertas activas'
        });
      }

      if(String(evidencia.estado_integridad).toLowerCase().includes('comprom')){
        return res.status(409).json({
          mensaje:'No se puede archivar una evidencia con integridad comprometida'
        });
      }

      if(analisis.rows.length){
        return res.status(409).json({
          mensaje:'No se puede archivar una evidencia mientras tenga análisis forenses en proceso'
        });
      }
    }

    const r=await db.query(
      `UPDATE evidencia
       SET estado=$1,
           ubicacion_fisica=COALESCE($2,ubicacion_fisica),
           ubicacion_logica=COALESCE($3,ubicacion_logica),
           observaciones=COALESCE($4,observaciones)
       WHERE id_evidencia=$5
       RETURNING *`,
      [
        estadoDestino,
        ubicacion_fisica,
        ubicacion_logica,
        observaciones,
        req.params.id
      ]
    );

    await registrarAuditoria({
      id_usuario:req.usuario.id_usuario,
      accion:estadoDestino==='Archivada'&&evidencia.estado!=='Archivada'
        ?'Evidencia archivada'
        :'Actualización controlada de Evidencia',
      modulo:'Evidencias',
      id_entidad_afectada:Number(req.params.id),
      tipo_entidad:'evidencia',
      detalles:`Estado: ${evidencia.estado} -> ${estadoDestino}`,
      direccion_ip:req.ip
    });

    res.json({mensaje:'Evidencia actualizada',datos:r.rows[0]});
  }catch(e){
    console.error(e);
    res.status(500).json({mensaje:'Error al actualizar evidencia'});
  }
};

const descargarEvidencia=async(req,res)=>{
  try{
    const r=await db.query('SELECT codigo,ruta_archivo,id_custodio_actual FROM evidencia WHERE id_evidencia=$1',[req.params.id]);
    if(!r.rows.length)return res.status(404).json({mensaje:'Evidencia no encontrada'});
    const evidencia=r.rows[0];
    if(evidencia.id_custodio_actual!==req.usuario.id_usuario)return res.status(403).json({mensaje:'Solo el custodio actual puede descargar el archivo original. Los analistas trabajan con copias autorizadas.'});
    if(!fs.existsSync(evidencia.ruta_archivo))return res.status(404).json({mensaje:'El archivo físico ya no existe en el servidor'});
    await registrarAuditoria({id_usuario:req.usuario.id_usuario,accion:'Descarga controlada de Evidencia Original',modulo:'Evidencias',id_entidad_afectada:Number(req.params.id),tipo_entidad:'evidencia',direccion_ip:req.ip});
    res.download(evidencia.ruta_archivo,`${evidencia.codigo}-${path.basename(evidencia.ruta_archivo)}`);
  }catch(e){console.error(e);res.status(500).json({mensaje:'Error al descargar evidencia'});}
};

module.exports={registrarEvidencia,listarEvidencias,obtenerEvidencia,actualizarEvidencia,descargarEvidencia};
