export interface StorageFile {
  key: string;
  url: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
}

export interface Storage {
  upload(file: Buffer, filename: string, contentType: string): Promise<StorageFile>;
  
  getUrl(key: string): Promise<string>;
  
  delete(key: string): Promise<void>;
  
  list(): Promise<StorageFile[]>;
  
  exists(key: string): Promise<boolean>;
}
