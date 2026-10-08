import type { Bank } from './database.js';
import type { QuestionDocument } from '../shared/schema.js';
import { assetKeyFromReference } from '../shared/asset-reference.js';
import { AssetStorageError, type AssetStorage, type StoredUpload } from './asset-storage.js';
import { validateUpload } from './asset-validation.js';

export class AssetConsistencyError extends AssetStorageError {
  constructor(
    readonly reconciliationReference: string,
    code: string,
  ) {
    super('Asset metadata operation failed; reconciliation required', 503, code);
  }
}
export class AssetService {
  private readonly ownedUploads = new WeakSet<StoredUpload>();
  constructor(
    readonly storage: AssetStorage,
    private readonly bank: Bank,
  ) {}
  async upload(bytes: Buffer, name: string, declaredMime?: string) {
    const upload = Object.freeze(await this.storage.put(validateUpload(bytes, name, declaredMime)));
    this.ownedUploads.add(upload);
    return upload;
  }
  async checkDocument(doc: QuestionDocument) {
    for (const asset of doc.assets) {
      if (!asset.url.startsWith('/uploads/')) continue;
      const key = assetKeyFromReference(asset.url);
      if (!key) throw new AssetStorageError('Invalid asset reference', 400, 'invalid_key');
      const metadata = await this.storage.metadata(key);
      if (!metadata)
        throw new AssetStorageError('Referenced asset is missing', 400, 'missing_asset');
      if (metadata.mime !== asset.mime)
        throw new AssetStorageError(
          'Asset MIME type does not match uploaded file',
          400,
          'invalid_mime',
        );
    }
  }
  async isReferenced(reference: string) {
    if (!assetKeyFromReference(reference))
      throw new AssetStorageError('Invalid asset reference', 400, 'invalid_key');
    return Boolean(
      (await this.bank.one('SELECT 1 FROM assets WHERE url=? LIMIT 1', reference)) ||
      (await this.bank.one(
        "SELECT 1 FROM question_versions v,json_each(v.snapshot,'$.assets') a WHERE json_extract(a.value,'$.url')=? LIMIT 1",
        reference,
      )) ||
      (await this.bank.one(
        "SELECT 1 FROM revision_candidates r WHERE r.source_pdf_url=? OR EXISTS(SELECT 1 FROM json_each(r.snapshot,'$.assets') a WHERE json_extract(a.value,'$.url')=?) LIMIT 1",
        reference,
        reference,
      )),
    );
  }
  /** Only fresh receipts owned by this service can be cleaned up. No general GC. */
  async discardUnlinkedUpload(upload: StoredUpload) {
    if (!this.ownedUploads.has(upload))
      throw new AssetStorageError(
        'Asset cleanup requires an owned upload receipt',
        409,
        'unowned_asset',
      );
    return this.bank.transaction(async () => {
      if (await this.isReferenced(upload.url)) return false;
      await this.storage.delete(upload.key);
      this.ownedUploads.delete(upload);
      return true;
    });
  }
  /** Internal seam for a future authenticated upload-and-link operation. */
  async uploadAndLink<T>(
    bytes: Buffer,
    name: string,
    mime: string | undefined,
    persist: (upload: StoredUpload) => Promise<T>,
  ) {
    const upload = await this.upload(bytes, name, mime);
    try {
      return { upload, result: await persist(upload) };
    } catch {
      try {
        if (!(await this.discardUnlinkedUpload(upload)))
          throw new AssetConsistencyError(upload.url, 'linked_asset_retained');
      } catch (error) {
        const failure =
          error instanceof AssetConsistencyError
            ? error
            : new AssetConsistencyError(upload.url, 'cleanup_failed');
        // Record only the opaque application reference and safe error code.
        console.error(
          'Asset reconciliation required',
          failure.code,
          failure.reconciliationReference,
        );
        throw failure;
      }
      throw new AssetStorageError(
        'Asset metadata operation failed; new upload removed',
        503,
        'metadata_failed',
      );
    }
  }
}
