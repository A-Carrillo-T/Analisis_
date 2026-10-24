import api from '../services/api';
export async function descargarArchivo(url,nombre){
  const response=await api.get(url,{responseType:'blob'});
  const blobUrl=URL.createObjectURL(response.data);const a=document.createElement('a');a.href=blobUrl;a.download=nombre||'archivo';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(blobUrl);
}
