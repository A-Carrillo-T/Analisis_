const QRCode = require('qrcode');

/**
 * Genera un código QR en formato Base64.
 * @param {string} texto - El código único de la evidencia (ej. EVD-2026-0001).
 * @returns {Promise<string>} Imagen del QR en Base64.
 */
const generarQR = async (texto) => {
  try {
    return await QRCode.toDataURL(texto);
  } catch (error) {
    console.error('Error al generar QR:', error);
    throw error;
  }
};

module.exports = { generarQR };