import './config.js'; // loads dotenv early
import { createApp } from './app.js';
import { PORT, DATABASE_URL } from './config.js';
import { runMigrations } from './db/migrate.js';

async function main() {
  if (!DATABASE_URL) throw new Error('DATABASE_URL is required for the Assess API');
  await runMigrations();

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Assess server running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
