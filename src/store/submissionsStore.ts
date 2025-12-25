import { GradeResult } from '../types';

type Status = 'pending' | 'completed' | 'failed';

interface RecordEntry {
  submissionId: string;
  status: Status;
  result?: GradeResult;
  error?: string;
}

const store = new Map<string, RecordEntry>();

export const submissionsStore = {
  createPending(submissionId: string) {
    store.set(submissionId, { submissionId, status: 'pending' });
  },
  setResult(submissionId: string, result: GradeResult) {
    store.set(submissionId, { submissionId, status: 'completed', result });
  },
  setFailed(submissionId: string, error: string) {
    store.set(submissionId, { submissionId, status: 'failed', error });
  },
  get(submissionId: string) {
    return store.get(submissionId);
  },
};
