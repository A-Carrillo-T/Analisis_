const express=require('express');const router=express.Router();const c=require('../controllers/custodiaController');const {verificarToken,verificarPermiso}=require('../middlewares/authMiddleware');
const {auditarConsulta}=require('../middlewares/auditoriaMiddleware');
router.use(verificarToken);
router.get('/movimientos',verificarPermiso('Custodia','ver'),auditarConsulta('Custodia','Consulta de cadena de custodia'),c.listarMovimientos);
router.post('/transferir',verificarPermiso('Custodia','transferir'),c.transferirCustodia);
router.put('/movimientos/:id/resolver',verificarPermiso('Custodia','autorizar'),c.resolverTransferencia);
router.put('/movimientos/:id/recibir',verificarPermiso('Custodia','recibir'),c.recibirTransferencia);
router.get('/verificar-integridad/:id_evidencia',verificarPermiso('Evidencias','verificar_integridad'),c.verificarIntegridad);
module.exports=router;
