const express=require('express');const router=express.Router();const c=require('../controllers/usuarioController');const {verificarToken,verificarPermiso}=require('../middlewares/authMiddleware');
const {auditarConsulta}=require('../middlewares/auditoriaMiddleware');
router.use(verificarToken);
router.get('/receptores-custodia',verificarPermiso('Custodia','transferir'),auditarConsulta('Custodia','Consulta de receptores autorizados'),c.listarReceptoresCustodia);
router.get('/',verificarPermiso('Usuarios','ver'),auditarConsulta('Usuarios','Consulta de usuarios'),c.listarUsuarios);
router.post('/',verificarPermiso('Usuarios','crear'),c.crearUsuario);
router.put('/:id',verificarPermiso('Usuarios','editar'),c.actualizarUsuario);
module.exports=router;
