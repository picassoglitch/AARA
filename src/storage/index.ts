import type { Storage } from './interface.js';
import { LocalStorage } from './local.js';
import { VercelBlobStorage } from './vercel-blob.js';
import { resolveVercelBlobConfig } from './resolve-blob.js';

export type { Storage, StorageFile } from './interface.js';
export { LocalStorage, VercelBlobStorage };
export { resolveVercelBlobConfig, getBlobEnvNames } from './resolve-blob.js';

let storageInstance: Storage | null = null;

export function getStorage(): Storage {
  if (storageInstance) return storageInstance;

  const { hasVercelBlobConfig, token, storeId, checkedNames } = resolveVercelBlobConfig();
  const isVercel = !!process.env.VERCEL;

  if (hasVercelBlobConfig) {
    storageInstance = new VercelBlobStorage(token ?? undefined, storeId ?? undefined);
  } else if (isVercel) {
    console.error(
      `[storage] No blob storage configured. Checked env vars: ${checkedNames.join(', ')}`
    );
    throw new Error(
      'No blob storage configured for Vercel deployment. ' +
      `Set one of: ${checkedNames.join(', ')}`
    );
  } else {
    storageInstance = new LocalStorage(
      process.env.UPLOADS_PATH || 'uploads',
      process.env.UPLOADS_URL || '/uploads'
    );
  }

  return storageInstance;
}
