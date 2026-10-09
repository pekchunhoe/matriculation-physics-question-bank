import { put, get, head, del, BlobNotFoundError } from '@vercel/blob';
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

export type BlobTransport = Pick<typeof import('@vercel/blob'), 'put' | 'get' | 'head' | 'del'>;
const transport: BlobTransport = { put, get, head, del };
export const blobAssetPrefix = 'question-bank/assets/';

/** No filesystem, browser URLs, client tokens or public/signed delivery URLs. */
export class VercelBlobAssetStorage implements AssetStorage {
  readonly kind = 'vercel-private-blob' as const;
  constructor(
    private readonly storeId: string,
    private readonly blob: BlobTransport = transport,
  ) {
    if (!/^(?:store_)?[a-zA-Z0-9]+$/.test(storeId))
      throw new AssetStorageError('Invalid private storage configuration', 503, 'invalid_config');
  }
  private pathname(key: string) {
    assertAssetKey(key);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[0-9a-f]{64}\.(svg|png|jpg|webp|pdf)$/.test(
        key,
      )
    )
      throw new AssetStorageError('Invalid managed asset reference', 400, 'invalid_key');
    return blobAssetPrefix + key;
  }
  private options() {
    return { storeId: this.storeId };
  }
  private verifyMetadata(
    key: string,
    value: { pathname: string; contentType: string; size: number; uploadedAt: Date; url: string },
  ): AssetMetadata {
    const url = new URL(value.url);
    const expectedHostname =
      `${this.storeId.replace(/^store_/, '')}.private.blob.vercel-storage.com`.toLowerCase();
    if (
      value.pathname !== this.pathname(key) ||
      url.protocol !== 'https:' ||
      url.hostname.toLowerCase() !== expectedHostname ||
      url.pathname !== '/' + this.pathname(key) ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      value.contentType !== assetMimeFromKey(key) ||
      !Number.isSafeInteger(value.size) ||
      value.size < 1 ||
      value.size > maxAssetBytes
    )
      throw new AssetStorageError(
        'Private asset metadata failed verification',
        503,
        'integrity_failed',
      );
    return {
      key,
      mime: assetMimeFromKey(key),
      size: value.size,
      sha256: assetDigestFromKey(key),
      uploadedAt: value.uploadedAt,
    };
  }
  async put(upload: ValidatedUpload) {
    const key = newAssetKey(upload);
    verifyStoredContent(key, upload.bytes, upload.mime);
    try {
      const result = await this.blob.put(this.pathname(key), upload.bytes, {
        ...this.options(),
        access: 'private',
        contentType: upload.mime,
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 60,
        maximumSizeInBytes: maxAssetBytes,
      });
      const metadata = this.verifyMetadata(key, {
        ...result,
        size: upload.bytes.length,
        uploadedAt: new Date(),
      });
      return { ...metadata, url: `/uploads/${key}`, name: upload.displayName };
    } catch {
      // A timed-out upload may have reached Blob. Surface its opaque planned
      // reference for internal reconciliation, without guessing at deletion.
      throw new AssetWriteFailure(`/uploads/${key}`);
    }
  }
  async metadata(key: string) {
    const pathname = this.pathname(key);
    try {
      return this.verifyMetadata(key, await this.blob.head(pathname, this.options()));
    } catch (error) {
      if (error instanceof BlobNotFoundError) return;
      if (error instanceof AssetStorageError) throw error;
      throw new AssetStorageError('Private asset metadata unavailable');
    }
  }
  async get(key: string) {
    const pathname = this.pathname(key);
    try {
      const result = await this.blob.get(pathname, {
        ...this.options(),
        access: 'private',
        useCache: false,
      });
      if (!result) return;
      if (result.statusCode !== 200)
        throw new AssetStorageError('Private asset retrieval unavailable');
      const reader = result.stream.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      try {
        const metadata = this.verifyMetadata(key, result.blob);
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > maxAssetBytes || size > metadata.size)
            throw new AssetStorageError('Asset integrity check failed');
          chunks.push(chunk.value);
        }
        const bytes = Buffer.concat(chunks);
        if (size !== metadata.size) throw new AssetStorageError('Asset integrity check failed');
        verifyStoredContent(key, bytes, metadata.mime);
        return { metadata, bytes };
      } finally {
        try {
          await reader.cancel();
        } finally {
          reader.releaseLock();
        }
      }
    } catch (error) {
      if (error instanceof BlobNotFoundError) return;
      if (error instanceof AssetStorageError) throw error;
      throw new AssetStorageError('Private asset retrieval unavailable');
    }
  }
  async exists(key: string) {
    return Boolean(await this.metadata(key));
  }
  async delete(key: string) {
    const pathname = this.pathname(key);
    try {
      await this.blob.del(pathname, this.options());
    } catch (error) {
      if (!(error instanceof BlobNotFoundError))
        throw new AssetStorageError('Private asset deletion failed');
    }
  }
}
/** SDK reads/refreshes project OIDC automatically; no copied or pinned OIDC token. */
export function hostedAssetStorage(env: NodeJS.ProcessEnv = process.env): AssetStorage | undefined {
  const storeId = env.BLOB_STORE_ID?.trim();
  if (!storeId) return;
  if (env.VERCEL !== '1')
    throw new AssetStorageError(
      'Private storage requires a Vercel project environment',
      503,
      'invalid_config',
    );
  return new VercelBlobAssetStorage(storeId);
}
