import 'dotenv/config';
import { createServer } from 'node:http';
import { startWorker, gradingQueue } from './queue.js';
import { DATABASE_URL, PORT } from '../config.js';
import { pool } from '../db/client.js';

async function main() {
  if (!DATABASE_URL) throw new Error('DATABASE_URL is required for the Assess worker');
  // The API applies migrations; do not consume jobs before its tables exist.
  let schemaReady = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = await pool.query(
      "SELECT to_regclass('assignments') IS NOT NULL AND to_regclass('submissions') IS NOT NULL AND to_regclass('batches') IS NOT NULL AS ready",
    );
    if (result.rows[0]?.ready) { schemaReady = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (!schemaReady) throw new Error('Assess schema is not initialized; start the API first');
  const worker = startWorker();
  await worker.waitUntilReady();

  const server = createServer((req, res) => {
    res.statusCode = req.url === '/health' ? 200 : 404;
    res.end(req.url === '/health' ? 'ok' : 'Not found');
  });
  server.listen(PORT, () => console.log(`Assess worker health server listening on port ${PORT}`));

  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    server.close();
    await worker.close();
    await gradingQueue.close();
    await pool.end();
  }
  process.on('SIGINT', () => { void stop().then(() => process.exit(0)); });
  process.on('SIGTERM', () => { void stop().then(() => process.exit(0)); });
}

main().catch(() => {
  console.error('Assess worker failed to start; check DATABASE_URL, REDIS_URL, and service logs');
  process.exit(1);
});
