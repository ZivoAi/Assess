import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const sqlPath = path.join(__dirname, 'migrations', '001_initial.sql');
  const sql = readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  console.log('Database migrations applied successfully');
}
