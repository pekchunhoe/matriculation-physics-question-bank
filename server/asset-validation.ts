import { createHash } from 'node:crypto';
import { SaxesParser } from 'saxes';
import { assetDigestFromKey, assetMimeFromKey, type AssetMime } from '../shared/asset-reference.js';
import { AssetStorageError, maxAssetBytes, type ValidatedUpload } from './asset-storage.js';

const svgElements = new Set([
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'textPath',
  'title',
  'desc',
  'clipPath',
  'mask',
  'marker',
  'pattern',
  'linearGradient',
  'radialGradient',
  'stop',
  'image',
]);
function validateSvg(bytes: Buffer) {
  const reject = () => {
    throw new AssetStorageError(
      'SVG contains invalid, active or externally referenced content',
      400,
      'invalid_svg',
    );
  };
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return reject();
  }
  const parser = new SaxesParser({ xmlns: true });
  let root = false;
  parser.on('error', reject);
  parser.on('doctype', reject);
  parser.on('processinginstruction', reject);
  parser.on('opentag', (tag) => {
    if (!root) {
      if (tag.local !== 'svg') reject();
      root = true;
    }
    if (!svgElements.has(tag.local) || !['', 'http://www.w3.org/2000/svg'].includes(tag.uri))
      reject();
    for (const attr of Object.values(tag.attributes)) {
      const name = attr.local.toLowerCase(),
        value = attr.value.trim();
      if (name.startsWith('on') || name === 'base') reject();
      if (attr.uri === 'http://www.w3.org/2000/xmlns/') {
        if (!['http://www.w3.org/2000/svg', 'http://www.w3.org/1999/xlink'].includes(value))
          reject();
        continue;
      }
      if (
        attr.uri &&
        !['http://www.w3.org/1999/xlink', 'http://www.w3.org/XML/1998/namespace'].includes(attr.uri)
      )
        reject();
      if (['href', 'src'].includes(name) && !/^#[a-zA-Z0-9_.:-]+$/.test(value)) reject();
      if (value.includes('\\') || /@import|expression\s*\(|javascript\s*:|data\s*:/i.test(value))
        reject();
      for (const match of value.matchAll(/url\s*\(\s*([^)]*)\)/gi))
        if (!/^#[a-zA-Z0-9_.:-]+$/.test(match[1].trim().replace(/^["']|["']$/g, ''))) reject();
    }
  });
  try {
    parser.write(text).close();
  } catch {
    reject();
  }
  if (!root) reject();
}

export function validateUpload(
  bytes: Buffer,
  filename: string,
  declaredMime?: string,
): ValidatedUpload {
  if (!bytes.length) throw new AssetStorageError('Choose a nonempty file', 400, 'file_size');
  if (bytes.length > maxAssetBytes)
    throw new AssetStorageError('Files must be no larger than 20 MiB', 413, 'file_size');
  if (
    !filename.trim() ||
    filename.length > 200 ||
    /[\\/:]|%[0-9a-f]{2}|\p{Cc}|\p{Cf}/iu.test(filename) ||
    filename.includes('..') ||
    filename.trim() === '.'
  )
    throw new AssetStorageError('Invalid display filename', 400, 'invalid_filename');
  let extension: string, mime: AssetMime;
  if (bytes.subarray(0, 5).toString() === '%PDF-') {
    extension = 'pdf';
    mime = 'application/pdf';
  } else if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    extension = 'png';
    mime = 'image/png';
  } else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    extension = 'jpg';
    mime = 'image/jpeg';
  } else if (
    bytes.subarray(0, 4).toString() === 'RIFF' &&
    bytes.subarray(8, 12).toString() === 'WEBP'
  ) {
    extension = 'webp';
    mime = 'image/webp';
  } else if (/^(?:\uFEFF)?\s*(?:<\?xml[^>]*\?>\s*)?<svg[\s>]/i.test(bytes.toString('utf8'))) {
    validateSvg(bytes);
    extension = 'svg';
    mime = 'image/svg+xml';
  } else
    throw new AssetStorageError('Supported files: SVG, PNG, JPEG, WebP, PDF', 400, 'invalid_file');
  if (declaredMime && declaredMime !== 'application/octet-stream' && declaredMime !== mime)
    throw new AssetStorageError('File MIME type does not match its content', 400, 'invalid_mime');
  const suffix = filename.trim().split('.');
  if (suffix.length > 1 && assetMimeFromKey(filename.trim().toLowerCase()) !== mime)
    throw new AssetStorageError(
      'Filename extension does not match file content',
      400,
      'invalid_mime',
    );
  return {
    bytes: Buffer.from(bytes),
    extension,
    mime,
    displayName: filename.trim().normalize('NFC'),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

export function verifyStoredContent(key: string, bytes: Buffer, mime: AssetMime) {
  let actual: ValidatedUpload;
  try {
    actual = validateUpload(bytes, key, mime);
  } catch {
    throw new AssetStorageError('Asset integrity check failed', 503, 'integrity_failed');
  }
  const expected = assetDigestFromKey(key);
  if (expected && actual.sha256 !== expected)
    throw new AssetStorageError('Asset integrity check failed', 503, 'integrity_failed');
  return actual.sha256;
}
