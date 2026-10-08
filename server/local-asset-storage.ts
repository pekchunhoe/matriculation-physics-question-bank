import { constants } from 'node:fs';
import { lstat, mkdir, open, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { assetDigestFromKey, assetMimeFromKey } from '../shared/asset-reference.js';
import {
  AssetStorageError,
  AssetWriteFailure,
  assertAssetKey,
  maxAssetBytes,
  newAssetKey,
  type AssetMetadata,
  type AssetStorage,
  type ValidatedUpload,
} from './asset-storage.js';
import { verifyStoredContent } from './asset-validation.js';

function missing(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
/** Imported only by the local entry point/tests, never the hosted API graph. */
export class LocalAssetStorage implements AssetStorage {
  readonly kind = 'local' as const;
  private readonly directory: string;
  constructor(directory: string) {
    this.directory = resolve(directory);
  }
  private path(key: string) {
    assertAssetKey(key);
    return join(this.directory, key);
  }
  async put(upload: ValidatedUpload) {
    const key = newAssetKey(upload);
    verifyStoredContent(key, upload.bytes, upload.mime);
    try {
      await mkdir(this.directory, { recursive: true });
      // Exclusive creation prevents collisions from overwriting existing assets.
      await using handle = await open(this.path(key), 'wx', 0o600);
      try {
        await handle.writeFile(upload.bytes);
      } catch {
        await handle.close();
        try {
          await unlink(this.path(key));
        } catch {
          throw new AssetWriteFailure(
            `/uploads/${key}`,
            'Partial asset cleanup failed; reconciliation required',
          );
        }
        throw new AssetStorageError('Asset write failed; partial file removed');
      }
      return {
        key,
        url: `/uploads/${key}`,
        name: upload.displayName,
        mime: upload.mime,
        size: upload.bytes.length,
        sha256: upload.sha256,
        uploadedAt: new Date(),
      };
    } catch (error) {
      if (error instanceof AssetStorageError) throw error;
      throw new AssetStorageError('Local asset storage unavailable');
    }
  }
  async metadata(key: string): Promise<AssetMetadata | undefined> {
    const path = this.path(key);
    try {
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || info.size < 1 || info.size > maxAssetBytes)
        throw new AssetStorageError('Asset is not a safe stored file', 503, 'integrity_failed');
      return {
        key,
        mime: assetMimeFromKey(key),
        size: info.size,
        sha256: assetDigestFromKey(key),
        uploadedAt: info.birthtime,
      };
    } catch (error) {
      if (missing(error)) return;
      if (error instanceof AssetStorageError) throw error;
      throw new AssetStorageError('Local asset metadata unavailable');
    }
  }
  async get(key: string) {
    const metadata = await this.metadata(key);
    if (!metadata) return;
    try {
      await using handle = await open(
        this.path(key),
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
      );
      const info = await handle.stat();
      if (!info.isFile() || info.size > maxAssetBytes)
        throw new AssetStorageError('Asset integrity check failed');
      const bytes = await handle.readFile();
      const sha256 = verifyStoredContent(key, bytes, metadata.mime);
      return { metadata: { ...metadata, size: bytes.length, sha256 }, bytes };
    } catch (error) {
      if (missing(error)) return;
      if (error instanceof AssetStorageError) throw error;
      throw new AssetStorageError('Local asset retrieval unavailable');
    }
  }
  async exists(key: string) {
    return Boolean(await this.metadata(key));
  }
  async delete(key: string) {
    if (!(await this.metadata(key))) return;
    try {
      await unlink(this.path(key));
    } catch (error) {
      if (!missing(error)) throw new AssetStorageError('Local asset deletion failed');
    }
  }
}
