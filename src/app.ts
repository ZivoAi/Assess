import express from 'express';
  import cors from 'cors';
  import pinoHttp from 'pino-http';
  import rateLimit from 'express-rate-limit';
  import { assignmentsRouter } from './api/assignments.js';
  import { submissionsRouter } from './api/submissions.js';
  import { batchesRouter } from './api/batches.js';
  import { zivopalRouter } from './integrations/zivopal.js';
  import { ALLOWED_ORIGINS } from './config.js';
  import { requestLogRedaction } from './logging.js';
  import { requireCoreServiceKey } from './middleware/coreServiceAuth.js';
  import { GradingRequestError } from './grader/task.js';

  export function createApp() {
    const app = express();

    app.use(pinoHttp({ redact: requestLogRedaction }));

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

    app.use(express.json());

    app.use('/api', requireCoreServiceKey);
    app.use('/api/assignments', assignmentsRouter);
    app.use('/api/submissions', submissionsRouter);
    app.use('/api/batches', batchesRouter);
    app.use('/api/integrations/zivopal', zivopalRouter);

    app.get('/health', (_req, res) => res.send('ok'));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error instanceof GradingRequestError) return res.status(error.status).json({ error: error.message, code: error.code });
      return res.status(502).json({ error: 'Assessment service could not complete this request' });
    });

    return app;
  }
  