import { randomUUID } from 'node:crypto';
import { validAssetKey, type AssetMime } from '../shared/asset-reference.js';

export const maxAssetBytes = 20 * 1024 * 1024;
export class AssetStorageError extends Error {
  constructor(
    message: string,
    readonly status = 503,
    readonly code = 'storage_unavailable',
  ) {
    super(message);
  }
}
export class AssetWriteFailure extends AssetStorageError {
  constructor(
    readonly reconciliationReference: string,
    message = 'Asset upload failed; reconciliation may be required',
  ) {
    super(message, 503, 'upload_uncertain');
  }
}
export interface ValidatedUpload {
  bytes: Buffer;
  mime: AssetMime;
  extension: string;
  displayName: string;
  sha256: string;
}
export interface AssetMetadata {
  key: string;
  mime: AssetMime;
  size: number;
  sha256?: string;
  uploadedAt: Date;
}
export interface StoredUpload extends AssetMetadata {
  url: string;
  name: string;
}
export interface AssetStorage {
  readonly kind: 'local' | 'vercel-private-blob';
  put(upload: ValidatedUpload): Promise<StoredUpload>;
  get(key: string): Promise<{ metadata: AssetMetadata; bytes: Buffer } | undefined>;
  metadata(key: string): Promise<AssetMetadata | undefined>;
  exists(key: string): Promise<boolean>;
  /** Internal primitive; application deletion must first audit references. */
  delete(key: string): Promise<void>;
}
export function assertAssetKey(key: string) {
  if (!validAssetKey(key))
    throw new AssetStorageError('Invalid asset reference', 400, 'invalid_key');
}
export function newAssetKey(upload: ValidatedUpload) {
  const key = `${randomUUID()}-${upload.sha256}.${upload.extension}`;
  assertAssetKey(key);
  return key;
}
