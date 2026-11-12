import supertest from 'supertest';
import type { Express } from 'express';

// Explicit synthetic service caller; production has no test-mode auth bypass.
const key = 'synthetic-core-service-test-key';
process.env.ZIVOPAL_SERVICE_KEY = key;
export function coreRequest(app: Express) {
  const agent = supertest(app);
  return {
    get: (path: string) => agent.get(path).set('X-Service-Key', key),
    post: (path: string) => agent.post(path).set('X-Service-Key', key),
    put: (path: string) => agent.put(path).set('X-Service-Key', key),
    patch: (path: string) => agent.patch(path).set('X-Service-Key', key),
    delete: (path: string) => agent.delete(path).set('X-Service-Key', key),
  };
}
