const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

async function initDB() {
  if (pool) return pool;
  pool = await mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'harmony_bot',
    waitForConnections: true,
    connectionLimit: 10
  });
  return pool;
}

function getPool() {
  if (!pool) throw new Error('DB pool not initialized. Call initDB() first.');
  return pool;
}

module.exports = { initDB, getPool };
