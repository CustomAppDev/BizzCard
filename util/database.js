const mysql = require("mysql2");

const pool = mysql.createPool({
  host: process.env.SQL_HOST,
  user: process.env.SQL_DEFAULT_USER,
  database: process.env.SQL_DEFAULT_DATABASE,
  password: process.env.SQL_PASSWORD,
  dateStrings: true,
});

module.exports = pool.promise();
