import { OPENAI_API_KEY, ZIVOPAL_CORE_URL, ZIVOPAL_SERVICE_KEY } from '../config.js';

// Optional operator probe: no assignments, submissions, grades, or notifications.
export async function runServiceSmoke(): Promise<void> {
  if (process.env.RUN_SERVICE_SMOKE_TESTS !== '1') return;
  if (!OPENAI_API_KEY.trim()) throw new Error('OPENAI_API_KEY is required for the live check');
  if (!ZIVOPAL_CORE_URL.trim()) throw new Error('ZIVOPAL_CORE_URL is required for the live check');
  if (!ZIVOPAL_SERVICE_KEY.trim()) throw new Error('ZIVOPAL_SERVICE_KEY is required for the live check');
  const base = new URL(ZIVOPAL_CORE_URL);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('ZIVOPAL_CORE_URL must be a credential-free HTTP URL');
  }
  const models = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, signal: AbortSignal.timeout(20000),
  });
  await models.body?.cancel();
  if (!models.ok) throw new Error(`Assess OpenAI authentication check failed: HTTP ${models.status}`);
  console.log('[service-smoke] Assess OpenAI authentication: PASS');

  const callback = new URL('/api/grades/callback', base);
  const authorized = await fetch(callback, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Service-Key': ZIVOPAL_SERVICE_KEY },
    body: '{}', signal: AbortSignal.timeout(20000),
  });
  await authorized.body?.cancel();
  if (authorized.status !== 400) throw new Error(`Empty authenticated callback expected 400, got ${authorized.status}`);
  console.log('[service-smoke] Assess-to-core callback authentication: PASS (400, no data writes)');

  const unauthorized = await fetch(callback, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: '{}', signal: AbortSignal.timeout(20000),
  });
  await unauthorized.body?.cancel();
  if (unauthorized.status !== 401) throw new Error(`Unauthenticated callback expected 401, got ${unauthorized.status}`);
  console.log('[service-smoke] callback missing-key rejection: PASS (401)');
  console.log('[service-smoke] Assess checks: ALL PASS');
}
