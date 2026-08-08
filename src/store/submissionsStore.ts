import { GradeResult } from '../types.js';
import { pool } from '../db/client.js';

type Status = 'pending' | 'completed' | 'failed';

interface RecordEntry {
  submissionId: string;
  status: Status;
  result?: GradeResult;
  error?: string;
}

export const submissionsStore = {
  async createPending(submissionId: string): Promise<void> {
    await pool.query(
      `INSERT INTO submissions (id, status)
       VALUES ($1, 'pending')
       ON CONFLICT (id) DO NOTHING`,
      [submissionId],
    );
  },

  async setResult(submissionId: string, result: GradeResult): Promise<void> {
    await pool.query(
      `INSERT INTO submissions (id, status, result, updated_at)
       VALUES ($1, 'completed', $2, NOW())
       ON CONFLICT (id) DO UPDATE
         SET status = 'completed', result = EXCLUDED.result, updated_at = NOW()`,
      [submissionId, JSON.stringify(result)],
    );
  },

  async setFailed(submissionId: string, error: string): Promise<void> {
    await pool.query(
      `INSERT INTO submissions (id, status, error, updated_at)
       VALUES ($1, 'failed', $2, NOW())
       ON CONFLICT (id) DO UPDATE
         SET status = 'failed', error = EXCLUDED.error, updated_at = NOW()`,
      [submissionId, error],
    );
  },

  async get(submissionId: string): Promise<RecordEntry | undefined> {
    const { rows } = await pool.query<{
      id: string;
      status: Status;
      result: GradeResult | null;
      error: string | null;
    }>(
      'SELECT id, status, result, error FROM submissions WHERE id = $1',
      [submissionId],
    );
    if (!rows[0]) return undefined;
    const row = rows[0];
    return {
      submissionId: row.id,
      status: row.status,
      result: row.result ?? undefined,
      error: row.error ?? undefined,
    };
  },
};
