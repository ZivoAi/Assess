jest.mock('../src/db/client');
const { resetMockDb } = jest.requireMock('../src/db/client') as { resetMockDb: () => void };
import { pool } from '../src/db/client';
import { setAssignment } from '../src/api/assignments';
import { prepareGradingTask, canonicalJson } from '../src/grader/task';
import { gradeStoredTask } from '../src/grader/stored';
import { submissionsStore } from '../src/store/submissionsStore';
import { registry } from '../src/grader/registry';

const input = { id: 'synthetic-submission', assignmentId: 'synthetic-assignment', studentId: 'synthetic-student', answers: { q1: 'Synthetic answer' } };
beforeEach(async () => {
  resetMockDb();
  await setAssignment({ id: input.assignmentId, title: 'Synthetic', questions: [{ id: 'q1', type: 'essay', prompt: 'Synthetic question' }] });
});
afterEach(() => jest.restoreAllMocks());
const score = () => jest.spyOn(registry.get('essay')!, 'grade').mockResolvedValue({
  questionId: 'q1', score: 0.7, maxScore: 1, correct: true, feedback: 'Synthetic feedback', requiresTeacherReview: true,
});
test('completed delivery retries reuse the saved score and cannot erase it', async () => {
  const grader = score(), task = await prepareGradingTask(input);
  await submissionsStore.createPending(input.id, task.requestHash);
  const first = await gradeStoredTask(task);
  await submissionsStore.setDeliveryError(input.id, task.requestHash, true);
  const retry = await gradeStoredTask(task);
  expect(retry).toEqual(first);
  expect(grader).toHaveBeenCalledTimes(1);
  expect(await submissionsStore.get(input.id)).toMatchObject({ status: 'completed', result: { requiresTeacherReview: true } });
});
test('different answers or question snapshots cannot reuse a submission ID', async () => {
  const grader = score(), task = await prepareGradingTask(input);
  await submissionsStore.createPending(input.id, task.requestHash);
  await gradeStoredTask(task);
  const changed = await prepareGradingTask({ ...input, answers: { q1: 'Different' } });
  await expect(submissionsStore.createPending(input.id, changed.requestHash)).rejects.toMatchObject({ status: 409 });
  await expect(gradeStoredTask(changed)).rejects.toMatchObject({ status: 409 });
  expect(grader).toHaveBeenCalledTimes(1);
});
test('one database claim excludes concurrent model execution', async () => {
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const grader = score().mockImplementation(async () => { entered(); await gate; return { questionId: 'q1', score: 1, maxScore: 1, correct: true }; });
  const task = await prepareGradingTask(input);
  await submissionsStore.createPending(input.id, task.requestHash);
  const first = gradeStoredTask(task);
  await started;
  try {
    await expect(gradeStoredTask(task)).rejects.toMatchObject({ status: 409 });
    expect((await submissionsStore.get(input.id))?.status).toBe('grading');
  } finally { release(); }
  await first; expect(grader).toHaveBeenCalledTimes(1);
});
test('provider failure is terminal for automatic retries and is not a zero mark', async () => {
  const grader = score().mockRejectedValue(new Error('private-provider-content'));
  const task = await prepareGradingTask(input);
  await submissionsStore.createPending(input.id, task.requestHash);
  await expect(gradeStoredTask(task)).rejects.toMatchObject({ code: 'GRADING_UNAVAILABLE' });
  await expect(gradeStoredTask(task)).rejects.toMatchObject({ code: 'GRADING_REVIEW_REQUIRED' });
  const saved = await submissionsStore.get(input.id);
  expect(saved?.result).toBeUndefined();
  expect(saved?.status).toBe('failed');
  expect(JSON.stringify(saved)).not.toContain('private-provider');
  expect(grader).toHaveBeenCalledTimes(1);
});
test('legacy pending/result records are preserved, not guessed into new requests', async () => {
  await pool.query("INSERT INTO submissions (id, status) VALUES ($1, 'pending')", [input.id]);
  const task = await prepareGradingTask(input), grader = score();
  await expect(submissionsStore.createPending(input.id, task.requestHash)).rejects.toMatchObject({ status: 409 });
  await expect(gradeStoredTask(task)).rejects.toMatchObject({ status: 409 });
  expect(await submissionsStore.get(input.id)).toMatchObject({ status: 'pending' });
  expect(grader).not.toHaveBeenCalled();
});
test('canonical fingerprints ignore object key order, not answer differences', () => {
  expect(canonicalJson({ b: 2, a: { y: 3, x: 1 } })).toBe(canonicalJson({ a: { x: 1, y: 3 }, b: 2 }));
  expect(canonicalJson({ a: [1, 2] })).not.toBe(canonicalJson({ a: [2, 1] }));
});
