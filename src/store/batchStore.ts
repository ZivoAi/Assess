import axios from 'axios';

type Status = 'pending' | 'completed' | 'failed';

interface BatchEntry {
  batchId: string;
  total: number;
  completedCount: number;
  failedCount: number;
  statuses: Record<string, Status>;
  results: Record<string, any>;
  error?: string;
  callbackUrl?: string;
}

const store = new Map<string, BatchEntry>();

async function notifyCallback(url: string, payload: any) {
  try {
    await axios.post(url, payload, { timeout: 5000 });
  } catch (e) {
    // Log and ignore — do not throw from store
    console.warn('Failed to notify callback', url, (e as Error).message);
  }
}

export const batchStore = {
  createBatch(batchId: string, total: number, callbackUrl?: string) {
    const entry: BatchEntry = {
      batchId,
      total,
      completedCount: 0,
      failedCount: 0,
      statuses: {},
      results: {},
      callbackUrl,
    };
    store.set(batchId, entry);
    if (callbackUrl) {
      notifyCallback(callbackUrl, { batchId, status: 'created', total });
    }
    return entry;
  },
  addSubmission(batchId: string, submissionId: string) {
    const e = store.get(batchId);
    if (!e) throw new Error('Batch not found');
    e.statuses[submissionId] = 'pending';
    if (e.callbackUrl) notifyCallback(e.callbackUrl, { batchId, status: 'pending', submissionId });
  },
  async markCompleted(batchId: string, submissionId: string, result: any) {
    const e = store.get(batchId);
    if (!e) throw new Error('Batch not found');
    if (e.statuses[submissionId] !== 'pending') {
      e.statuses[submissionId] = 'completed';
    } else {
      e.statuses[submissionId] = 'completed';
    }
    e.results[submissionId] = result;
    e.completedCount += 1;
    if (e.callbackUrl) await notifyCallback(e.callbackUrl, { batchId, status: 'progress', submissionId, completedCount: e.completedCount, total: e.total });
    if (e.completedCount + e.failedCount >= e.total) {
      if (e.callbackUrl) await notifyCallback(e.callbackUrl, { batchId, status: 'completed', completed: e.completedCount, failed: e.failedCount });
    }
    return e;
  },
  async markFailed(batchId: string, submissionId: string, error: string) {
    const e = store.get(batchId);
    if (!e) throw new Error('Batch not found');
    e.statuses[submissionId] = 'failed';
    e.failedCount += 1;
    e.results[submissionId] = { error };
    if (e.callbackUrl) await notifyCallback(e.callbackUrl, { batchId, status: 'progress', submissionId, completedCount: e.completedCount, failedCount: e.failedCount, total: e.total });
    if (e.completedCount + e.failedCount >= e.total) {
      if (e.callbackUrl) await notifyCallback(e.callbackUrl, { batchId, status: 'completed', completed: e.completedCount, failed: e.failedCount });
    }
    return e;
  },
  get(batchId: string) {
    return store.get(batchId);
  },
};
