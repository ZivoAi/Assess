/**
 * Jest manual mock for src/db/client.ts
 * Provides an in-memory pool so tests run without a real Postgres connection.
 * Activated when a test calls: jest.mock('../src/db/client')
 */

type Row = Record<string, any>;

const _assignments = new Map<string, any>();
const _submissions = new Map<string, any>();
const _batches     = new Map<string, any>();

export function resetMockDb() {
  _assignments.clear();
  _submissions.clear();
  _batches.clear();
}

function parseJson(v: any): any {
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
  return v;
}

export const pool = {
  query: jest.fn(async (sql: string, params?: any[]): Promise<{ rows: Row[] }> => {
    const p = params ?? [];
    const s = sql.trim().replace(/\s+/g, ' ');

    // ---- assignments ----
    if (/INSERT INTO assignments/i.test(s)) {
      const id = p[0];
      const data = parseJson(p[1]);
      _assignments.set(id, { id, data, created_at: new Date() });
      return { rows: [{ id, data, created_at: new Date() }] };
    }
    if (/SELECT data FROM assignments WHERE id/i.test(s)) {
      const row = _assignments.get(p[0]);
      return { rows: row ? [{ data: row.data }] : [] };
    }
    if (/SELECT data FROM assignments/i.test(s)) {
      return { rows: Array.from(_assignments.values()).map((r) => ({ data: r.data })) };
    }

    // ---- submissions ----
    if (/INSERT INTO submissions/i.test(s)) {
      const id = p[0];
      if (/completed/i.test(s)) {
        _submissions.set(id, { id, status: 'completed', result: parseJson(p[1]), error: null });
      } else if (/failed/i.test(s)) {
        _submissions.set(id, { id, status: 'failed', result: null, error: p[1] });
      } else {
        if (!_submissions.has(id)) {
          _submissions.set(id, { id, status: 'pending', result: null, error: null });
        }
      }
      return { rows: [] };
    }
    if (/SELECT .* FROM submissions WHERE id/i.test(s)) {
      const row = _submissions.get(p[0]);
      return { rows: row ? [row] : [] };
    }

    // ---- batches ----
    if (/INSERT INTO batches/i.test(s)) {
      const id = p[0];
      if (!_batches.has(id)) {
        _batches.set(id, {
          id, total: p[1], completed_count: 0, failed_count: 0,
          callback_url: p[2] ?? null, submission_ids: [],
          submission_statuses: {}, submission_results: {}, created_at: new Date(),
        });
      }
      return { rows: [_batches.get(id)] };
    }
    if (/UPDATE batches\s+SET submission_statuses.*submission_ids/i.test(s)) {
      const id = p[0];
      const key = p[1].replace(/[{}]/g, '').trim();
      const entry = _batches.get(id);
      if (!entry) return { rows: [] };
      entry.submission_statuses[key] = 'pending';
      if (!entry.submission_ids.includes(key)) entry.submission_ids.push(key);
      return { rows: [entry] };
    }
    if (/UPDATE batches\s+SET completed_count/i.test(s)) {
      const id = p[0];
      const key = p[1].replace(/[{}]/g, '').trim();
      const entry = _batches.get(id);
      if (!entry) return { rows: [] };
      entry.completed_count += 1;
      entry.submission_statuses[key] = 'completed';
      entry.submission_results[key] = parseJson(p[2]);
      return { rows: [entry] };
    }
    if (/UPDATE batches\s+SET failed_count/i.test(s)) {
      const id = p[0];
      const key = p[1].replace(/[{}]/g, '').trim();
      const entry = _batches.get(id);
      if (!entry) return { rows: [] };
      entry.failed_count += 1;
      entry.submission_statuses[key] = 'failed';
      entry.submission_results[key] = parseJson(p[2]);
      return { rows: [entry] };
    }
    if (/SELECT \* FROM batches WHERE id/i.test(s)) {
      const row = _batches.get(p[0]);
      return { rows: row ? [row] : [] };
    }

    // Migrations — no-op
    if (/CREATE TABLE IF NOT EXISTS/i.test(s)) {
      return { rows: [] };
    }

    return { rows: [] };
  }),
  on: jest.fn(),
};
