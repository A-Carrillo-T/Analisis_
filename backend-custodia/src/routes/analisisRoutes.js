const express=require('express');const router=express.Router();const multer=require('multer');const fs=require('fs');const path=require('path');const c=require('../controllers/analisisController');const {verificarToken,verificarPermiso}=require('../middlewares/authMiddleware');
const {auditarConsulta}=require('../middlewares/auditoriaMiddleware');
const dir=path.resolve('uploads/informes');fs.mkdirSync(dir,{recursive:true});const upload=multer({dest:dir,limits:{fileSize:Number(process.env.MAX_UPLOAD_MB||50)*1024*1024,files:5}});
router.use(verificarToken);
router.get('/',verificarPermiso('Analisis','ver'),auditarConsulta('Análisis Forense','Consulta de análisis forense'),c.listarAnalisis);
router.get('/:id/adjuntos/:indice/descargar',verificarPermiso('Analisis','ver'),c.descargarAdjuntoAnalisis);
router.post('/',verificarPermiso('Analisis','crear'),upload.array('adjuntos',5),c.crearAnalisis);
router.put('/:id',verificarPermiso('Analisis','editar'),c.actualizarAnalisis);
module.exports=router;
