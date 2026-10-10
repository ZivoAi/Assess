import 'dotenv/config';
import { createServer } from 'node:http';
import { startWorker, gradingQueue } from './queue.js';
import { DATABASE_URL, PORT } from '../config.js';
import { pool } from '../db/client.js';

async function main() {
  if (!DATABASE_URL) throw new Error('DATABASE_URL is required for the Assess worker');
  await pool.query('SELECT 1');
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
