/**
 * Resolves Vercel Blob configuration from various environment variable names.
 * Vercel's OIDC auth uses BLOB_STORE_ID; legacy auth uses BLOB_READ_WRITE_TOKEN.
 * Integrations may create vars with custom prefixes (e.g., aara_BLOB_READ_WRITE_TOKEN).
 */

const KNOWN_TOKEN_NAMES = [
  'BLOB_READ_WRITE_TOKEN',
  'aara_BLOB_READ_WRITE_TOKEN',
];

const KNOWN_STORE_ID_NAMES = [
  'BLOB_STORE_ID',
  'aara_BLOB_STORE_ID',
];

export interface BlobResolveResult {
  token: string | null;
  tokenSource: string | null;
  storeId: string | null;
  storeIdSource: string | null;
  hasVercelBlobConfig: boolean;
  checkedNames: string[];
}

export function resolveVercelBlobConfig(): BlobResolveResult {
  const checkedNames: string[] = [...KNOWN_TOKEN_NAMES, ...KNOWN_STORE_ID_NAMES];
  let token: string | null = null;
  let tokenSource: string | null = null;
  let storeId: string | null = null;
  let storeIdSource: string | null = null;

  for (const name of KNOWN_TOKEN_NAMES) {
    const value = process.env[name];
    if (value) {
      token = value;
      tokenSource = name;
      break;
    }
  }

  if (!token) {
    for (const [name, value] of Object.entries(process.env)) {
      if (!value) continue;
      if (name.endsWith('_BLOB_READ_WRITE_TOKEN') && !KNOWN_TOKEN_NAMES.includes(name)) {
        checkedNames.push(name);
        token = value;
        tokenSource = name;
        break;
      }
    }
  }

  for (const name of KNOWN_STORE_ID_NAMES) {
    const value = process.env[name];
    if (value) {
      storeId = value;
      storeIdSource = name;
      break;
    }
  }

  if (!storeId) {
    for (const [name, value] of Object.entries(process.env)) {
      if (!value) continue;
      if (name.endsWith('_BLOB_STORE_ID') && !KNOWN_STORE_ID_NAMES.includes(name)) {
        checkedNames.push(name);
        storeId = value;
        storeIdSource = name;
        break;
      }
    }
  }

  return {
    token,
    tokenSource,
    storeId,
    storeIdSource,
    hasVercelBlobConfig: !!(token || storeId),
    checkedNames,
  };
}

/**
 * Returns the list of env var names checked for blob configuration.
 */
export function getBlobEnvNames(): string[] {
  const names = [...KNOWN_TOKEN_NAMES, ...KNOWN_STORE_ID_NAMES];
  for (const name of Object.keys(process.env)) {
    if (name.endsWith('_BLOB_READ_WRITE_TOKEN') && !names.includes(name)) {
      names.push(name);
    }
    if (name.endsWith('_BLOB_STORE_ID') && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}
