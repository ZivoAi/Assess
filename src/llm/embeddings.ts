import axios from 'axios';
import { OPENAI_API_KEY } from '../config';

export async function getEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const url = 'https://api.openai.com/v1/embeddings';
  const res = await axios.post(
    url,
    {
      model: 'text-embedding-3-small',
      input: text,
    },
    { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
  );

  const embedding = res.data?.data?.[0]?.embedding;
  if (!embedding) throw new Error('No embedding returned');
  return embedding;
}

export function cosineSimilarity(a: number[], b: number[]) {
  const minLen = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < minLen; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
