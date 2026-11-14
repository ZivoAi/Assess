import { GradeResult } from '../types.js';
import { pool } from '../db/client.js';
import { GradingRequestError } from '../grader/task.js';

type Status = 'pending' | 'grading' | 'completed' | 'failed';

interface RecordEntry {
  submissionId: string;
  status: Status;
  result?: GradeResult;
  error?: string;
  requestHash?: string;
}

export const submissionsStore = {
  async createPending(submissionId: string, requestHash: string): Promise<void> {
    await pool.query(
      `INSERT INTO submissions (id, status, result)
       VALUES ($1, 'pending', $2)
       ON CONFLICT (id) DO NOTHING`,
      [submissionId, JSON.stringify({ requestHash })],
    );
    const saved = await submissionsStore.get(submissionId);
    if (!saved?.requestHash || saved.requestHash !== requestHash) {
      throw new GradingRequestError(409, 'SUBMISSION_CONFLICT', 'This submission ID belongs to different or legacy grading data; review it before retrying');
    }
  },

  async claim(submissionId: string, requestHash: string): Promise<boolean> {
    const { rows } = await pool.query(
      `UPDATE submissions SET status = 'grading', updated_at = NOW()
       WHERE id = $1 AND status = 'pending' AND result->>'requestHash' = $2 RETURNING id`,
      [submissionId, requestHash],
    );
    return rows.length === 1;
  },

  async setResult(submissionId: string, result: GradeResult, requestHash: string): Promise<void> {
    const { rows } = await pool.query(
      `UPDATE submissions SET status = 'completed', result = $2, error = NULL, updated_at = NOW()
       WHERE id = $1 AND status = 'grading' AND result->>'requestHash' = $3 RETURNING id`,
      [submissionId, JSON.stringify({ ...result, requestHash }), requestHash],
    );
    if (!rows.length) throw new Error('Grading reservation is no longer owned');
  },

  async setFailed(submissionId: string, requestHash: string): Promise<void> {
    await pool.query(
      `UPDATE submissions SET status = 'failed', error = 'Grading requires manual review', updated_at = NOW()
       WHERE id = $1 AND status = 'grading' AND result->>'requestHash' = $2`,
      [submissionId, requestHash],
    );
  },

  async setDeliveryError(submissionId: string, requestHash: string, failed: boolean): Promise<void> {
    await pool.query(
      `UPDATE submissions SET error = $3, updated_at = NOW()
       WHERE id = $1 AND status = 'completed' AND result->>'requestHash' = $2`,
      [submissionId, requestHash, failed ? 'Result saved; Core delivery or batch progress requires attention' : null],
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
      result: row.result && Array.isArray(row.result.details) ? row.result : undefined,
      requestHash: row.result?.requestHash,
      error: row.error ?? undefined,
    };
  },
};
