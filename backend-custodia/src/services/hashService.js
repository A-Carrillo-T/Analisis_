const crypto = require('crypto');
const fs = require('fs');

/**
 * Calcula el hash SHA-256 de un archivo físico.
 * @param {string} filePath - Ruta temporal del archivo subido.
 * @returns {Promise<string>} Hash en formato hexadecimal.
 */
const calcularHashSHA256 = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

module.exports = { calcularHashSHA256 };