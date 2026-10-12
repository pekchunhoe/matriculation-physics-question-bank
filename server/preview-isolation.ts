import { createClient } from '@libsql/client/web';
import { BlobAccessError, list } from '@vercel/blob';

/** Nonsecret identities approved for this disposable Preview release. */
export const previewIsolation = Object.freeze({
  branch: 'feat/admin-security',
  databaseId: '01a12e45-e501-71ca-8efc-db378479d6b6',
  databaseHostname: 'phys-preview-image-20261012-pekchunhoe.aws-ap-northeast-1.turso.io',
  blobStoreId: 'store_cbLbAb1k796zV0Sl',
});
const productionDatabaseHostname =
  'matriculation-physics-question-bank-pekchunhoe.aws-ap-northeast-1.turso.io';
const productionBlobStoreId = 'store_El7fbP5PEpIgQK5i';

/** Runs before hosted initialization; never includes values in an error. */
export function assertPreviewIsolation(env: NodeJS.ProcessEnv = process.env) {
  if (
    env.VERCEL === '1' &&
    !['production', 'preview', 'development'].includes(env.VERCEL_ENV ?? '')
  )
    throw new Error('Preview isolation configuration rejected');
  if (env.VERCEL_ENV !== 'preview') return;
  try {
    const url = new URL(env.TURSO_DATABASE_URL ?? '');
    const token = env.TURSO_AUTH_TOKEN ?? '';
    const parts = token.split('.');
    const claims = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString());
    if (
      env.VERCEL !== '1' ||
      env.VERCEL_GIT_COMMIT_REF !== previewIsolation.branch ||
      url.protocol !== 'libsql:' ||
      url.hostname !== previewIsolation.databaseHostname ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '' && url.pathname !== '/') ||
      parts.length !== 3 ||
      !parts[0] ||
      !parts[2] ||
      claims.id !== previewIsolation.databaseId ||
      claims.a !== 'rw' ||
      claims.attach ||
      typeof claims.exp !== 'number' ||
      !Number.isFinite(claims.exp) ||
      claims.exp * 1000 <= Date.now() ||
      env.BLOB_STORE_ID !== previewIsolation.blobStoreId ||
      env.BLOB_READ_WRITE_TOKEN
    )
      throw new Error();
  } catch {
    throw new Error('Preview isolation configuration rejected');
  }
}

/** SELECT/list only. JWT inspection above is a guard, not signature verification. */
export async function verifyPreviewIsolation(env: NodeJS.ProcessEnv = process.env) {
  if (env.VERCEL_ENV !== 'preview') throw new Error('Preview verification unavailable');
  assertPreviewIsolation(env);
  const isolated = createClient({ url: env.TURSO_DATABASE_URL!, authToken: env.TURSO_AUTH_TOKEN });
  const production = createClient({
    url: 'libsql://' + productionDatabaseHostname,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  try {
    await isolated.execute('SELECT 1');
    let databaseDenied = false;
    try {
      await production.execute('SELECT 1');
    } catch (error) {
      // Network, timeout and unrelated server failures are not proof of denial.
      databaseDenied =
        error instanceof Error &&
        /\b401\b|\b403\b|not authorized|unauthorized|invalid jwt/i.test(error.message);
    }
    if (!databaseDenied) throw new Error('Preview verification failed');
    await list({ storeId: previewIsolation.blobStoreId, limit: 1 });
    let blobDenied = false;
    try {
      await list({ storeId: productionBlobStoreId, limit: 1 });
    } catch (error) {
      blobDenied = error instanceof BlobAccessError;
    }
    if (!blobDenied) throw new Error('Preview verification failed');
    return {
      status: 'verified',
      databaseId: previewIsolation.databaseId,
      blobStoreId: previewIsolation.blobStoreId,
      productionDatabaseAccess: 'denied',
      productionBlobAccess: 'denied',
    };
  } finally {
    isolated.close();
    production.close();
  }
}
