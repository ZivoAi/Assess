import { createHash } from 'node:crypto';
import type { Assignment, Submission } from '../types.js';
import { getAssignment } from '../api/assignments.js';

export class GradingRequestError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson((value as Record<string, unknown>)[key])).join(',') + '}';
  }
  const result = JSON.stringify(value);
  if (result === undefined) throw new GradingRequestError(400, 'INVALID_SUBMISSION', 'JSON submission data is required');
  return result;
}
export type GradingTask = { submission: Submission; assignment: Assignment; requestHash: string };
export function taskFingerprint(submission: Submission, assignment: Assignment): string {
  return createHash('sha256').update(canonicalJson({
    assignmentId: submission.assignmentId, studentId: submission.studentId,
    answers: submission.answers, questions: assignment.questions,
  })).digest('hex');
}
export async function prepareGradingTask(input: Submission, questionSourceId?: string): Promise<GradingTask> {
  const validId = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
  if (!input || !validId(input.id) || !validId(input.assignmentId) || !validId(input.studentId) ||
      !input.answers || typeof input.answers !== 'object' || Array.isArray(input.answers) ||
      canonicalJson(input.answers).length > 32000) {
    throw new GradingRequestError(400, 'INVALID_SUBMISSION', 'Stable submission, assignment and student IDs and bounded answers are required');
  }
  const assignment = await getAssignment(questionSourceId ?? input.assignmentId);
  if (!assignment) throw new GradingRequestError(404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found');
  if (!Array.isArray(assignment.questions) || !assignment.questions.length) {
    throw new GradingRequestError(400, 'NO_QUESTIONS', 'Assessment questions are required');
  }
  // Snapshot the server-owned question set. Ignore caller-supplied hashes/snapshots.
  const submission = { id: input.id, assignmentId: input.assignmentId, studentId: input.studentId, answers: input.answers };
  return { submission, assignment, requestHash: taskFingerprint(submission, assignment) };
}
