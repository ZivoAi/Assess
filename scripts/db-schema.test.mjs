import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// Import-only tests never connect to PostgreSQL or use production credentials.
process.env.DATABASE_URL = 'postgresql://smoke:smoke@localhost:1/smoke';
process.env.ASSESS_DB_SCHEMA = 'assess_smoke';
process.env.OPENAI_API_KEY = '';
const { pool } = await import('../dist/db/client.js');
const { runMigrations } = await import('../dist/db/migrate.js');

test('connections cannot fall back to core public tables', () => {
  assert.equal(pool.options.options, '-c search_path=assess_smoke');
});

test('migrations create the configured schema and commit on one connection', async () => {
  const calls = []; let released = false; const original = pool.connect;
  pool.connect = async () => ({ query: async (sql) => { calls.push(sql); return { rows: [] }; }, release: () => { released = true; } });
  try {
    await runMigrations();
    assert.equal(calls[0], 'BEGIN');
    assert.equal(calls[1], 'CREATE SCHEMA IF NOT EXISTS "assess_smoke"');
    assert.match(calls[2], /CREATE TABLE IF NOT EXISTS assignments/);
    assert.match(calls[2], /CREATE TABLE IF NOT EXISTS submissions/);
    assert.match(calls[2], /CREATE TABLE IF NOT EXISTS batches/);
    assert.equal(calls[3], 'COMMIT');
    assert.equal(released, true);
  } finally { pool.connect = original; }
});

test('failed migrations roll back and release the connection', async () => {
  const calls = []; let released = false; const original = pool.connect;
  pool.connect = async () => ({ query: async (sql) => { calls.push(sql); if (sql.includes('CREATE TABLE')) throw new Error('synthetic failure'); return { rows: [] }; }, release: () => { released = true; } });
  try {
    await assert.rejects(runMigrations(), /synthetic failure/);
    assert.equal(calls.at(-1), 'ROLLBACK');
    assert.equal(released, true);
  } finally { pool.connect = original; }
});

test('unsafe schema identifiers fail before any database operation', () => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./dist/config.js');"], { env: { ...process.env, ASSESS_DB_SCHEMA: 'assess; DROP SCHEMA public' }, encoding: 'utf8' });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /ASSESS_DB_SCHEMA must be/);
});

test('unset schema preserves the existing standalone public default', () => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', "const { ASSESS_DB_SCHEMA } = await import('./dist/config.js'); console.log(ASSESS_DB_SCHEMA);"], { env: { ...process.env, ASSESS_DB_SCHEMA: '' }, encoding: 'utf8' });
  assert.equal(child.status, 0);
  assert.equal(child.stdout.trim(), 'public');
});
