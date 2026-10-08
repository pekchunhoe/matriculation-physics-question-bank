import type { Request, Response } from 'express';
import { createApp } from './app.js';
import { runtimeBank } from './runtime.js';
import type { Bank } from './database.js';
import type { AssetStorage } from './asset-storage.js';
import { hostedAssetStorage } from './vercel-blob-storage.js';

/** Exported Express handler for the same Vite deployment, without listen() or disk writes. */
export function createApiHandler(
  loadBank: () => Promise<Bank> = runtimeBank,
  loadStorage: () => AssetStorage | undefined = hostedAssetStorage,
) {
  let app: ReturnType<typeof createApp> | undefined;
  return async (req: Request, res: Response) => {
    try {
      if (!app) {
        let storage: AssetStorage | undefined;
        try {
          storage = loadStorage();
          if (storage?.kind === 'local') storage = undefined;
        } catch {
          /* Invalid storage configuration fails closed without breaking DB health. */
        }
        app = createApp(await loadBank(), storage, { allowWrites: false });
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
