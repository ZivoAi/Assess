import express from 'express';
import { Assignment } from '../types';

const router = express.Router();

// In-memory store for MVP
const assignments = new Map<string, Assignment>();

router.post('/', (req, res) => {
  const a: Assignment = req.body;
  assignments.set(a.id, a);
  res.status(201).json(a);
});

router.get('/:id', (req, res) => {
  const a = assignments.get(req.params.id);
  if (!a) return res.status(404).send('Not found');
  res.json(a);
});

router.get('/', (req, res) => {
  res.json(Array.from(assignments.values()));
});

export { router as assignmentsRouter, assignments };
