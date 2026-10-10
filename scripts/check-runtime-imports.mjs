// Build-time check only: no credentials, database writes, or queued jobs.
process.env.DATABASE_URL = 'postgresql://smoke:smoke@127.0.0.1:1/smoke';
process.env.REDIS_URL = 'redis://127.0.0.1:1';
process.env.OPENAI_API_KEY = '';
process.env.ZIVOPAL_SERVICE_KEY = '';
process.env.ZIVOPAL_CORE_URL = '';

try {
  const { createApp } = await import('../dist/app.js');
  const { Worker } = await import('bullmq');
  if (typeof createApp !== 'function' || typeof Worker.prototype.waitUntilReady !== 'function') {
    throw new Error('Required production runtime exports are unavailable');
  }
  console.log('Production ESM imports verified');
  process.exit(0);
} catch (err) {
  console.error('Production ESM import check failed:', err.message);
  process.exit(1);
}
