import express from 'express';
import multer from 'multer';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Bank, BankError, taxonomyTables, type Filters } from './database.js';
import { compareDocuments, PdfRevisionImportService } from './revisions.js';
import { warnings } from '../shared/schema.js';

export function createApp(bank: Bank, uploadDir: string) {
  const app = express();
  mkdirSync(uploadDir, { recursive: true });
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
  const checkAssets = (doc: ReturnType<Bank['validate']>) => {
    for (const a of doc.assets)
      if (a.url.startsWith('/uploads/')) {
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
  app.get('/api/taxonomy', (_req, res) => res.json(bank.taxonomy()));
  app.post('/api/taxonomy/:kind', (req, res) => {
    const kind = req.params.kind as keyof typeof taxonomyTables;
    if (!Object.hasOwn(taxonomyTables, kind)) throw new BankError('Unknown taxonomy type');
    if (
      typeof req.body.name !== 'string' ||
      (req.body.parentId !== null && typeof req.body.parentId !== 'string')
    )
      throw new BankError('Name and parentId are required');
    res.status(201).json({
      id: bank.addTaxon(kind, req.body.name, req.body.parentId, req.body.isTest === true),
    });
  });
  app.get('/api/counts', (req, res) =>
    res.json(bank.counts(typeof req.query.course === 'string' ? req.query.course : undefined)),
  );
  app.get('/api/questions', (req, res) => {
    const filters: Filters = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value !== 'string') throw new BankError('Query parameters must be single strings');
      filters[key] = value;
    }
    res.json(bank.list(filters));
  });
  app.post('/api/questions', (req, res) => {
    const doc = bank.validate(req.body.document);
    checkAssets(doc);
    res
      .status(201)
      .json(bank.create(doc, req.body.note, req.body.author, req.body.confirmApproval === true));
  });
  app.post('/api/import/validate', (req, res) => {
    const doc = bank.resolveImport(req.body.document);
    checkAssets(doc);
    res.json({ document: doc, warnings: warnings(doc) });
  });
  app.post('/api/import', (req, res) => {
    const doc = bank.resolveImport(req.body.document);
    checkAssets(doc);
    const result = req.body.questionId
      ? bank.save(
          req.body.questionId,
          doc,
          req.body.note,
          req.body.baseVersion,
          req.body.author,
          'json',
        )
      : bank.create(doc, req.body.note, req.body.author, req.body.confirmApproval === true);
    res.status(201).json(result);
  });
  app.get('/api/questions/:id', (req, res) => {
    const id = String(req.params.id),
      version = req.query.version ? Number(req.query.version) : undefined;
    if (version !== undefined && (!Number.isInteger(version) || version < 1))
      throw new BankError('Invalid version');
    const doc = bank.document(id, version),
      student = req.query.view === 'student';
    res.json({
      id,
      version: version ?? bank.current(id).active_version,
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
      metadata: student ? undefined : bank.current(id),
    });
  });
  app.put('/api/questions/:id', (req, res) => {
    const doc = bank.validate(req.body.document);
    checkAssets(doc);
    res.json(
      bank.save(String(req.params.id), doc, req.body.note, req.body.baseVersion, req.body.author),
    );
  });
  app.get('/api/questions/:id/export', (req, res) => {
    const doc = bank.document(String(req.params.id));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.question.questionCode}.json"`,
    );
    res.json(doc);
  });
  app.get('/api/questions/:id/versions', (req, res) =>
    res.json(bank.versions(String(req.params.id))),
  );
  app.get('/api/questions/:id/revisions', (req, res) => {
    const id = String(req.params.id);
    res.json(
      bank
        .candidates(id)
        .map((c) => ({ ...c, diff: compareDocuments(bank.document(id), c.document) })),
    );
  });
  app.post('/api/revisions/:id/review', (req, res) => {
    if (typeof req.body.approve !== 'boolean')
      throw new BankError('An explicit review decision is required');
    res.json(bank.review(String(req.params.id), req.body.approve, req.body.reviewer));
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
            : 'status' in error && typeof error.status === 'number'
              ? error.status
              : 500;
      if (status === 500) console.error(error);
      res
        .status(status)
        .json({ error: status === 500 ? 'Unexpected server error' : error.message });
    },
  );
  return app;
}
