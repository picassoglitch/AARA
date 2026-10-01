import { put, del, list as blobList } from '@vercel/blob';
import type { Storage, StorageFile } from './interface.js';

export class VercelBlobStorage implements Storage {
  private token: string | undefined;
  private storeId: string | undefined;

  constructor(token?: string, storeId?: string) {
    this.token = token;
    this.storeId = storeId;
  }

  async upload(file: Buffer, filename: string, contentType: string): Promise<StorageFile> {
    const key = `artworks/${Date.now()}-${filename}`;

    const options: Parameters<typeof put>[2] = {
      access: 'public',
      contentType,
    };
    if (this.token) options.token = this.token;
    if (this.storeId) options.storeId = this.storeId;

    const blob = await put(key, file, options);
    
    return {
      key: blob.pathname,
      url: blob.url,
      size: file.length,
      contentType,
      uploadedAt: new Date(),
    };
  }

  private listOptions(extra?: Record<string, unknown>): Parameters<typeof blobList>[0] {
    const opts: Parameters<typeof blobList>[0] = { ...extra };
    if (this.token) opts.token = this.token;
    if (this.storeId) opts.storeId = this.storeId;
    return opts;
  }

  private delOptions(): { token?: string } {
    const opts: { token?: string } = {};
    if (this.token) opts.token = this.token;
    return opts;
  }

  async getUrl(key: string): Promise<string> {
    const blobs = await blobList(this.listOptions({ prefix: key, limit: 1 }));
    const blob = blobs.blobs[0];
    if (!blob) throw new Error(`File not found: ${key}`);
    return blob.url;
  }

  async delete(key: string): Promise<void> {
    const blobs = await blobList(this.listOptions({ prefix: key, limit: 1 }));
    const blob = blobs.blobs[0];
    if (blob) {
      await del(blob.url, this.delOptions());
    }
  }

  async list(): Promise<StorageFile[]> {
    const blobs = await blobList(this.listOptions({ prefix: 'artworks/' }));
    
    return blobs.blobs.map(blob => ({
      key: blob.pathname,
      url: blob.url,
      size: blob.size,
      contentType: this.guessContentType(blob.pathname),
      uploadedAt: blob.uploadedAt,
    }));
  }

  async exists(key: string): Promise<boolean> {
    const blobs = await blobList(this.listOptions({ prefix: key, limit: 1 }));
    return blobs.blobs.length > 0;
  }

  private guessContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const types: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
    };
    return types[ext || ''] || 'application/octet-stream';
  }
}
