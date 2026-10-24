function ascii(text=''){
  return String(text??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'?');
}
function escapePdf(s){return ascii(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
function wrap(text,max=92){const words=ascii(text).split(/\s+/);const out=[];let line='';for(const w of words){if(!w)continue;if((line+' '+w).trim().length>max){if(line)out.push(line);line=w;}else line=(line+' '+w).trim();}if(line)out.push(line);return out.length?out:[''];}
function crearPdfSimple(titulo,lineas=[]){
  const normal=[];for(const l of lineas){if(l==='')normal.push('');else normal.push(...wrap(l));}
  const porPagina=48;const paginas=[];for(let i=0;i<normal.length;i+=porPagina)paginas.push(normal.slice(i,i+porPagina));if(!paginas.length)paginas.push([]);
  const objects=[];const pageRefs=[];
  objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
  objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  let next=4;
  paginas.forEach((lines,index)=>{const pageId=next++;const contentId=next++;pageRefs.push(`${pageId} 0 R`);let content=`BT\n/F1 16 Tf\n50 800 Td\n(${escapePdf(titulo)}) Tj\n/F1 9 Tf\n0 -22 Td\n`;if(index>0)content=`BT\n/F1 11 Tf\n50 800 Td\n(${escapePdf(titulo)} - continuacion) Tj\n/F1 9 Tf\n0 -20 Td\n`;for(const line of lines){content+=`(${escapePdf(line)}) Tj\n0 -14 Td\n`;}content+='ET\n';objects[contentId]=`<< /Length ${Buffer.byteLength(content,'latin1')} >>\nstream\n${content}endstream`;objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;});
  objects[2]=`<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`;
  let pdf='%PDF-1.4\n';const offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=Buffer.byteLength(pdf,'latin1');pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf,'latin1');pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf,'latin1');
}
function enviarPDF(res,nombre,titulo,lineas){const buffer=crearPdfSimple(titulo,lineas);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${nombre}"`);res.setHeader('Content-Length',buffer.length);res.end(buffer);}
module.exports={crearPdfSimple,enviarPDF};
