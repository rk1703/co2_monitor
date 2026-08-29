const fs = require('fs');
const path = require('path');
const sql = require('mssql');

// 1. Read and parse .env.local from workspace
const envPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envPath)) {
  console.error(`Error: .env.local not found at ${envPath}`);
  process.exit(1);
}

const dotenvContent = fs.readFileSync(envPath, 'utf8');
const env = {};
dotenvContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

// Setup config
const config = {
  user: env.SQL_USER || env.DB_USER,
  password: env.SQL_PASSWORD || env.DB_PASSWORD,
  server: env.SQL_SERVER || env.DB_SERVER,
  database: env.SQL_DATABASE || env.DB_DATABASE,
  port: Number(env.SQL_PORT || env.DB_PORT || '1433'),
  options: {
    encrypt: env.SQL_SERVER_ENCRYPT === 'true',
    trustServerCertificate: env.SQL_SERVER_TRUST_SERVER_CERTIFICATE !== 'false',
  },
};

const action = process.argv[2] || 'list';
const target = process.argv[3];

async function run() {
  console.log(`Connecting to SQL Server at ${config.server}...`);
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('Connected successfully.\n');
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }

  try {
    if (action === 'unlock') {
      if (!target) {
        console.error('Usage: node manage_locks.js unlock <username_or_ip>');
        process.exit(1);
      }
      console.log(`Attempting to unlock: "${target}"...`);
      const result = await pool.request()
        .input('target', sql.NVarChar(150), target)
        .query('DELETE FROM AUTH_ATTEMPTS WHERE TARGET_KEY = @target');
      
      console.log(`Unlock command completed. Rows affected: ${result.rowsAffected[0]}`);
    } else if (action === 'unlock-all') {
      console.log('Attempting to unlock ALL entries in AUTH_ATTEMPTS...');
      const result = await pool.request()
        .query('DELETE FROM AUTH_ATTEMPTS');
      console.log(`All locks cleared. Rows affected: ${result.rowsAffected[0]}`);
    } else {
      // List
      console.log('--- AUTH_ATTEMPTS TABLE CONTENT ---');
      const result = await pool.request().query('SELECT * FROM AUTH_ATTEMPTS');
      if (result.recordset.length === 0) {
        console.log('No locked accounts or failed login records found.');
      } else {
        console.table(result.recordset);
      }
    }
  } catch (err) {
    console.error('Error executing database query:', err.message);
  } finally {
    await sql.close();
  }
}

run();
