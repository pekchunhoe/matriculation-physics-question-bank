import type { QuestionDocument } from '../shared/schema.js';
import { Bank, BankError } from './database.js';

export type Difference = { path: string; before: unknown; after: unknown };
export function compareDocuments(
  current: QuestionDocument,
  candidate: QuestionDocument,
): Difference[] {
  const result: Difference[] = [];
  function visit(a: unknown, b: unknown, path: string) {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (
      a &&
      b &&
      typeof a === 'object' &&
      typeof b === 'object' &&
      !Array.isArray(a) &&
      !Array.isArray(b)
    ) {
      const left = a as Record<string, unknown>,
        right = b as Record<string, unknown>;
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)]))
        visit(left[key], right[key], path ? `${path}.${key}` : key);
    } else result.push({ path, before: a, after: b });
  }
  visit(current, candidate, '');
  return result;
}
export interface PdfCandidateExtractor {
  extract(pdfUrl: string): Promise<unknown>;
}
// Extraction is intentionally an adapter boundary. No parser or automatic approval is installed.
export class PdfRevisionImportService {
  constructor(
    private bank: Bank,
    private extractor?: PdfCandidateExtractor,
  ) {}
  async prepare(
    questionId: string,
    pdfUrl: string,
    note: string,
    author: string,
    baseVersion: number,
  ) {
    if (!this.extractor)
      throw new BankError(
        'PDF extraction is not configured. Use reviewed structured JSON or manual editing.',
        501,
      );
    if (!/^\/uploads\/[a-zA-Z0-9.-]+\.pdf$/.test(pdfUrl))
      throw new BankError('Use an uploaded revised PDF');
    const candidate = await this.bank.resolveImport(await this.extractor.extract(pdfUrl));
    const result = await this.bank.save(questionId, candidate, note, baseVersion, author, 'pdf');
    if ('candidateId' in result && result.candidateId)
      await this.bank.run(
        'UPDATE revision_candidates SET source_pdf_url=? WHERE id=?',
        pdfUrl,
        result.candidateId,
      );
    return { ...result, diff: compareDocuments(await this.bank.document(questionId), candidate) };
  }
}
