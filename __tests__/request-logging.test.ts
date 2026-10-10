import express from 'express';
import pinoHttp from 'pino-http';
import request from 'supertest';
import { requestLogRedaction } from '../src/logging.js';

test('redacts shared-service keys and session credentials from HTTP logs', async () => {
  const records: string[] = [];
  const app = express();
  app.use(pinoHttp({ redact: requestLogRedaction }, { write(chunk: string) { records.push(chunk); } }));
  app.get('/probe', (_req, res) => { res.setHeader('Set-Cookie', 'test-response-cookie'); res.json({ ok: true }); });
  await request(app).get('/probe').set('Authorization', 'Bearer test-token').set('X-Service-Key', 'test-service-key').set('Cookie', 'test-request-cookie');
  const text = records.join('');
  expect(text).toContain('[REDACTED]');
  for (const value of ['test-token', 'test-service-key', 'test-request-cookie', 'test-response-cookie']) expect(text).not.toContain(value);
});
