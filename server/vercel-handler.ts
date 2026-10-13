import type { Request, Response } from 'express';
import { createApp } from './app.js';
import { runtimeBank } from './runtime.js';
import type { Bank } from './database.js';
import type { AssetStorage } from './asset-storage.js';
import { hostedAssetStorage } from './vercel-blob-storage.js';
import { securityHeaders } from './security-headers.js';
import { assertPreviewIsolation, verifyPreviewIsolation } from './preview-isolation.js';
import { studentEmailConfiguration } from './student-email.js';

/** Exported Express handler for the same Vite deployment, without listen() or disk writes. */
export function createApiHandler(
  loadBank: () => Promise<Bank> = runtimeBank,
  loadStorage: () => AssetStorage | undefined = hostedAssetStorage,
  env: NodeJS.ProcessEnv = process.env,
) {
  let app: ReturnType<typeof createApp> | undefined;
  return async (req: Request, res: Response) => {
    for (const [key, value] of Object.entries(securityHeaders)) res.setHeader(key, value);
    res.setHeader('Cache-Control', 'private, no-store');
    const path = req.url?.split('?')[0];
    try {
      assertPreviewIsolation(env);
    } catch {
      res.status(503).json({ error: 'Preview isolation configuration rejected' });
      return;
    }
    if (path === '/api/preview-isolation') {
      if (env.VERCEL_ENV !== 'preview') res.status(404).json({ error: 'Not found' });
      else if (req.method !== 'GET') res.status(405).json({ error: 'Method not allowed' });
      else {
        try {
          res.json(await verifyPreviewIsolation(env));
        } catch {
          res.status(503).json({ error: 'Preview isolation verification failed' });
        }
      }
      return;
    }
    try {
      if (!app) {
        let storage: AssetStorage | undefined;
        try {
          storage = loadStorage();
          if (storage?.kind === 'local') storage = undefined;
        } catch {
          /* Invalid storage configuration fails closed without breaking DB health. */
        }
        app = createApp(await loadBank(), storage, {
          hosted: true,
          studentEmail: studentEmailConfiguration(env),
        });
      }
    } catch {
      if (req.url?.split('?')[0] === '/api/health')
        res.status(503).json({ status: 'error', database: 'unavailable' });
      else res.status(503).json({ error: 'Database unavailable' });
      return;
    }
    app(req, res);
  };
}
