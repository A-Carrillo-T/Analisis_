const db = require('../config/db');
const bcrypt = require('bcrypt');
const { registrarAuditoria } = require('../services/auditoriaService');

const listarUsuarios = async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT u.id_usuario,u.nombre,u.apellido,u.correo,u.id_rol,r.nombre AS rol_nombre,
             u.estado,u.area,u.fecha_creacion,u.ultimo_acceso
      FROM usuario u LEFT JOIN rol r ON r.id_rol=u.id_rol
      ORDER BY u.nombre,u.apellido
    `);
    res.json(result.rows);
  } catch (error) { console.error(error); res.status(500).json({mensaje:'Error al obtener usuarios'}); }
};

const listarReceptoresCustodia = async (_req,res) => {
  try{
    const r=await db.query(`SELECT u.id_usuario,u.nombre,u.apellido,u.area,u.id_rol,r.nombre AS rol_nombre FROM usuario u JOIN rol r ON r.id_rol=u.id_rol WHERE u.estado='activo' AND u.id_rol IN (2,4) ORDER BY u.nombre,u.apellido`);
    res.json(r.rows);
  }catch(e){console.error(e);res.status(500).json({mensaje:'Error al obtener receptores autorizados'});}
};

const crearUsuario = async (req,res) => {
  const {nombre,apellido,correo,password,id_rol,estado='activo',area}=req.body;
  if(!nombre||!apellido||!correo||!password||!id_rol)return res.status(400).json({mensaje:'Faltan datos obligatorios'});
  try{
    const hash=await bcrypt.hash(password,10);
    const result=await db.query(`INSERT INTO usuario(nombre,apellido,correo,contrasena_hash,id_rol,estado,area) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id_usuario,nombre,apellido,correo,id_rol,estado,area,fecha_creacion`,[nombre,apellido,correo.toLowerCase(),hash,id_rol,estado,area||null]);
    await registrarAuditoria({id_usuario:req.usuario.id_usuario,accion:'Creación de usuario',modulo:'Usuarios',id_entidad_afectada:result.rows[0].id_usuario,tipo_entidad:'usuario',detalles:`Rol ${id_rol}; área ${area||'sin asignar'}`,direccion_ip:req.ip});
    res.status(201).json({mensaje:'Usuario creado',datos:result.rows[0]});
  }catch(error){console.error(error);if(error.code==='23505')return res.status(409).json({mensaje:'El correo ya está registrado'});res.status(500).json({mensaje:'Error al crear usuario'});}
};

const actualizarUsuario = async (req,res) => {
  const {id}=req.params;const {nombre,apellido,correo,id_rol,estado,password,area}=req.body;
  try{
    const actual=await db.query('SELECT * FROM usuario WHERE id_usuario=$1',[id]);
    if(!actual.rows.length)return res.status(404).json({mensaje:'Usuario no encontrado'});
    let hash=actual.rows[0].contrasena_hash;if(password)hash=await bcrypt.hash(password,10);
    const result=await db.query(`UPDATE usuario SET nombre=$1,apellido=$2,correo=$3,id_rol=$4,estado=$5,contrasena_hash=$6,area=$7 WHERE id_usuario=$8 RETURNING id_usuario,nombre,apellido,correo,id_rol,estado,area`,[nombre??actual.rows[0].nombre,apellido??actual.rows[0].apellido,(correo??actual.rows[0].correo).toLowerCase(),id_rol??actual.rows[0].id_rol,estado??actual.rows[0].estado,hash,area===undefined?actual.rows[0].area:(area||null),id]);
    await registrarAuditoria({id_usuario:req.usuario.id_usuario,accion:'Actualización de usuario',modulo:'Usuarios',id_entidad_afectada:Number(id),tipo_entidad:'usuario',direccion_ip:req.ip});
    res.json({mensaje:'Usuario actualizado',datos:result.rows[0]});
  }catch(error){console.error(error);if(error.code==='23505')return res.status(409).json({mensaje:'El correo ya está registrado'});res.status(500).json({mensaje:'Error al actualizar usuario'});}
};
module.exports={listarUsuarios,listarReceptoresCustodia,crearUsuario,actualizarUsuario};
