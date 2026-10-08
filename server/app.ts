import express from 'express';
import multer from 'multer';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Bank, BankError, taxonomyTables, type Filters } from './database.js';
import { compareDocuments, PdfRevisionImportService } from './revisions.js';
import { warnings } from '../shared/schema.js';
import { editableKinds } from './curriculum.js';
import { classificationSchema, type EditableKind } from '../shared/curriculum.js';

export function createApp(
  bank: Bank,
  uploadDir: string | undefined,
  options: { allowWrites?: boolean } = {},
) {
  const app = express();
  if (uploadDir) mkdirSync(uploadDir, { recursive: true });
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
  app.use('/api/uploads', (_req, res, next) => {
    if (!uploadDir)
      return res.status(503).json({ error: 'Durable upload storage is not configured' });
    next();
  });
  app.use('/api', (req, res, next) => {
    const allowWrites = options.allowWrites ?? bank.db.kind === 'sqlite';
    if (!allowWrites && !['GET', 'HEAD', 'OPTIONS'].includes(req.method))
      return res
        .status(403)
        .json({ error: 'Hosted writes are disabled until teacher authentication is configured' });
    next();
  });
  if (uploadDir)
    app.use(
      '/uploads',
      express.static(uploadDir, {
        setHeaders(res) {
          res.setHeader(
            'Content-Security-Policy',
            "sandbox; default-src 'none'; style-src 'unsafe-inline'",
          );
        },
      }),
    );
  if (!uploadDir)
    app.use('/uploads', (_req, res) =>
      res.status(503).json({ error: 'Durable upload storage is not configured' }),
    );
  const checkAssets = (doc: Awaited<ReturnType<Bank['validate']>>) => {
    for (const a of doc.assets)
      if (a.url.startsWith('/uploads/')) {
        if (!uploadDir) throw new BankError('Durable upload storage is not configured', 503);
        if (!existsSync(join(uploadDir, a.url.slice('/uploads/'.length))))
          throw new BankError(`Uploaded asset not found: ${a.alt}`);
        const ext = a.url.split('.').at(-1),
          types: Record<string, string> = {
            svg: 'image/svg+xml',
            png: 'image/png',
            jpg: 'image/jpeg',
            webp: 'image/webp',
            pdf: 'application/pdf',
          };
        if (types[ext ?? ''] !== a.mime)
          throw new BankError(`Asset MIME type does not match uploaded file: ${a.alt}`);
      }
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
    checkAssets(doc);
    res
      .status(201)
      .json(
        await bank.create(doc, req.body.note, req.body.author, req.body.confirmApproval === true),
      );
  });
  app.post('/api/import/validate', async (req, res) => {
    const doc = await bank.resolveImport(req.body.document);
    checkAssets(doc);
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
    checkAssets(doc);
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
    checkAssets(doc);
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
    limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  });
  app.post('/api/uploads', upload.single('file'), (req, res) => {
    if (!uploadDir) throw new BankError('Durable upload storage is not configured', 503);
    const file = req.file;
    if (!file) throw new BankError('Choose a file');
    const b = file.buffer;
    let ext = '',
      mime = '';
    if (b.subarray(0, 5).toString() === '%PDF-') {
      ext = 'pdf';
      mime = 'application/pdf';
    } else if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      ext = 'png';
      mime = 'image/png';
    } else if (b[0] === 255 && b[1] === 216 && b[2] === 255) {
      ext = 'jpg';
      mime = 'image/jpeg';
    } else if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') {
      ext = 'webp';
      mime = 'image/webp';
    } else if (/^(?:\s*<\?xml[^>]*\?>)?\s*<svg[\s>]/i.test(b.toString('utf8'))) {
      const svg = b.toString('utf8');
      const references = [
        ...[...svg.matchAll(/(?:href|src)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi)].map((m) => m[1]),
        ...[...svg.matchAll(/url\s*\(\s*([^)]*)\)/gi)].map((m) => m[1]),
      ];
      if (
        /<\s*(script|foreignObject|iframe|style|object|embed)|\bon\w+\s*=|<!ENTITY|<!DOCTYPE/i.test(
          svg,
        ) ||
        references.some(
          (value) => !/^#[a-zA-Z0-9_.:-]+$/.test(value.trim().replace(/^["']|["']$/g, '')),
        )
      )
        throw new BankError('SVG contains active or externally referenced content');
      ext = 'svg';
      mime = 'image/svg+xml';
    }
    if (!ext) throw new BankError('Supported files: SVG, PNG, JPEG, WebP, PDF');
    const name = `${randomUUID()}.${ext}`;
    writeFileSync(join(uploadDir, name), b);
    res.status(201).json({ url: `/uploads/${name}`, mime, name: file.originalname });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
  app.use(
    (error: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (res.headersSent) return next(error);
      const status =
        error instanceof BankError
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
      res
        .status(status)
        .json({
          error:
            error instanceof BankError || error instanceof multer.MulterError
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
