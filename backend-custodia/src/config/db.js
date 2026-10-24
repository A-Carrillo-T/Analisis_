const { Pool } = require('pg');
require('dotenv').config({ override: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
});
pool.on('connect',()=>console.log('Conexión exitosa a PostgreSQL'));
pool.on('error',(error)=>console.error('Error inesperado de PostgreSQL:',error));
module.exports={query:(text,params)=>pool.query(text,params),pool};
