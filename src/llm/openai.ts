import axios from 'axios';
import { OPENAI_API_KEY } from '../config';

export async function scoreEssayWithOpenAI(prompt: string): Promise<number> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }

  // Minimal example using OpenAI responses - user must set env var OPENAI_API_KEY
  const url = 'https://api.openai.com/v1/chat/completions';
  const system = 'You are an expert grader. Given a model answer and a student answer, return a JSON object with a score between 0 and 1 under `score` and short feedback under `feedback`.';

  const res = await axios.post(
    url,
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      max_tokens: 256
    },
    { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
  );

  const txt = res.data?.choices?.[0]?.message?.content || '';
  try {
    const json = JSON.parse(txt);
    const score = Math.max(0, Math.min(1, Number(json.score) || 0));
    return score;
  } catch (e) {
    // Fallback: 0
    return 0;
  }
}
