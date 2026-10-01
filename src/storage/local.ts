import { promises as fs } from 'fs';
import path from 'path';
import type { Storage, StorageFile } from './interface.js';

export class LocalStorage implements Storage {
  private basePath: string;
  private baseUrl: string;

  constructor(basePath: string = 'uploads', baseUrl: string = '/uploads') {
    this.basePath = basePath;
    this.baseUrl = baseUrl;
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  async upload(file: Buffer, filename: string, contentType: string): Promise<StorageFile> {
    await this.ensureDir();
    
    const key = `${Date.now()}-${filename}`;
    const filePath = path.join(this.basePath, key);
    
    await fs.writeFile(filePath, file);
    
    return {
      key,
      url: `${this.baseUrl}/${key}`,
      size: file.length,
      contentType,
      uploadedAt: new Date(),
    };
  }

  async getUrl(key: string): Promise<string> {
    return `${this.baseUrl}/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async list(): Promise<StorageFile[]> {
    await this.ensureDir();
    
    const files = await fs.readdir(this.basePath);
    const results: StorageFile[] = [];
    
    for (const filename of files) {
      const filePath = path.join(this.basePath, filename);
      const stat = await fs.stat(filePath);
      
      if (stat.isFile()) {
        results.push({
          key: filename,
          url: `${this.baseUrl}/${filename}`,
          size: stat.size,
          contentType: this.guessContentType(filename),
          uploadedAt: stat.mtime,
        });
      }
    }
    
    return results;
  }

  async exists(key: string): Promise<boolean> {
    const filePath = path.join(this.basePath, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private guessContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const types: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return types[ext] || 'application/octet-stream';
  }
}
