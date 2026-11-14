import type { GradeResult } from '../types.js';
import { GradingRequestError, GradingTask, taskFingerprint } from './task.js';
import { submissionsStore } from '../store/submissionsStore.js';
import { runGradingPipeline } from './core.js';
import { registry } from './registry.js';

export async function gradeStoredTask(task: GradingTask): Promise<GradeResult> {
  if (!task?.submission || !task?.assignment || taskFingerprint(task.submission, task.assignment) !== task.requestHash) {
    throw new GradingRequestError(409, 'INVALID_GRADING_TASK', 'Legacy or mismatched queue data requires manual review');
  }
  const { id } = task.submission;
  const saved = await submissionsStore.get(id);
  if (!saved?.requestHash || saved.requestHash !== task.requestHash) {
    throw new GradingRequestError(409, 'SUBMISSION_CONFLICT', 'The grading request does not match the saved submission');
  }
  if (saved.result && saved.status === 'completed') return saved.result;
  if (saved.status !== 'pending' || !(await submissionsStore.claim(id, task.requestHash))) {
    // A crash may occur after the provider charged but before result persistence.
    // Never automatically reclaim a started/failed paid request.
    throw new GradingRequestError(409, 'GRADING_REVIEW_REQUIRED', 'Grading is already active or needs manual review; no automatic model retry');
  }
  try {
    const result = await runGradingPipeline(task.assignment.questions, task.submission.answers, registry, id);
    await submissionsStore.setResult(id, result, task.requestHash);
    return { ...result, requestHash: task.requestHash };
  } catch {
    await submissionsStore.setFailed(id, task.requestHash).catch(() => {
      console.error('Assess could not record grading failure; the started reservation remains protected');
    });
    throw new GradingRequestError(502, 'GRADING_UNAVAILABLE', 'Grading could not be confirmed; manual review is required');
  }
}
