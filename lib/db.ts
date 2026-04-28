import sql from 'mssql';

type EnvConnectionDetails = {
  server: string;
  database: string;
  user: string;
  password: string;
  port: number;
};

let pool: sql.ConnectionPool | null = null;
let configCache: sql.config | null = null;

function readEnvConnectionDetails(): EnvConnectionDetails {
  const server = process.env.SQL_SERVER ?? process.env.DB_SERVER;
  const database = process.env.SQL_DATABASE ?? process.env.DB_DATABASE;
  const user = process.env.SQL_USER ?? process.env.DB_USER;
  const password = process.env.SQL_PASSWORD ?? process.env.DB_PASSWORD;
  const portValue = process.env.SQL_PORT ?? process.env.DB_PORT ?? '1433';
  const port = Number(portValue);

  if (!server) {
    throw new Error('Missing SQL_SERVER or DB_SERVER in .env');
  }

  if (!database) {
    throw new Error('Missing SQL_DATABASE or DB_DATABASE in .env');
  }

  if (!user) {
    throw new Error('Missing SQL_USER or DB_USER in .env');
  }

  if (!password) {
    throw new Error('Missing SQL_PASSWORD or DB_PASSWORD in .env');
  }

  if (Number.isNaN(port)) {
    throw new Error('Invalid SQL_PORT or DB_PORT in .env');
  }

  return {
    server,
    database,
    user,
    password,
    port,
  };
}

function getConnectionConfig(): sql.config {
  if (!configCache) {
    const details = readEnvConnectionDetails();

    configCache = {
      user: details.user,
      password: details.password,
      server: details.server,
      database: details.database,
      port: details.port,
      options: {
        encrypt: process.env.SQL_SERVER_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_SERVER_TRUST_SERVER_CERTIFICATE !== 'false',
      },
    };
  }

  return configCache;
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = new sql.ConnectionPool(getConnectionConfig());
    pool.on('error', () => {
      pool = null;
    });
  }

  if (!pool.connected) {
    await pool.connect();
  }

  return pool;
}

export function quoteIdentifier(identifier: string): string {
  return `[${identifier.replace(/]/g, ']]')}]`;
}

export function quoteQualifiedName(name: string): string {
  return name
    .split('.')
    .map((segment) => quoteIdentifier(segment.trim()))
    .join('.');
}