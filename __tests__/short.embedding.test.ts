import { ShortAnswerEmbeddingGrader } from '../src/graders/shortAnswerEmbedding';
import * as embeddings from '../src/embeddings/openai';

jest.mock('../src/embeddings/openai', () => ({
  ...jest.requireActual('../src/embeddings/openai'),
  getEmbedding: jest.fn(),
}));

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

  it('requires review rather than inventing a lexical mark on embedding failure', async () => {
    (embeddings.getEmbedding as jest.Mock).mockImplementation(async (t: string) => {
      throw new Error('API error');
    });

    const g = new ShortAnswerEmbeddingGrader(0.5);
    const q = { id: 'q1', rubric: { modelAnswer: 'Paris' } };
    await expect(g.grade(q, 'Paris')).rejects.toThrow(/no mark confirmed/);
  });
});