import express from 'express';
import multer from 'multer';
import { AssetService } from './asset-service.js';
import {
  AssetStorageError,
  AssetWriteFailure,
  maxAssetBytes,
  type AssetStorage,
} from './asset-storage.js';
import { assetKeyFromReference } from '../shared/asset-reference.js';
import { Bank, BankError, taxonomyTables, type Filters } from './database.js';
import { compareDocuments, PdfRevisionImportService } from './revisions.js';
import { warnings } from '../shared/schema.js';
import { editableKinds } from './curriculum.js';
import { classificationSchema, type EditableKind } from '../shared/curriculum.js';
import { AuthService, type AdminIdentity } from './auth.js';
import { QuestionJsonImportService } from './question-json-import.js';
import { importLimits } from '../shared/question-import.js';
import { z } from 'zod';
import { VisibilityService } from './visibility.js';
import { securityHeaders } from './security-headers.js';

export function createApp(
  bank: Bank,
  storage: AssetStorage | undefined,
  options: { hosted?: boolean; development?: boolean } = {},
) {
  const app = express();
  const assets = storage ? new AssetService(storage, bank) : undefined;
  const auth = new AuthService(bank, options.hosted ?? false);
  const visibility = new VisibilityService(bank);
  const identities = new WeakMap<express.Request, AdminIdentity>();
  const admin: express.RequestHandler = async (req, _res, next) => {
    if (!identities.has(req)) identities.set(req, await auth.requireAdmin(req));
    next();
  };
  const questionImport = new QuestionJsonImportService(bank, storage);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    for (const [key, value] of Object.entries(securityHeaders)) {
      // Vite's loopback-only development HTML uses an inline HMR preamble.
      // Hosted responses always enforce CSP, regardless of development options.
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
  app.use(express.json({ limit: auth.hosted ? '3mb' : '5mb' }));
  app.use('/api', async (req, _res, next) => {
    if (!identities.has(req)) {
      const identity = await auth.identity(req);
      if (identity) identities.set(req, identity);
    }
    next();
  });
  app.get('/api/public/question-set', async (req, res) => {
    await auth.limit('public-print-ip', auth.clientAddress(req), 20, 60_000);
    await auth.limit('public-print-global', 'all', 500, 60_000);
    res.json(await visibility.questionSet(req.query.ids, req.query.answers, req.query.hints));
  });
  app.use('/uploads', async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!storage) return res.status(503).json({ error: 'Asset storage is not configured' });
    if (!['GET', 'HEAD'].includes(req.method))
      return res.status(405).json({ error: 'Asset delivery accepts read requests only' });
    const key = assetKeyFromReference('/uploads' + req.path);
    if (!key) throw new AssetStorageError('Invalid asset reference', 400, 'invalid_key');
    if (!(await auth.identity(req)) && !(await visibility.publicAsset('/uploads/' + key)))
      throw new BankError('Asset not found', 404);
    const result = await storage.get(key);
    if (!result) return res.status(404).json({ error: 'Asset not found' });
    if (auth.hosted && result.bytes.length > 3 * 1024 * 1024)
      throw new BankError('Asset exceeds the hosted delivery limit', 413);
    res.setHeader(
      'Content-Security-Policy',
      "sandbox; default-src 'none'; style-src 'unsafe-inline'",
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `inline; filename="${key}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.type(result.metadata.mime);
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range),
        size = result.bytes.length;
      const start = match?.[1]
        ? Number(match[1])
        : match?.[2]
          ? Math.max(0, size - Number(match[2]))
          : NaN;
      const end = match?.[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        start >= size ||
        end < start
      )
        return res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      return res.status(206).send(result.bytes.subarray(start, end + 1));
    }
    res.send(result.bytes);
  });
  const checkAssets = async (doc: Awaited<ReturnType<Bank['validate']>>) => {
    if (!assets && doc.assets.some((asset) => asset.url.startsWith('/uploads/')))
      throw new AssetStorageError('Asset storage is not configured');
    await assets?.checkDocument(doc);
  };
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
      await bank.counts(
        typeof req.query.course === 'string' ? req.query.course : undefined,
        !identities.has(req),
      ),
    ),
  );
  app.get('/api/questions', async (req, res) => {
    const filters: Filters = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value !== 'string') throw new BankError('Query parameters must be single strings');
      filters[key] = value;
    }
    res.json(identities.has(req) ? await bank.list(filters) : await visibility.list(filters));
  });
  app.post('/api/questions', async (req, res) => {
    const doc = await bank.validate(req.body.document);
    await checkAssets(doc);
    res
      .status(201)
      .json(
        await bank.create(doc, req.body.note, req.body.author, req.body.confirmApproval === true),
      );
  });
  const importUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: importLimits.assetBytes,
      files: importLimits.assetCount,
      fields: 3,
      fieldSize: importLimits.manifestBytes,
      fieldNameSize: 80,
      parts: importLimits.assetCount + 3,
    },
  });
  app.post('/api/admin/questions/import/validate', async (req, res) => {
    const input = z
      .object({
        manifest: z.unknown(),
        selectedDifficulty: z.unknown().optional(),
        allowDuplicate: z.boolean().optional(),
        compatibility: z.unknown().optional(),
      })
      .strict()
      .safeParse(req.body);
    if (!input.success)
      throw new BankError('package: Send the structured manifest and selected difficulty');
    res.json(
      await questionImport.validate(
        input.data.manifest,
        identities.get(req)!,
        input.data.selectedDifficulty,
        input.data.allowDuplicate,
        input.data.compatibility,
      ),
    );
  });
  app.post(
    '/api/admin/questions/import/commit',
    (req, _res, next) => {
      if (
        Number(req.headers['content-length'] ?? 0) >
        importLimits.totalAssetBytes + importLimits.manifestBytes + 64 * 1024
      )
        throw new BankError('assets: Import request is too large', 413);
      next();
    },
    importUpload.any(),
    async (req, res) => {
      const input = z
        .object({
          manifest: z.string(),
          token: z.string().max(2000),
          selectedDifficulty: z.unknown().optional(),
        })
        .strict()
        .safeParse(req.body);
      if (!input.success)
        throw new BankError('package: Send manifest, validation token and selected difficulty');
      let manifest: unknown;
      try {
        manifest = JSON.parse(input.data.manifest);
      } catch {
        throw new BankError('package: Invalid manifest JSON');
      }
      const files = Array.isArray(req.files) ? req.files : [];
      if (files.reduce((sum, f) => sum + f.size, 0) > importLimits.totalAssetBytes)
        throw new BankError('assets: Combined binary data exceeds 3 MiB', 413);
      res
        .status(201)
        .json(
          await questionImport.commit(
            manifest,
            input.data.token,
            files,
            identities.get(req)!,
            input.data.selectedDifficulty,
          ),
        );
    },
  );
  app.post('/api/import/validate', async (req, res) => {
    const doc = await bank.resolveImport(req.body.document);
    await checkAssets(doc);
    res.json({
      document: doc,
      classification: await bank.curriculum.classification(doc),
      savedClassification:
        req.body.document?.schemaVersion === 2
          ? classificationSchema.parse(req.body.document.savedClassification)
          : undefined,
      warnings: warnings(doc),
    });
  });
  app.post('/api/import', async (req, res) => {
    const doc = await bank.resolveImport(req.body.document);
    await checkAssets(doc);
    const result = req.body.questionId
      ? await bank.save(
          req.body.questionId,
          doc,
          req.body.note,
          req.body.baseVersion,
          req.body.author,
          'json',
        )
      : await bank.create(
          doc,
          req.body.note,
          req.body.author,
          req.body.confirmApproval === true,
          req.body.document?.schemaVersion === 2
            ? classificationSchema.parse(req.body.document.savedClassification)
            : undefined,
        );
    res.status(201).json(result);
  });
  app.get('/api/questions/:id', async (req, res) => {
    const id = String(req.params.id),
      version = req.query.version ? Number(req.query.version) : undefined;
    if (version !== undefined && (!Number.isInteger(version) || version < 1))
      throw new BankError('Invalid version');
    if (!identities.has(req)) {
      if (version !== undefined) throw new BankError('Administrator authentication required', 401);
      const loaded = await visibility.approved(id);
      return res.json({ id, ...loaded, warnings: [] });
    }
    const doc = await bank.document(id, version),
      student = req.query.view === 'student';
    res.json({
      id,
      version: version ?? (await bank.current(id)).active_version,
      document: student
        ? {
            ...doc,
            solutions: [],
            assets: doc.assets.filter(
              (a) =>
                !['answer_diagram', 'answer_pdf', 'original_pdf'].includes(a.kind) &&
                !doc.solutions
                  .flatMap((s) => [s.blocks, ...s.steps.map((t) => t.blocks)])
                  .some((blocks) => blocks?.some((b) => b.type === 'image' && b.assetId === a.id)),
            ),
          }
        : doc,
      warnings: student ? [] : warnings(doc),
      metadata: student ? undefined : await bank.current(id),
      savedClassification: student ? undefined : await bank.savedClassification(id, version),
    });
  });
  app.put('/api/questions/:id', async (req, res) => {
    const doc = await bank.validate(req.body.document);
    await checkAssets(doc);
    res.json(
      await bank.save(
        String(req.params.id),
        doc,
        req.body.note,
        req.body.baseVersion,
        req.body.author,
      ),
    );
  });
  app.get('/api/questions/:id/export', admin, async (req, res) => {
    const version = req.query.version === undefined ? undefined : Number(req.query.version);
    if (version !== undefined && (!Number.isInteger(version) || version < 1))
      throw new BankError('Invalid version');
    const id = String(req.params.id),
      doc = await bank.document(id, version);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.question.questionCode}.json"`,
    );
    res.json(
      req.query.provenance === 'true'
        ? {
            schemaVersion: 2,
            document: doc,
            savedClassification: await bank.savedClassification(id, version),
          }
        : doc,
    );
  });
  app.get('/api/questions/:id/versions', admin, async (req, res) =>
    res.json(await bank.versions(String(req.params.id))),
  );
  app.get('/api/questions/:id/revisions', admin, async (req, res) => {
    const id = String(req.params.id);
    const document = await bank.document(id);
    res.json(
      (await bank.candidates(id)).map((c) => ({
        ...c,
        diff: compareDocuments(document, c.document),
      })),
    );
  });
  app.post('/api/revisions/:id/review', async (req, res) => {
    if (typeof req.body.approve !== 'boolean')
      throw new BankError('An explicit review decision is required');
    res.json(await bank.review(String(req.params.id), req.body.approve, req.body.reviewer));
  });
  app.post('/api/questions/:id/pdf-revision', async (req, res) =>
    res.json(
      await new PdfRevisionImportService(bank).prepare(
        String(req.params.id),
        req.body.pdfUrl,
        req.body.note,
        req.body.author,
        req.body.baseVersion,
      ),
    ),
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: auth.hosted ? 3 * 1024 * 1024 : maxAssetBytes,
      files: 1,
      fields: 0,
      parts: 1,
    },
  });
  app.post(
    '/api/uploads',
    (req, _res, next) => {
      if (!assets) throw new AssetStorageError('Asset storage is not configured');
      if (auth.hosted && Number(req.headers['content-length'] ?? 0) > 3.5 * 1024 * 1024)
        throw new BankError('Hosted upload request is too large', 413);
      next();
    },
    upload.single('file'),
    async (req, res) => {
      const file = req.file;
      if (!file) throw new BankError('Choose a file');
      const stored = await assets!.upload(file.buffer, file.originalname, file.mimetype);
      console.info('Asset staged', stored.url);
      res.status(201).json({
        url: stored.url,
        mime: stored.mime,
        name: stored.name,
        size: stored.size,
        sha256: stored.sha256,
        state: 'staged',
      });
    },
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
