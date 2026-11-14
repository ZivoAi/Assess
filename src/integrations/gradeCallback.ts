import { ZIVOPAL_CORE_URL, ZIVOPAL_SERVICE_KEY } from '../config.js';

export function coreGradeCallbackUrl(): URL {
  if (!ZIVOPAL_CORE_URL || !ZIVOPAL_SERVICE_KEY) throw new Error('Core grade delivery configuration is required');
  const url = new URL('/api/grades/callback', ZIVOPAL_CORE_URL);
  if (url.username || url.password || (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Secure Core grade delivery URL is required');
  return url;
}

/** Retries delivery only, never repeats paid grading. Never use a caller callback URL. */
export async function postGradeCallback(body: object, options: { wait?: (ms: number) => Promise<void> } = {}): Promise<void> {
  const url = coreGradeCallbackUrl();
  const wait: (ms: number) => Promise<void> = options.wait ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < 3; attempt++) {
    let retryable = true, delay = 1000 * (attempt + 1);
    try {
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Service-Key': ZIVOPAL_SERVICE_KEY },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10_000), redirect: 'error',
      });
      if (response.ok) return;
      retryable = response.status === 429 || response.status >= 500;
      const seconds = Number(response.headers.get('retry-after'));
      if (Number.isFinite(seconds) && seconds > 0) {
        if (seconds > 60) retryable = false; else delay = seconds * 1000;
      }
    } catch { /* bounded network retry; no request headers, text or credentials in errors */ }
    if (!retryable || attempt === 2) break;
    await wait(delay);
  }
  throw new Error('Core grade delivery failed; the saved result requires attention');
}
