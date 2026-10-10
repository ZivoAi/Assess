import pg from 'pg';
import { DATABASE_URL, ASSESS_DB_SCHEMA } from '../config.js';

const { Pool } = pg;

if (!DATABASE_URL) {
  console.warn('DATABASE_URL is not set — database operations will fail');
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  // No public-schema fallback: API and worker share only their configured schema.
  options: `-c search_path=${ASSESS_DB_SCHEMA}`,
  // Railway Postgres requires SSL; skip validation for self-signed certs
  ssl: DATABASE_URL && !DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err.message);
});
