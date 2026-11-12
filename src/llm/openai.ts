import { ZIVOPAL_CORE_URL, ZIVOPAL_SERVICE_KEY } from '../config.js';

export async function gradeEssayWithCore(prompt: string): Promise<{ score: number; feedback: string }> {
  if (!ZIVOPAL_CORE_URL || !ZIVOPAL_SERVICE_KEY) {
    throw new Error('Core AI grading requires ZIVOPAL_CORE_URL and ZIVOPAL_SERVICE_KEY');
  }
  const base = new URL(ZIVOPAL_CORE_URL);
  if (base.username || base.password || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)))) {
    throw new Error('Core AI grading requires a secure Core URL');
  }
  try {
    const response = await fetch(new URL('/api/ai/internal/assess', base), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Service-Key': ZIVOPAL_SERVICE_KEY },
      body: JSON.stringify({ prompt }), signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error('Core AI grading failed');
    const json = await response.json() as { score?: unknown; feedback?: unknown; requiresTeacherReview?: boolean };
    if (typeof json.score !== 'number' || !Number.isFinite(json.score) || json.score < 0 || json.score > 1 ||
        json.requiresTeacherReview !== true || typeof json.feedback !== 'string' || !json.feedback.trim()) throw new Error('Invalid Core grading response');
    return { score: json.score, feedback: json.feedback };
  } catch {
    // Never turn a network, configuration or model failure into a student's zero.
    // Do not throw transport objects containing credential-bearing request headers.
    throw new Error('AI grading unavailable or invalid; no mark confirmed. Teacher review is required');
  }
}
/** Compatibility name; Core owns the provider call. */
export async function scoreEssayWithOpenAI(prompt: string): Promise<number> {
  return (await gradeEssayWithCore(prompt)).score;
}
