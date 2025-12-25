import { ShortAnswerEmbeddingGrader } from '../src/graders/shortAnswerEmbedding';
import * as embeddings from '../src/embeddings/openai';

jest.mock('../src/embeddings/openai');

describe('ShortAnswerEmbeddingGrader', () => {
  beforeEach(() => jest.resetAllMocks());

  it('marks very similar answers as correct', async () => {
    (embeddings.getEmbedding as jest.Mock).mockImplementation(async (t: string) => {
      if (t.toLowerCase().includes('paris')) return [1, 0, 0];
      return [1, 0, 0];
    });

    const g = new ShortAnswerEmbeddingGrader(0.8);
    const q = { id: 'q1', rubric: { modelAnswer: 'Paris' } };
    const r = await g.grade(q, 'Paris');
    expect(r.correct).toBe(true);
  });

  it('marks different answers as incorrect', async () => {
    (embeddings.getEmbedding as jest.Mock).mockImplementation(async (t: string) => {
      if (t.toLowerCase().includes('paris')) return [1, 0, 0];
      return [0, 1, 0];
    });

    const g = new ShortAnswerEmbeddingGrader(0.9);
    const q = { id: 'q1', rubric: { modelAnswer: 'Paris' } };
    const r = await g.grade(q, 'London');
    expect(r.correct).toBe(false);
  });

  it('falls back to token similarity on embedding failure', async () => {
    (embeddings.getEmbedding as jest.Mock).mockImplementation(async (t: string) => {
      throw new Error('API error');
    });

    const g = new ShortAnswerEmbeddingGrader(0.5);
    const q = { id: 'q1', rubric: { modelAnswer: 'Paris' } };
    const r = await g.grade(q, 'Paris');
    expect(r.correct).toBe(true);
  });
});