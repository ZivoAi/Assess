import 'dotenv/config';
import { startWorker } from './queue';

// Start the worker when run as a separate process
startWorker();

// Keep process alive
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
