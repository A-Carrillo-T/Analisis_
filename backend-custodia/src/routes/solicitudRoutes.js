const express=require('express');const router=express.Router();const c=require('../controllers/solicitudController');const {verificarToken,verificarPermiso}=require('../middlewares/authMiddleware');
const {auditarConsulta}=require('../middlewares/auditoriaMiddleware');
router.use(verificarToken);
router.get('/',verificarPermiso('Solicitudes','ver'),auditarConsulta('Solicitudes','Consulta de solicitudes'),c.listarSolicitudes);
router.post('/',verificarPermiso('Solicitudes','crear'),c.crearSolicitud);
router.put('/:id/resolver',verificarPermiso('Solicitudes','resolver'),c.resolverSolicitud);
module.exports=router;
