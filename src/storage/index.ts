import type { Storage } from './interface.js';
import { LocalStorage } from './local.js';
import { VercelBlobStorage } from './vercel-blob.js';

export type { Storage, StorageFile } from './interface.js';
export { LocalStorage, VercelBlobStorage };

let storageInstance: Storage | null = null;

export function getStorage(): Storage {
  if (storageInstance) return storageInstance;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    storageInstance = new VercelBlobStorage();
  } else {
    storageInstance = new LocalStorage(
      process.env.UPLOADS_PATH || 'uploads',
      process.env.UPLOADS_URL || '/uploads'
    );
  }

  return storageInstance;
}
