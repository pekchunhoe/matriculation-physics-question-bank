import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { assetDigestFromKey, assetMimeFromKey, type AssetMime } from '../shared/asset-reference.js';
import { imageLimits } from '../shared/image-question.js';
import { AssetStorageError, maxAssetBytes, type ValidatedUpload } from './asset-storage.js';
function signature(bytes: Buffer): AssetMime | undefined {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp';
}
export function validateUpload(
  bytes: Buffer,
  filename: string,
  declaredMime?: string,
): ValidatedUpload {
  if (!bytes.length || bytes.length > imageLimits.bytes)
    throw new AssetStorageError('Each image must be 1 byte?1.5 MiB', 413, 'file_size');
  if (
    !filename.trim() ||
    filename.length > 200 ||
    /[\\/:]|%[0-9a-f]{2}|\p{Cc}|\p{Cf}/iu.test(filename) ||
    filename.includes('..')
  )
    throw new AssetStorageError('Invalid display filename', 400, 'invalid_filename');
  const mime = signature(bytes);
  if (!mime) throw new AssetStorageError('Choose a PNG, JPEG or WebP image', 400, 'invalid_file');
  if (
    (declaredMime && declaredMime !== 'application/octet-stream' && declaredMime !== mime) ||
    assetMimeFromKey(filename.toLowerCase()) !== mime
  )
    throw new AssetStorageError(
      'Image extension, MIME type and content must match',
      400,
      'invalid_mime',
    );
  return {
    bytes: Buffer.from(bytes),
    mime,
    extension: mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp',
    displayName: filename,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}
/** Decode all pixels; retain original bytes. Only the question-list thumbnail is resized. */
export async function validateImage(
  bytes: Buffer,
  filename: string,
  mime?: string,
  thumbnail = false,
) {
  const upload = validateUpload(bytes, filename, mime);
  try {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: imageLimits.pixels });
    const meta = await image.metadata();
    if (
      !meta.width ||
      !meta.height ||
      meta.width > imageLimits.width ||
      meta.height > imageLimits.height ||
      (meta.pages ?? 1) !== 1 ||
      (meta.orientation ?? 1) !== 1
    )
      throw new Error('Invalid dimensions, animation or orientation');
    await image.clone().stats();
    const thumb = thumbnail
      ? await image
          .clone()
          .resize({ width: 480, height: 640, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 78 })
          .toBuffer()
      : undefined;
    return { upload, width: meta.width, height: meta.height, thumbnail: thumb };
  } catch {
    throw new AssetStorageError(
      'Image must decode completely, be static and upright, and fit 12,000 ? 30,000 pixels / 40 megapixels. Export an upright PNG/JPEG/WebP and retry.',
      400,
      'invalid_image',
    );
  }
}
export function verifyStoredContent(key: string, bytes: Buffer, mime: AssetMime) {
  const digest = createHash('sha256').update(bytes).digest('hex'),
    expected = assetDigestFromKey(key);
  // Historical PDF/SVG files remain administrator-only attachments, with no interpretation.
  const historical =
    mime === 'application/pdf'
      ? bytes.subarray(0, 5).toString() === '%PDF-'
      : mime === 'image/svg+xml' && /<svg[\s>]/i.test(bytes.subarray(0, 4096).toString());
  if (
    !bytes.length ||
    bytes.length > maxAssetBytes ||
    assetMimeFromKey(key) !== mime ||
    (!historical && signature(bytes) !== mime) ||
    (expected && expected !== digest)
  )
    throw new AssetStorageError('Asset integrity check failed', 503, 'integrity_failed');
  return digest;
}
