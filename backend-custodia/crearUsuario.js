const bcrypt = require('bcrypt');
const db = require('./src/config/db');

async function crearAdmin() {
  try {
    // Genera un hash real válido para "123456"
    const hash = await bcrypt.hash('123456', 10);
    
    // Inserta o actualiza el usuario en Neon DB
    await db.query(`
      INSERT INTO usuario (nombre, apellido, correo, contrasena_hash, id_rol, estado) 
      VALUES ('Juan', 'Pérez', 'admin@custodia.com', $1, 7, 'activo')
      ON CONFLICT (correo) DO UPDATE SET contrasena_hash = $1
    `, [hash]);
    
    console.log('✅ Usuario admin actualizado con un hash válido.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

crearAdmin();