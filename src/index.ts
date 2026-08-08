import './config.js'; // loads dotenv early
import { createApp } from './app.js';
import { PORT } from './config.js';
import { runMigrations } from './db/migrate.js';

async function main() {
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
