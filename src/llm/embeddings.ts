import { ZIVOPAL_CORE_URL, ZIVOPAL_SERVICE_KEY } from '../config.js';

export async function getEmbedding(text: string): Promise<number[]> {
  if (!ZIVOPAL_CORE_URL || !ZIVOPAL_SERVICE_KEY) throw new Error('Core assessment configuration is required');
  try {
    const url = new URL('/api/ai/internal/assess/embeddings', ZIVOPAL_CORE_URL);
    if (url.username || url.password || (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Invalid Core URL');
    const response = await fetch(url, {
      redirect: 'error',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Service-Key': ZIVOPAL_SERVICE_KEY },
      body: JSON.stringify({ texts: [text] }), signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error('Core embedding unavailable');
    const data = await response.json() as { embeddings?: unknown; requiresTeacherReview?: unknown };
    const value = Array.isArray(data.embeddings) ? data.embeddings[0] : undefined;
    if (data.requiresTeacherReview !== true || !Array.isArray(value) || value.length !== 1536 ||
        value.some(n => typeof n !== 'number' || !Number.isFinite(n))) throw new Error('Invalid embedding');
    return value;
  } catch {
    throw new Error('Assessment embeddings unavailable; no semantic mark confirmed. Teacher review is required');
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length || [...a, ...b].some(n => !Number.isFinite(n))) {
    throw new Error('Invalid embedding vectors; no similarity confirmed');
  }
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  if (!na || !nb) throw new Error('Empty embedding signal; no similarity confirmed');
  const result = dot / Math.sqrt(na * nb);
  if (!Number.isFinite(result)) throw new Error('Invalid similarity; no semantic mark confirmed');
  return Math.max(-1, Math.min(1, result));
}
