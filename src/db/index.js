const mysql = require('mysql2/promise');
const { DB_HOST, DB_USER, DB_PASS, DB_NAME } = require('../config/env');

let pool;

async function initDB() {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
}

async function query(sql, params) {
  const db = await initDB();
  const [rows] = await db.execute(sql, params);
  return rows;
}

module.exports = {
  initDB,
  query
};
