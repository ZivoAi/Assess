import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import { assignmentsRouter } from './api/assignments';
import { submissionsRouter } from './api/submissions';
import { zivopalRouter } from './integrations/zivopal';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(json());

  app.use('/api/assignments', assignmentsRouter);
  app.use('/api/submissions', submissionsRouter);
  app.use('/api/integrations/zivopal', zivopalRouter);
  app.use('/api/batches', require('./api/batches').batchesRouter);

  app.get('/health', (req, res) => res.send('ok'));

  return app;
}
