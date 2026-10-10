import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from './client.js';
import { ASSESS_DB_SCHEMA } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const sql = readFileSync(path.join(__dirname, 'migrations', '001_initial.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Configuration validation allows only a safe identifier; quote it as well.
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${ASSESS_DB_SCHEMA}"`);
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Assess database schema is ready');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
