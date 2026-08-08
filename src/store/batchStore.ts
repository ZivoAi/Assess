import axios from 'axios';
import { pool } from '../db/client.js';

type Status = 'pending' | 'completed' | 'failed';

interface BatchEntry {
  batchId: string;
  total: number;
  completedCount: number;
  failedCount: number;
  statuses: Record<string, Status>;
  results: Record<string, any>;
  callbackUrl?: string;
}

async function notifyCallback(url: string, payload: any): Promise<void> {
  try {
    await axios.post(url, payload, { timeout: 5000 });
  } catch (e) {
    console.warn('Failed to notify callback', url, (e as Error).message);
  }
}

function rowToBatch(row: any): BatchEntry {
  return {
    batchId: row.id,
    total: row.total,
    completedCount: row.completed_count,
    failedCount: row.failed_count,
    callbackUrl: row.callback_url ?? undefined,
    statuses: row.submission_statuses ?? {},
    results: row.submission_results ?? {},
  };
}

export const batchStore = {
  async createBatch(batchId: string, total: number, callbackUrl?: string): Promise<BatchEntry> {
    const { rows } = await pool.query<any>(
      `INSERT INTO batches (id, total, callback_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET total = EXCLUDED.total
       RETURNING *`,
      [batchId, total, callbackUrl ?? null],
    );
    const entry = rowToBatch(rows[0]);
    if (callbackUrl) {
      await notifyCallback(callbackUrl, { batchId, status: 'created', total });
    }
    return entry;
  },

  async addSubmission(batchId: string, submissionId: string): Promise<void> {
    const { rows } = await pool.query<any>(
      `UPDATE batches
       SET submission_statuses = jsonb_set(submission_statuses, $2::text[], '"pending"'::jsonb, true),
           submission_ids = submission_ids || to_jsonb($3::text)
       WHERE id = $1
       RETURNING callback_url`,
      [batchId, `{${submissionId}}`, submissionId],
    );
    if (rows.length === 0) throw new Error('Batch not found');
    const callbackUrl = rows[0].callback_url;
    if (callbackUrl) {
      await notifyCallback(callbackUrl, { batchId, status: 'pending', submissionId });
    }
  },

  async markCompleted(batchId: string, submissionId: string, result: any): Promise<BatchEntry> {
    const { rows } = await pool.query<any>(
      `UPDATE batches
       SET completed_count = completed_count + 1,
           submission_statuses = jsonb_set(submission_statuses, $2::text[], '"completed"'::jsonb, true),
           submission_results = jsonb_set(submission_results, $2::text[], $3::jsonb, true)
       WHERE id = $1
       RETURNING *`,
      [batchId, `{${submissionId}}`, JSON.stringify(result)],
    );
    if (rows.length === 0) throw new Error('Batch not found');
    const entry = rowToBatch(rows[0]);
    if (entry.callbackUrl) {
      await notifyCallback(entry.callbackUrl, {
        batchId,
        status: 'progress',
        submissionId,
        completedCount: entry.completedCount,
        total: entry.total,
      });
      if (entry.completedCount + entry.failedCount >= entry.total) {
        await notifyCallback(entry.callbackUrl, {
          batchId,
          status: 'completed',
          completed: entry.completedCount,
          failed: entry.failedCount,
        });
      }
    }
    return entry;
  },

  async markFailed(batchId: string, submissionId: string, error: string): Promise<BatchEntry> {
    const { rows } = await pool.query<any>(
      `UPDATE batches
       SET failed_count = failed_count + 1,
           submission_statuses = jsonb_set(submission_statuses, $2::text[], '"failed"'::jsonb, true),
           submission_results = jsonb_set(submission_results, $2::text[], $3::jsonb, true)
       WHERE id = $1
       RETURNING *`,
      [batchId, `{${submissionId}}`, JSON.stringify({ error })],
    );
    if (rows.length === 0) throw new Error('Batch not found');
    const entry = rowToBatch(rows[0]);
    if (entry.callbackUrl) {
      await notifyCallback(entry.callbackUrl, {
        batchId,
        status: 'progress',
        submissionId,
        completedCount: entry.completedCount,
        failedCount: entry.failedCount,
        total: entry.total,
      });
      if (entry.completedCount + entry.failedCount >= entry.total) {
        await notifyCallback(entry.callbackUrl, {
          batchId,
          status: 'completed',
          completed: entry.completedCount,
          failed: entry.failedCount,
        });
      }
    }
    return entry;
  },

  async get(batchId: string): Promise<BatchEntry | undefined> {
    const { rows } = await pool.query<any>(
      'SELECT * FROM batches WHERE id = $1',
      [batchId],
    );
    if (!rows[0]) return undefined;
    return rowToBatch(rows[0]);
  },
};
