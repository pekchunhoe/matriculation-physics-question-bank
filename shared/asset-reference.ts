export const assetMimeTypes = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
} as const;
export type AssetMime = (typeof assetMimeTypes)[keyof typeof assetMimeTypes];

/** A logical filename, never an absolute path, URL, encoded path or directory. */
export function validAssetKey(key: string) {
  return (
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}\.(?:svg|png|jpe?g|webp|pdf)$/.test(key) &&
    !key.includes('..')
  );
}
export function assetKeyFromReference(reference: string): string | undefined {
  if (!reference.startsWith('/uploads/')) return;
  const key = reference.slice('/uploads/'.length);
  return validAssetKey(key) ? key : undefined;
}
export function assetMimeFromKey(key: string): AssetMime {
  return assetMimeTypes[key.split('.').at(-1) as keyof typeof assetMimeTypes];
}
export function assetDigestFromKey(key: string): string | undefined {
  return key.match(/^[0-9a-f-]{36}-([0-9a-f]{64})\./)?.[1];
}
