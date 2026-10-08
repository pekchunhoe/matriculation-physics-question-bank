import type { Request, Response } from 'express';
import { createApp } from './app.js';
import { runtimeBank } from './runtime.js';
import type { Bank } from './database.js';

/** Exported Express handler for the same Vite deployment, without listen() or disk writes. */
export function createApiHandler(loadBank: () => Promise<Bank> = runtimeBank) {
  let app: ReturnType<typeof createApp> | undefined;
  return async (req: Request, res: Response) => {
    try {
      app ??= createApp(await loadBank(), undefined, { allowWrites: false });
    } catch {
      if (req.url?.split('?')[0] === '/api/health')
        res.status(503).json({ status: 'error', database: 'unavailable' });
      else res.status(503).json({ error: 'Database unavailable' });
      return;
    }
    app(req, res);
  };
}
