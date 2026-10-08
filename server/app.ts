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

export function createApp(
  bank: Bank,
  storage: AssetStorage | undefined,
  options: { allowWrites?: boolean } = {},
) {
  const app = express();
  const assets = storage ? new AssetService(storage, bank) : undefined;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
      let host = '';
      try {
        host = new URL(req.headers.origin).host;
      } catch {
        /* Opaque origins are not allowed to write. */
      }
      if (host !== req.headers.host)
        return res.status(403).json({ error: 'Cross-origin writes are not permitted' });
    }
    next();
  });
  app.use(express.json({ limit: '5mb' }));
  app.get('/api/health', async (_req, res) => {
    try {
      await bank.one('SELECT 1 AS connected');
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });
  app.use('/api', (req, res, next) => {
    const allowWrites = options.allowWrites ?? bank.db.kind === 'sqlite';
    if (!allowWrites && !['GET', 'HEAD', 'OPTIONS'].includes(req.method))
      return res
        .status(403)
        .json({ error: 'Hosted writes are disabled until teacher authentication is configured' });
    next();
  });
  app.use('/uploads', async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!storage) return res.status(503).json({ error: 'Asset storage is not configured' });
    if (storage.kind !== 'local')
      return res
        .status(403)
        .json({ error: 'Private asset delivery requires teacher authorization' });
    if (!['GET', 'HEAD'].includes(req.method))
      return res.status(405).json({ error: 'Asset delivery accepts read requests only' });
    const key = assetKeyFromReference('/uploads' + req.path);
    if (!key) throw new AssetStorageError('Invalid asset reference', 400, 'invalid_key');
    const result = await storage.get(key);
    if (!result) return res.status(404).json({ error: 'Asset not found' });
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
  app.get('/api/taxonomy', async (_req, res) => res.json(await bank.taxonomy()));
  const editable = (kind: string): EditableKind => {
    if (!editableKinds.includes(kind as EditableKind))
      throw new BankError('This taxonomy type is not editable');
    return kind as EditableKind;
  };
  app.get('/api/taxonomy/:kind/:id/impact', async (req, res) =>
    res.json(await bank.curriculum.impact(editable(req.params.kind), String(req.params.id))),
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
  app.get('/api/curriculum-versions', async (_req, res) =>
    res.json(await bank.curriculum.versions()),
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
  app.get('/api/curriculum-versions/:id/impact', async (req, res) =>
    res.json(await bank.curriculum.impact('curriculumVersions', String(req.params.id))),
  );
  app.patch('/api/curriculum-versions/:id', async (req, res) =>
    res.json(await bank.curriculum.editVersion(String(req.params.id), req.body)),
  );
  app.delete('/api/curriculum-versions/:id', () => {
    throw new BankError('Retire curriculum versions instead of deleting their history.', 409);
  });
  app.get('/api/curriculum-versions/:id/export', async (req, res) => {
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
      await bank.counts(typeof req.query.course === 'string' ? req.query.course : undefined),
    ),
  );
  app.get('/api/questions', async (req, res) => {
    const filters: Filters = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value !== 'string') throw new BankError('Query parameters must be single strings');
      filters[key] = value;
    }
    res.json(await bank.list(filters));
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
              (a) => !['answer_diagram', 'answer_pdf', 'original_pdf'].includes(a.kind),
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
  app.get('/api/questions/:id/export', async (req, res) => {
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
  app.get('/api/questions/:id/versions', async (req, res) =>
    res.json(await bank.versions(String(req.params.id))),
  );
  app.get('/api/questions/:id/revisions', async (req, res) => {
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
    limits: { fileSize: maxAssetBytes, files: 1 },
  });
  app.post(
    '/api/uploads',
    (req, _res, next) => {
      if (!assets) throw new AssetStorageError('Asset storage is not configured');
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
            ? 400
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
