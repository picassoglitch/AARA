import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveVercelBlobConfig, getBlobEnvNames } from '../src/storage/resolve-blob.js';

describe('resolveVercelBlobConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    delete process.env.aara_BLOB_READ_WRITE_TOKEN;
    delete process.env.aara_BLOB_STORE_ID;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns hasVercelBlobConfig=false when no blob env vars are set', () => {
    const result = resolveVercelBlobConfig();
    expect(result.hasVercelBlobConfig).toBe(false);
    expect(result.token).toBeNull();
    expect(result.storeId).toBeNull();
  });

  it('resolves BLOB_READ_WRITE_TOKEN', () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_token_123';
    const result = resolveVercelBlobConfig();
    expect(result.hasVercelBlobConfig).toBe(true);
    expect(result.token).toBe('vercel_blob_token_123');
    expect(result.tokenSource).toBe('BLOB_READ_WRITE_TOKEN');
  });

  it('resolves BLOB_STORE_ID (OIDC auth)', () => {
    process.env.BLOB_STORE_ID = 'store_abc123';
    const result = resolveVercelBlobConfig();
    expect(result.hasVercelBlobConfig).toBe(true);
    expect(result.storeId).toBe('store_abc123');
    expect(result.storeIdSource).toBe('BLOB_STORE_ID');
    expect(result.token).toBeNull();
  });

  it('resolves aara_BLOB_READ_WRITE_TOKEN (prefixed)', () => {
    process.env.aara_BLOB_READ_WRITE_TOKEN = 'prefixed_token';
    const result = resolveVercelBlobConfig();
    expect(result.hasVercelBlobConfig).toBe(true);
    expect(result.token).toBe('prefixed_token');
    expect(result.tokenSource).toBe('aara_BLOB_READ_WRITE_TOKEN');
  });

  it('resolves aara_BLOB_STORE_ID (prefixed)', () => {
    process.env.aara_BLOB_STORE_ID = 'prefixed_store';
    const result = resolveVercelBlobConfig();
    expect(result.hasVercelBlobConfig).toBe(true);
    expect(result.storeId).toBe('prefixed_store');
    expect(result.storeIdSource).toBe('aara_BLOB_STORE_ID');
  });

  it('resolves custom prefixed *_BLOB_READ_WRITE_TOKEN', () => {
    process.env.myapp_BLOB_READ_WRITE_TOKEN = 'custom_token';
    const result = resolveVercelBlobConfig();
    expect(result.hasVercelBlobConfig).toBe(true);
    expect(result.token).toBe('custom_token');
    expect(result.tokenSource).toBe('myapp_BLOB_READ_WRITE_TOKEN');
    expect(result.checkedNames).toContain('myapp_BLOB_READ_WRITE_TOKEN');
  });

  it('resolves custom prefixed *_BLOB_STORE_ID', () => {
    process.env.myapp_BLOB_STORE_ID = 'custom_store';
    const result = resolveVercelBlobConfig();
    expect(result.hasVercelBlobConfig).toBe(true);
    expect(result.storeId).toBe('custom_store');
    expect(result.storeIdSource).toBe('myapp_BLOB_STORE_ID');
  });

  it('resolves both token and storeId when both are set', () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'my_token';
    process.env.BLOB_STORE_ID = 'my_store';
    const result = resolveVercelBlobConfig();
    expect(result.hasVercelBlobConfig).toBe(true);
    expect(result.token).toBe('my_token');
    expect(result.storeId).toBe('my_store');
  });

  it('prefers known names over dynamic matches', () => {
    process.env.custom_BLOB_READ_WRITE_TOKEN = 'custom';
    process.env.aara_BLOB_READ_WRITE_TOKEN = 'aara';
    const result = resolveVercelBlobConfig();
    expect(result.token).toBe('aara');
    expect(result.tokenSource).toBe('aara_BLOB_READ_WRITE_TOKEN');
  });

  it('includes all checked names in result', () => {
    const result = resolveVercelBlobConfig();
    expect(result.checkedNames).toContain('BLOB_READ_WRITE_TOKEN');
    expect(result.checkedNames).toContain('BLOB_STORE_ID');
    expect(result.checkedNames).toContain('aara_BLOB_READ_WRITE_TOKEN');
    expect(result.checkedNames).toContain('aara_BLOB_STORE_ID');
  });
});

describe('getBlobEnvNames', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('includes known env names', () => {
    const names = getBlobEnvNames();
    expect(names).toContain('BLOB_READ_WRITE_TOKEN');
    expect(names).toContain('BLOB_STORE_ID');
    expect(names).toContain('aara_BLOB_READ_WRITE_TOKEN');
    expect(names).toContain('aara_BLOB_STORE_ID');
  });

  it('includes dynamic env names when present', () => {
    process.env.custom_BLOB_READ_WRITE_TOKEN = 'x';
    process.env.myapp_BLOB_STORE_ID = 'y';
    const names = getBlobEnvNames();
    expect(names).toContain('custom_BLOB_READ_WRITE_TOKEN');
    expect(names).toContain('myapp_BLOB_STORE_ID');
  });
});
