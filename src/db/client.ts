import pg from 'pg';
import { DATABASE_URL, ASSESS_DB_SCHEMA } from '../config.js';

const { Pool } = pg;

if (!DATABASE_URL) {
  console.warn('DATABASE_URL is not set — database operations will fail');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway Postgres requires SSL; skip validation for self-signed certs
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err.message);
});
