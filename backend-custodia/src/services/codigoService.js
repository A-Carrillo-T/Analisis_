function formatearCodigo(prefijo,anio,numero){
  return `${prefijo}-${anio}-${String(numero).padStart(4,'0')}`;
}

function anioGuatemala(){
  return Number(
    new Intl.DateTimeFormat('en-US',{
      timeZone:'America/Guatemala',
      year:'numeric'
    }).format(new Date())
  );
}

async function siguienteCodigo(client,tipo){
  const anio=anioGuatemala();
  const config={
    incidente:['seq_incidente_codigo','INC'],
    evidencia:['seq_evidencia_codigo','EVD'],
    copia:['seq_copia_codigo','CPA']
  }[tipo];

  if(!config)throw new Error(`Tipo de código inválido: ${tipo}`);

  const[secuencia,prefijo]=config;
  const{rows}=await client.query(`SELECT nextval('${secuencia}') AS n`);
  return formatearCodigo(prefijo,anio,rows[0].n);
}

module.exports={siguienteCodigo,formatearCodigo,anioGuatemala};
