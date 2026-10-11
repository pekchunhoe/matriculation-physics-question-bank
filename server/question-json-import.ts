import { assetKeyFromReference } from '../shared/asset-reference.js';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { Bank, BankError } from './database.js';
import { AssetService, AssetConsistencyError } from './asset-service.js';
import {
  AssetStorageError,
  AssetWriteFailure,
  type AssetStorage,
  type StoredUpload,
} from './asset-storage.js';
import { validateUpload } from './asset-validation.js';
import {
  importLimits,
  importManifestSchema,
  validationMessage,
  selectedDifficultySchema,
  type SelectedDifficulty,
  type ImportManifest,
  type ImportPreview,
} from '../shared/question-import.js';
import type { QuestionDocument, Taxon } from '../shared/schema.js';
import type { AdminIdentity } from './auth.js';
import {
  checkImportStructure,
  normalizeQuestionImport,
  compatibilitySubmissionSchema,
} from '../shared/import-compatibility.js';

const hash = (value: unknown) =>
  createHash('sha256')
    .update(
      JSON.stringify(value, (_key, item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? Object.fromEntries(
              Object.keys(item)
                .sort()
                .map((key) => [key, item[key]]),
            )
          : item,
      ),
    )
    .digest('hex');
export const imageExtension = (mime: string) =>
  ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' })[
    mime
  ]!;
const planSchema = z
  .object({
    id: z.string().uuid(),
    adminId: z.string(),
    digest: z.string(),
    taxonomyDigest: z.string(),
    selectedDifficulty: selectedDifficultySchema,
    expiresAt: z.number().int(),
    allowDuplicate: z.boolean().default(false),
  })
  .strict();
type Plan = z.infer<typeof planSchema>;
export type ImportFile = { fieldname: string; buffer: Buffer; mimetype: string };

export class QuestionJsonImportService {
  private readonly assets?: AssetService;
  constructor(
    private readonly bank: Bank,
    private readonly storage?: AssetStorage,
    private readonly now = Date.now,
  ) {
    this.assets = storage ? new AssetService(storage, bank) : undefined;
  }
  manifest(input: unknown) {
    try {
      checkImportStructure(input, importLimits.packageBytes);
    } catch (error) {
      throw new BankError((error as Error).message);
    }
    if (Buffer.byteLength(JSON.stringify(input) ?? '') > importLimits.manifestBytes)
      throw new BankError('package: Structured manifest exceeds 384 KiB', 413);
    const canonical = input && typeof input === 'object' && Object.hasOwn(input, 'schemaVersion');
    if (!canonical) {
      const result = normalizeQuestionImport(input, {}, true);
      if (!result.valid)
        throw new BankError(
          result.diagnostics
            .filter((d) => d.blocking)
            .map(
              (d) =>
                `${d.sourcePath || 'package'} → ${d.destinationPath || 'review'}: ${d.message}`,
            )
            .join('\n'),
        );
      input = result.candidate;
    }
    const parsed = importManifestSchema.safeParse(input);
    if (!parsed.success) throw new BankError(validationMessage(parsed.error));
    return parsed.data;
  }
  private async signature(payload: string, admin: AdminIdentity) {
    const row = await this.bank.one(
      'SELECT password_hash FROM admins WHERE id=? AND disabled=0',
      admin.id,
    );
    if (!row) throw new BankError('Administrator unavailable', 403);
    // Domain-separated, durable per-admin signing key. No process-local state or new runtime secret.
    return createHmac('sha256', String(row.password_hash))
      .update('question-json-plan-v1\0' + payload)
      .digest('base64url');
  }
  private selection(input: unknown): SelectedDifficulty {
    if (input === undefined || input === null || input === '')
      throw new BankError(
        'selectedDifficulty: Select a difficulty before validating this question.',
      );
    const parsed = selectedDifficultySchema.safeParse(input);
    if (!parsed.success) throw new BankError('selectedDifficulty: Select Easy, Medium or Hard.');
    return parsed.data;
  }
  private preserveDifficulty(doc: ImportManifest, selection: SelectedDifficulty) {
    if (doc.difficulty === undefined) return;
    const recognized = ['Easy', 'Medium', 'Hard'].find(
      (d) => d.toLowerCase() === doc.difficulty!.trim().toLowerCase(),
    );
    if (!recognized)
      throw new BankError(
        'difficulty: Source difficulty is ambiguous; explicitly confirm a canonical difficulty in the review.',
      );
    if (recognized !== selection)
      throw new BankError(
        'selectedDifficulty: Preserve the source difficulty (' +
          recognized +
          '); it cannot be silently changed.',
      );
  }
  private async verify(
    token: unknown,
    doc: ImportManifest,
    admin: AdminIdentity,
    selectedDifficulty: SelectedDifficulty,
  ): Promise<Plan> {
    if (typeof token !== 'string' || token.length > 2000)
      throw new BankError('token: Invalid validation plan', 409);
    const [payload, signature, extra] = token.split('.');
    const expected = await this.signature(payload ?? '', admin);
    const actual = Buffer.from(signature ?? '');
    if (
      extra ||
      !signature ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, Buffer.from(expected))
    )
      throw new BankError(
        'token: Validation plan is tampered or belongs to another administrator',
        409,
      );
    let plan: Plan;
    try {
      plan = planSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    } catch {
      throw new BankError('token: Invalid validation plan', 409);
    }
    if (
      plan.adminId !== admin.id ||
      plan.selectedDifficulty !== selectedDifficulty ||
      plan.digest !== hash({ manifest: doc, selectedDifficulty })
    )
      throw new BankError('token: Content or difficulty changed; validate and preview again', 409);
    return plan;
  }
  private async resolve(doc: ImportManifest, id: string, selectedDifficulty: SelectedDifficulty) {
    if (
      doc.question.questionCode &&
      (await this.bank.one(
        'SELECT id FROM questions WHERE question_code=?',
        doc.question.questionCode,
      ))
    )
      throw new BankError(
        'question.questionCode: This code already exists; use the separate revision workflow or omit it for a new draft',
      );
    const tax = await this.bank.taxonomy();
    const versions = (tax.curriculumVersions ?? []).filter(
      (v) => v.code === doc.classification.curriculumVersionCode && v.status !== 'retired',
    );
    if (versions.length !== 1)
      throw new BankError(
        'classification.curriculumVersionCode: Expected exactly one non-retired curriculum version with this exact code',
      );
    const version = versions[0];
    const exact = (items: Taxon[], name: string, parent: string, path: string) => {
      const matches = items.filter(
        (t) => t.name === name && t.parentId === parent && t.status !== 'retired',
      );
      if (matches.length !== 1)
        throw new BankError(
          `classification.${path}: Expected one exact name under the specified parent`,
        );
      return matches[0];
    };
    const semester = exact(
      tax.semesters.filter((s) => s.curriculumVersionId === version.id),
      doc.classification.semester,
      version.courseId,
      'semester',
    );
    const chapter = exact(tax.chapters, doc.classification.chapter, semester.id, 'chapter');
    const topic = exact(tax.topics, doc.classification.topic, chapter.id, 'topic');
    const subtopic =
      doc.classification.subtopic === null
        ? null
        : exact(tax.subtopics, doc.classification.subtopic, topic.id, 'subtopic');
    const difficulties = tax.difficulties.filter((d) => d.name === selectedDifficulty);
    if (difficulties.length !== 1)
      throw new BankError('selectedDifficulty: Expected exactly one canonical difficulty record');
    const difficulty = difficulties[0];
    const kind = {
      question_diagram: 'physics_diagram',
      answer_diagram: 'answer_diagram',
      free_body_diagram: 'fbd',
      graph: 'graph',
      circuit_diagram: 'circuit_diagram',
      table_image: 'reference_image',
      other_visual: 'illustration',
    } as const;
    const document: QuestionDocument = {
      schemaVersion: 1,
      question: {
        ...doc.question,
        questionCode: doc.question.questionCode ?? 'JSON-' + id.toUpperCase(),
        topicId: topic.id,
        subtopicId: subtopic?.id ?? null,
        difficultyId: difficulty.id,
        status: 'draft',
        containsDiagram: doc.assets.length > 0,
        containsGraph: doc.assets.some((a) => a.role === 'graph'),
        containsFbd: doc.assets.some((a) => a.role === 'free_body_diagram'),
      },
      parts: doc.parts,
      solutions: doc.solutions,
      hints: doc.hints,
      tags: doc.tags,
      assets: doc.assets.map((a, order) => ({
        id: a.key,
        partId:
          doc.parts.find((p) => p.blocks?.some((b) => b.type === 'image' && b.assetId === a.key))
            ?.id ??
          doc.solutions.find((s) =>
            [s.blocks, ...s.steps.map((t) => t.blocks)].some((blocks) =>
              blocks?.some((b) => b.type === 'image' && b.assetId === a.key),
            ),
          )?.partId ??
          null,
        kind: kind[a.role],
        url: `/uploads/${id}-${a.sha256}.${imageExtension(a.mimeType)}`,
        alt: a.alt || '',
        mime: a.mimeType,
        order,
        importMetadata: {
          role: a.role,
          caption: a.caption,
          sha256: a.sha256,
          byteLength: a.byteLength,
        },
      })),
    };
    const classification = await this.bank.curriculum.classification(document);
    return {
      document,
      classification,
      taxonomyDigest: hash([version, semester, chapter, topic, subtopic, difficulty]),
    };
  }
  private fingerprint(doc: QuestionDocument) {
    const { questionCode, status, ...question } = doc.question;
    void questionCode;
    void status;
    return hash({
      question,
      parts: doc.parts,
      solutions: doc.solutions,
      hints: doc.hints,
      tags: doc.tags,
      assets: doc.assets.map((a) => ({
        id: a.id,
        kind: a.kind,
        mime: a.mime,
        sha256: a.importMetadata?.sha256,
      })),
    });
  }
  private async duplicates(document: QuestionDocument) {
    const fingerprint = this.fingerprint(document);
    const candidates = await this.bank.all(
      'SELECT id,title FROM questions WHERE title=? AND total_marks=?',
      document.question.title,
      document.question.totalMarks,
    );
    const matches: { id: string; title: string }[] = [];
    for (const candidate of candidates)
      if (this.fingerprint(await this.bank.document(String(candidate.id))) === fingerprint)
        matches.push({ id: String(candidate.id), title: String(candidate.title) });
    return matches;
  }
  async validate(
    input: unknown,
    admin: AdminIdentity,
    selection: unknown,
    allowDuplicate = false,
    compatibility?: unknown,
  ): Promise<ImportPreview> {
    const selectedDifficulty = this.selection(selection);
    const doc = this.manifest(input),
      id = randomUUID();
    if (compatibility !== undefined) {
      try {
        const submitted = compatibilitySubmissionSchema.parse(compatibility);
        const normalized = normalizeQuestionImport(submitted.source, submitted.review, true);
        if (!normalized.valid)
          throw new Error(
            normalized.diagnostics
              .filter((d) => d.blocking)
              .map((d) => `${d.sourcePath} → ${d.destinationPath ?? 'review'}: ${d.message}`)
              .join('\n'),
          );
        if (hash(importManifestSchema.parse(normalized.candidate)) !== hash(doc))
          throw new Error('Normalized source differs from the submitted canonical manifest.');
      } catch (error) {
        throw new BankError('compatibility: ' + (error as Error).message);
      }
    }
    this.preserveDifficulty(doc, selectedDifficulty);
    if (doc.assets.length && !this.assets)
      throw new AssetStorageError('Asset storage is not configured');
    const resolved = await this.resolve(doc, id, selectedDifficulty);
    const warnings: string[] = [];
    for (const a of doc.assets) {
      if (!a.alt)
        warnings.push(
          `assets.${a.key}: No alt text supplied; add an accessibility description after review.`,
        );
      if (a.byteLength > 2 * 1024 * 1024)
        warnings.push(`assets.${a.key}: Large visual; review label clarity and package size.`);
    }
    const duplicates = await this.duplicates(resolved.document);
    if (duplicates.length) {
      warnings.push(
        'Duplicate content fingerprint: an existing question contains identical structured content. Review before creating another draft.',
      );
    }
    const expiresAt = this.now() + importLimits.planLifetimeMs;
    const plan: Plan = {
      id,
      adminId: admin.id,
      digest: hash({ manifest: doc, selectedDifficulty }),
      selectedDifficulty,
      taxonomyDigest: resolved.taxonomyDigest,
      expiresAt,
      allowDuplicate,
    };
    const payload = Buffer.from(JSON.stringify(plan)).toString('base64url');
    const placement = (key: string) => {
      if (doc.question.blocks?.some((b) => b.type === 'image' && b.assetId === key))
        return 'Question';
      for (const p of doc.parts)
        if (p.blocks?.some((b) => b.type === 'image' && b.assetId === key))
          return `Part ${p.label}`;
      for (const s of doc.solutions) {
        if (s.blocks?.some((b) => b.type === 'image' && b.assetId === key))
          return `Worked answer (${s.partId ?? 'whole question'})`;
        for (const t of s.steps)
          if (t.blocks?.some((b) => b.type === 'image' && b.assetId === key))
            return `Answer step ${t.number} (${s.partId ?? 'whole question'})`;
      }
      return '';
    };
    return {
      token: payload + '.' + (await this.signature(payload, admin)),
      document: resolved.document,
      classification: resolved.classification,
      warnings,
      duplicates,
      expiresAt,
      marks: {
        question: doc.question.totalMarks,
        parts: doc.parts.length
          ? doc.parts.filter((p) => p.parentId === null).reduce((sum, p) => sum + p.marks, 0)
          : doc.question.totalMarks,
        markingScheme: doc.solutions.reduce(
          (sum, s) => sum + s.steps.reduce((n, t) => n + t.marks, 0),
          0,
        ),
      },
      assets: doc.assets.map((a) => ({
        key: a.key,
        placement: placement(a.key),
        role: a.role,
        byteLength: a.byteLength,
        sha256: a.sha256,
      })),
    };
  }
  private async previous(plan: Plan, admin: AdminIdentity) {
    const receipt = await this.bank.one(
      'SELECT * FROM question_import_receipts WHERE plan_id=?',
      plan.id,
    );
    if (!receipt) return;
    if (receipt.admin_id !== admin.id || receipt.manifest_digest !== plan.digest)
      throw new BankError('token: Import receipt conflicts with plan', 409);
    return { id: String(receipt.question_id), version: 1, status: 'draft', alreadyImported: true };
  }
  async commit(
    input: unknown,
    token: unknown,
    files: ImportFile[],
    admin: AdminIdentity,
    selection: unknown,
  ) {
    const selectedDifficulty = this.selection(selection);
    const doc = this.manifest(input),
      plan = await this.verify(token, doc, admin, selectedDifficulty);
    this.preserveDifficulty(doc, selectedDifficulty);
    const previous = await this.previous(plan, admin);
    if (previous) return previous;
    if (plan.expiresAt <= this.now())
      throw new BankError('token: Preview expired; validate and preview again', 409);
    let resolved = await this.resolve(doc, plan.id, plan.selectedDifficulty);
    if (!plan.allowDuplicate && (await this.duplicates(resolved.document)).length)
      throw new BankError(
        'duplicate: Identical content already exists. Review the existing question or explicitly validate a separate draft.',
        409,
      );
    if (resolved.taxonomyDigest !== plan.taxonomyDigest)
      throw new BankError('classification: Curriculum changed; validate and preview again', 409);
    if (
      files.length !== doc.assets.length ||
      new Set(files.map((f) => f.fieldname)).size !== files.length
    )
      throw new BankError('assets: Supply exactly one binary file for every validated asset');
    const uploads = doc.assets.map((a, i) => {
      const file = files.find((f) => f.fieldname === a.key);
      if (!file) throw new BankError(`assets[${i}]: Missing binary file`);
      if (file.buffer.length !== a.byteLength || file.buffer.length > importLimits.assetBytes)
        throw new BankError(`assets[${i}].byteLength: Binary size mismatch or maximum exceeded`);
      let upload;
      try {
        upload = validateUpload(file.buffer, a.key + '.' + imageExtension(a.mimeType), a.mimeType);
      } catch (error) {
        throw new BankError(
          `assets[${i}].mimeType: ${error instanceof AssetStorageError ? error.message : 'Invalid file'}`,
        );
      }
      if (file.mimetype !== a.mimeType)
        throw new BankError(`assets[${i}].mimeType: Multipart MIME mismatch`);
      if (upload.sha256 !== a.sha256)
        throw new BankError(`assets[${i}].sha256: Binary hash mismatch`);
      return upload;
    });
    if (uploads.length && !this.assets)
      throw new AssetStorageError('Asset storage is not configured');
    const stored: StoredUpload[] = [];
    let result;
    try {
      for (const upload of uploads) {
        const receipt = await this.assets!.upload(upload.bytes, upload.displayName, upload.mime);
        stored.push(receipt);
        if (
          receipt.sha256 !== upload.sha256 ||
          receipt.mime !== upload.mime ||
          receipt.size !== upload.bytes.length ||
          assetKeyFromReference(receipt.url) !== receipt.key
        )
          throw new AssetStorageError('Import upload receipt failed integrity verification');
      }
      result = await this.bank.transaction(async () => {
        const previous = await this.previous(plan, admin);
        if (previous) return previous;
        if (plan.expiresAt <= this.now())
          throw new BankError('token: Preview expired; validate and preview again', 409);
        resolved = await this.resolve(doc, plan.id, plan.selectedDifficulty);
        if (!plan.allowDuplicate && (await this.duplicates(resolved.document)).length)
          throw new BankError(
            'duplicate: Identical content already exists. Validate again with explicit separate-draft approval.',
            409,
          );
        if (resolved.taxonomyDigest !== plan.taxonomyDigest)
          throw new BankError(
            'classification: Curriculum changed; validate and preview again',
            409,
          );
        resolved.document.assets = resolved.document.assets.map((a, i) => ({
          ...a,
          url: stored[i].url,
        }));
        const created = await this.bank.createInTransaction(
          resolved.document,
          'Question JSON import: reviewed preview; draft only',
          admin.email,
          false,
          resolved.classification,
          plan.id,
        );
        await this.bank.run(
          'INSERT INTO question_import_receipts VALUES(?,?,?,?,?,?)',
          plan.id,
          created.id,
          admin.id,
          plan.digest,
          this.fingerprint(resolved.document),
          this.now(),
        );
        return { ...created, status: 'draft', alreadyImported: false };
      });
    } catch (error) {
      await this.cleanup(stored);
      if (error instanceof AssetWriteFailure) {
        console.error(
          'Question JSON import reconciliation required',
          error.code,
          error.reconciliationReference,
        );
        throw error;
      }
      throw error;
    }
    if (result.alreadyImported) await this.cleanup(stored);
    return result;
  }
  private async cleanup(stored: StoredUpload[]) {
    let failure: AssetConsistencyError | undefined;
    for (const receipt of stored)
      try {
        if (!(await this.assets!.discardUnlinkedUpload(receipt))) throw new Error('linked');
      } catch {
        failure = new AssetConsistencyError(receipt.url, 'import_cleanup_failed');
        console.error(
          'Question JSON import reconciliation required',
          failure.code,
          failure.reconciliationReference,
        );
      }
    if (failure) throw failure;
  }
}
