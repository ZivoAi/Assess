import express from 'express';
import { Assignment } from '../types.js';
import { pool } from '../db/client.js';

const router = express.Router();

// --- DB helpers ---

export async function setAssignment(a: Assignment): Promise<void> {
  await pool.query(
    `INSERT INTO assignments (id, data)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [a.id, JSON.stringify(a)],
  );
}

export async function getAssignment(id: string): Promise<Assignment | undefined> {
  const { rows } = await pool.query<{ data: Assignment }>(
    'SELECT data FROM assignments WHERE id = $1',
    [id],
  );
  return rows[0]?.data;
}

export async function getAllAssignments(): Promise<Assignment[]> {
  const { rows } = await pool.query<{ data: Assignment }>(
    'SELECT data FROM assignments ORDER BY created_at',
  );
  return rows.map((r) => r.data);
}

// --- Routes ---

router.post('/', async (req, res) => {
  const a: Assignment = req.body;
  await setAssignment(a);
  res.status(201).json(a);
});

router.get('/:id', async (req, res) => {
  const a = await getAssignment(req.params.id);
  if (!a) return res.status(404).send('Not found');
  res.json(a);
});

router.get('/', async (req, res) => {
  const all = await getAllAssignments();
  res.json(all);
});

export { router as assignmentsRouter };
