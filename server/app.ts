import express from 'express';
import multer from 'multer';
import { Bank, BankError, taxonomyTables, type Filters } from './database.js';
import { AssetStorageError, AssetWriteFailure, type AssetStorage } from './asset-storage.js';
import { AuthService, type AdminIdentity } from './auth.js';
import { VisibilityService } from './visibility.js';
import { ImageQuestionService, publicImageQuestion } from './image-questions.js';
import { imageLimits } from '../shared/image-question.js';
import { assetKeyFromReference } from '../shared/asset-reference.js';
import { editableKinds } from './curriculum.js';
import type { EditableKind } from '../shared/curriculum.js';
import { securityHeaders } from './security-headers.js';
export function createApp(
  bank: Bank,
  storage: AssetStorage | undefined,
  options: { hosted?: boolean; development?: boolean } = {},
) {
  const app = express(),
    auth = new AuthService(bank, options.hosted ?? false),
    visibility = new VisibilityService(bank),
    questions = new ImageQuestionService(bank, storage);
  const identities = new WeakMap<express.Request, AdminIdentity>();
  const admin: express.RequestHandler = async (req, _res, next) => {
    if (!identities.has(req)) identities.set(req, await auth.requireAdmin(req));
    next();
  };
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    for (const [key, value] of Object.entries(securityHeaders)) {
      if (
        key === 'Content-Security-Policy' &&
        options.development &&
        !auth.hosted &&
        !req.path.startsWith('/api/') &&
        !req.path.startsWith('/uploads/')
      )
        continue;
      res.setHeader(key, value);
    }
    res.setHeader('Cache-Control', 'private, no-store');
    if (auth.hosted) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  app.get('/api/health', async (_req, res) => {
    try {
      await bank.one('SELECT 1 AS connected');
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });
  app.use('/api', (req, res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      !['/auth/login', '/auth/logout'].includes(req.path)
    )
      return admin(req, res, () => {
        auth.csrf(req);
        next();
      });
    next();
  });
  app.post(
    '/api/auth/login',
    (req, _res, next) => {
      auth.csrf(req);
      next();
    },
    express.json({ limit: '4kb' }),
    async (req, res) => res.json(await auth.login(req, res)),
  );
  app.post('/api/auth/logout', async (req, res) => {
    await auth.logout(req, res);
    res.json({ authenticated: false });
  });
  app.get('/api/auth/session', async (req, res) => {
    const user = await auth.identity(req);
    res.json(user ? { authenticated: true, user } : { authenticated: false });
  });
  app.use(express.json({ limit: '3mb' }));
  app.use('/api', async (req, _res, next) => {
    if (!identities.has(req)) {
      const identity = await auth.identity(req);
      if (identity) identities.set(req, identity);
    }
    next();
  });
  app.get('/api/public/question-set', async (req, res) => {
    await auth.limit('public-print-ip', auth.clientAddress(req), 20, 60000);
    await auth.limit('public-print-global', 'all', 500, 60000);
    res.json(await questions.questionSet(req.query.ids));
  });
  app.use('/uploads', async (req, res) => {
    if (!storage) throw new AssetStorageError('Asset storage is not configured');
    if (!['GET', 'HEAD'].includes(req.method))
      throw new BankError('Asset delivery accepts read requests only', 405);
    const reference = '/uploads' + req.path,
      key = assetKeyFromReference(reference);
    if (!key) throw new BankError('Invalid asset reference');
    const identity = await auth.identity(req);
    if (!identity && !(await questions.publicAsset(reference)))
      throw new BankError('Asset not found', 404);
    const result = await storage.get(key);
    if (!result) throw new BankError('Asset not found', 404);
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    res.setHeader(
      'Content-Disposition',
      `${['image/png', 'image/jpeg', 'image/webp'].includes(result.metadata.mime) ? 'inline' : 'attachment'}; filename="${key}"`,
    );
    res.type(result.metadata.mime).send(result.bytes);
  });
  app.get('/api/taxonomy', async (req, res) =>
    res.json(identities.has(req) ? await bank.taxonomy() : await visibility.taxonomy()),
  );
  const editable = (kind: string): EditableKind => {
    if (!editableKinds.includes(kind as EditableKind))
      throw new BankError('This taxonomy type is not editable');
    return kind as EditableKind;
  };
  app.get('/api/taxonomy/:kind/:id/impact', admin, async (req, res) =>
    res.json(
      await bank.curriculum.impact(editable(String(req.params.kind)), String(req.params.id)),
    ),
  );
  app.patch('/api/taxonomy/:kind/:id', async (req, res) =>
    res.json(
      await bank.curriculum.edit(editable(req.params.kind), String(req.params.id), req.body),
    ),
  );
  app.delete('/api/taxonomy/:kind/:id', (req) => {
    editable(req.params.kind);
    throw new BankError(
      'Permanent curriculum deletion is disabled. Retire the item to preserve question history.',
      409,
    );
  });
  app.get('/api/curriculum-versions', async (req, res) =>
    res.json(
      identities.has(req)
        ? await bank.curriculum.versions()
        : (await visibility.taxonomy()).curriculumVersions,
    ),
  );
  app.post('/api/curriculum-versions', async (req, res) =>
    res
      .status(201)
      .json(
        await bank.curriculum.createVersion(
          req.body.version,
          req.body.note,
          req.body.author ?? null,
        ),
      ),
  );
  app.get('/api/curriculum-versions/:id/impact', admin, async (req, res) =>
    res.json(await bank.curriculum.impact('curriculumVersions', String(req.params.id))),
  );
  app.patch('/api/curriculum-versions/:id', async (req, res) =>
    res.json(await bank.curriculum.editVersion(String(req.params.id), req.body)),
  );
  app.delete('/api/curriculum-versions/:id', () => {
    throw new BankError('Retire curriculum versions instead of deleting their history.', 409);
  });
  app.get('/api/curriculum-versions/:id/export', admin, async (req, res) => {
    const doc = await bank.curriculum.export(String(req.params.id));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="curriculum-${doc.curriculumVersion.code}.json"`,
    );
    res.json(doc);
  });
  app.post('/api/curriculum/import/validate', async (req, res) =>
    res.json(await bank.curriculum.plan(req.body.document)),
  );
  app.post('/api/curriculum/import', async (req, res) =>
    res
      .status(201)
      .json(
        await bank.curriculum.import(
          req.body.document,
          req.body.token,
          req.body.note,
          req.body.author ?? null,
        ),
      ),
  );
  app.post('/api/taxonomy/:kind', async (req, res) => {
    const kind = req.params.kind as keyof typeof taxonomyTables;
    if (!Object.hasOwn(taxonomyTables, kind)) throw new BankError('Unknown taxonomy type');
    if (
      typeof req.body.name !== 'string' ||
      (req.body.parentId !== null && typeof req.body.parentId !== 'string')
    )
      throw new BankError('Name and parentId are required');
    res.status(201).json({
      id: await bank.addTaxon(
        kind,
        req.body.name,
        req.body.parentId,
        req.body.isTest === true,
        typeof req.body.curriculumVersionId === 'string' ? req.body.curriculumVersionId : undefined,
      ),
    });
  });
  app.get('/api/counts', async (req, res) =>
    res.json(
      await bank.all(
        `SELECT s.id semester_id,c.id chapter_id,t.id topic_id,q.difficulty_id,COUNT(*) count FROM image_questions q JOIN topics t ON t.id=q.topic_id JOIN chapters c ON c.id=t.chapter_id JOIN semesters s ON s.id=c.semester_id JOIN curriculum_versions cv ON cv.id=s.curriculum_version_id WHERE ${identities.has(req) ? '1=1' : publicImageQuestion} GROUP BY s.id,c.id,t.id,q.difficulty_id`,
      ),
    ),
  );
  app.get('/api/questions', async (req, res) => {
    const filters: Filters = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value !== 'string') throw new BankError('Query parameters must be single strings');
      filters[key] = value;
    }
    res.json(await questions.list(filters, identities.has(req)));
  });
  app.get('/api/questions/:id', async (req, res) =>
    res.json(
      await questions.get(String(req.params.id), identities.has(req), req.query.answers === 'true'),
    ),
  );
  app.get('/api/questions/:id/versions', admin, async (req, res) =>
    res.json(
      await bank.all(
        'SELECT revision,snapshot,classification,created_at FROM image_question_versions WHERE question_id=? ORDER BY revision DESC',
        String(req.params.id),
      ),
    ),
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: imageLimits.bytes, files: 2, fields: 1, fieldSize: 16384, parts: 3 },
  }).fields([
    { name: 'question', maxCount: 1 },
    { name: 'answer', maxCount: 1 },
  ]);
  let savesInFlight = 0;
  const save: express.RequestHandler = async (req, res) => {
    if (savesInFlight >= 2) throw new BankError('Image processing is busy; retry shortly', 429);
    savesInFlight++;
    try {
      await auth.limit('image-save-admin', identities.get(req)!.id, 30, 60000);
      let input: unknown;
      try {
        input = JSON.parse(req.body.metadata);
      } catch {
        throw new BankError('Send the academic metadata with your images');
      }
      const files = req.files as Record<string, Express.Multer.File[]>;
      const result = await questions.save(
        req.params.id ? String(req.params.id) : undefined,
        input,
        { question: files?.question?.[0], answer: files?.answer?.[0] },
        identities.get(req)!.id,
      );
      res.status(req.params.id ? 200 : 201).json(result);
    } finally {
      savesInFlight--;
    }
  };
  const bounds: express.RequestHandler = (req, _res, next) => {
    if (!storage) throw new AssetStorageError('Image storage is not configured');
    if (Number(req.headers['content-length'] ?? 0) > imageLimits.totalBytes + 32768)
      throw new BankError('Upload request is too large', 413);
    next();
  };
  app.post('/api/questions', bounds, upload, save);
  app.put('/api/questions/:id', bounds, upload, save);
  app.patch('/api/questions/:id/status', async (req, res) =>
    res.json(await questions.status(String(req.params.id), req.body, identities.get(req)!.id)),
  );
  app.delete('/api/questions/:id', () => {
    throw new BankError(
      'Archive questions to preserve records, images and history. Permanent deletion is disabled.',
      409,
    );
  });
  app.get('/api/admin/legacy-questions', admin, async (req, res) =>
    res.json(await bank.legacyRecords(req.query.page === undefined ? 1 : Number(req.query.page))),
  );
  app.get('/api/admin/legacy-questions/:id', admin, async (req, res) =>
    res.json(await bank.legacyRecord(String(req.params.id))),
  );
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
  app.use(
    (error: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (res.headersSent) return next(error);
      const status =
        error instanceof BankError || error instanceof AssetStorageError
          ? error.status
          : error instanceof multer.MulterError
            ? error.code === 'LIMIT_FILE_SIZE'
              ? 413
              : 400
            : 'type' in error && error.type === 'entity.parse.failed'
              ? 400
              : 'type' in error && error.type === 'entity.too.large'
                ? 413
                : 500;
      // Transport errors can embed credentials or URLs; never log raw errors.
      if (status >= 500) console.error('Question Bank request failed');
      if (error instanceof AssetWriteFailure)
        console.error('Asset reconciliation required', error.code, error.reconciliationReference);
      res.status(status).json({
        error:
          error instanceof BankError ||
          error instanceof AssetStorageError ||
          error instanceof multer.MulterError
            ? error.message
            : status === 400
              ? 'Invalid JSON request'
              : status === 413
                ? 'Request too large'
                : 'Unexpected server error',
      });
    },
  );
  return app;
}
