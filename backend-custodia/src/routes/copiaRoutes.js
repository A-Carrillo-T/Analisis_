const express=require('express');const router=express.Router();const c=require('../controllers/copiaController');const {verificarToken,verificarPermiso}=require('../middlewares/authMiddleware');
const {auditarConsulta}=require('../middlewares/auditoriaMiddleware');
router.use(verificarToken);
router.get('/',verificarPermiso('Copias','ver'),auditarConsulta('Copias','Consulta de copias autorizadas'),c.listarCopias);
router.get('/:id/descargar',verificarPermiso('Copias','descargar'),c.descargarCopia);
module.exports=router;
