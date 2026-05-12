import express from 'express';
  import cors from 'cors';
  import { json } from 'body-parser';
  import pinoHttp from 'pino-http';
  import rateLimit from 'express-rate-limit';
  import { assignmentsRouter } from './api/assignments.js';
  import { submissionsRouter } from './api/submissions.js';
  import { batchesRouter } from './api/batches.js';
  import { zivopalRouter } from './integrations/zivopal.js';
  import { ALLOWED_ORIGINS } from './config.js';

  export function createApp() {
    const app = express();

    app.use(pinoHttp());

    app.use(
      cors({
        origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : false,
        credentials: true,
      }),
    );

    app.use(
      rateLimit({
        windowMs: 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );

    app.use(json());

    app.use('/api/assignments', assignmentsRouter);
    app.use('/api/submissions', submissionsRouter);
    app.use('/api/batches', batchesRouter);
    app.use('/api/integrations/zivopal', zivopalRouter);

    app.get('/health', (_req, res) => res.send('ok'));

    return app;
  }
  