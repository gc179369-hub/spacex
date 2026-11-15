import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from '../server/createApiApp';

const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const rawUrl = req.url || '/api/health';
  if (rawUrl === '/' || rawUrl === '/index' || rawUrl === '/index.ts') {
    req.url = '/api/health';
  } else if (!rawUrl.startsWith('/api')) {
    req.url = `/api${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
  }
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
