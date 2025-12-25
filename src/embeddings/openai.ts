import axios from 'axios';
import { OPENAI_API_KEY } from '../config';

const cache = new Map<string, number[]>();

export async function getEmbedding(text: string): Promise<number[]> {
  if (cache.has(text)) return cache.get(text)!;
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const url = 'https://api.openai.com/v1/embeddings';
  const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

  const res = await axios.post(
    url,
    { input: text, model },
    { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
  );

  const emb = res.data?.data?.[0]?.embedding;
  if (!emb) throw new Error('No embedding returned');
  cache.set(text, emb);
  return emb;
}

export function cosineSimilarity(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}
