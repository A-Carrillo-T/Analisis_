const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { calcularHashSHA256 } = require('./hashService');
const { siguienteCodigo } = require('./codigoService');

async function generarCopiaAutorizada(client, { solicitud, evidencia, idGenerador }) {
  const existente = await client.query('SELECT * FROM copia_autorizada WHERE id_solicitud=$1', [solicitud.id_solicitud]);
  if (existente.rows.length) return existente.rows[0];
  if (!fs.existsSync(evidencia.ruta_archivo)) throw new Error('El archivo original de la evidencia no existe en el servidor');

  const dir = path.resolve('uploads/copias');
  await fsp.mkdir(dir, { recursive: true });
  const codigo = await siguienteCodigo(client, 'copia');
  const ext = path.extname(evidencia.ruta_archivo) || '.bin';
  const destino = path.join(dir, `${codigo}${ext}`);
  await fsp.copyFile(evidencia.ruta_archivo, destino);
  const hash = await calcularHashSHA256(destino);

  try {
    const result = await client.query(`
      INSERT INTO copia_autorizada
      (codigo,id_evidencia,id_solicitud,id_analista,id_generador,ruta_archivo,hash_copia)
      VALUES($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `, [codigo, evidencia.id_evidencia, solicitud.id_solicitud, solicitud.id_solicitante, idGenerador, destino, hash]);
    return result.rows[0];
  } catch (error) {
    await fsp.unlink(destino).catch(() => {});
    throw error;
  }
}

module.exports = { generarCopiaAutorizada };
