const{ejecutarBackup}=require('../../scripts/backup');
function iniciarRespaldos(){if(process.env.ENABLE_DAILY_BACKUP!=='true')return;const cada=24*60*60*1000;console.log('Respaldos automáticos diarios habilitados');setTimeout(()=>{try{ejecutarBackup();}catch(e){console.error('Backup automático falló:',e.message);}},60*1000);setInterval(()=>{try{ejecutarBackup();}catch(e){console.error('Backup automático falló:',e.message);}},cada).unref();}
module.exports={iniciarRespaldos};
