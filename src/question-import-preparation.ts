import {
  importLimits,
  questionPackageSchema,
  validationMessage,
  type ImportManifest,
} from '../shared/question-import';

export type PreparedImport = {
  manifest: ImportManifest;
  blobs: Map<string, Blob>;
  urls: Map<string, string>;
};
export function releaseImport(prepared: PreparedImport | null) {
  prepared?.urls.forEach((url) => URL.revokeObjectURL(url));
  prepared?.urls.clear();
  prepared?.blobs.clear();
}
export async function prepareQuestionImport(source: string): Promise<PreparedImport> {
  if (new TextEncoder().encode(source).length > importLimits.packageBytes)
    throw new Error('package: Question JSON exceeds 5 MiB');
  let input: unknown;
  try {
    input = JSON.parse(source);
  } catch {
    throw new Error('package: Invalid JSON; check commas, quotes and escaped LaTeX backslashes');
  }
  const parsed = questionPackageSchema.safeParse(input);
  if (!parsed.success) throw new Error(validationMessage(parsed.error));
  const { assets, ...fields } = parsed.data;
  const manifest: ImportManifest = {
    ...fields,
    assets: assets.map(({ dataBase64, ...asset }) => {
      void dataBase64;
      return asset;
    }),
  };
  if (new TextEncoder().encode(JSON.stringify(manifest)).length > importLimits.manifestBytes)
    throw new Error('package: Structured manifest exceeds 384 KiB');
  const prepared: PreparedImport = { manifest, blobs: new Map(), urls: new Map() };
  try {
    for (const [i, a] of assets.entries()) {
      const binary = atob(a.dataBase64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      if (btoa(binary) !== a.dataBase64)
        throw new Error(`assets[${i}].dataBase64: Use canonical Base64`);
      if (bytes.length !== a.byteLength)
        throw new Error(`assets[${i}].byteLength: Decoded byte length does not match`);
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('');
      if (digest !== a.sha256)
        throw new Error(`assets[${i}].sha256: Embedded content hash does not match`);
      const blob = new Blob([bytes], { type: a.mimeType });
      prepared.blobs.set(a.key, blob);
      prepared.urls.set(a.key, URL.createObjectURL(blob));
    }
    return prepared;
  } catch (error) {
    releaseImport(prepared);
    throw error;
  }
}
