import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveDatabaseUrl, getDatabaseEnvNames } from '../src/db/resolve-url.js';

describe('resolveDatabaseUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.aara_DATABASE_URL;
    delete process.env.aara_POSTGRES_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when no database env vars are set', () => {
    const result = resolveDatabaseUrl();
    expect(result.url).toBeNull();
    expect(result.source).toBeNull();
  });

  it('resolves DATABASE_URL first', () => {
    process.env.DATABASE_URL = 'postgres://a';
    process.env.POSTGRES_URL = 'postgres://b';
    const result = resolveDatabaseUrl();
    expect(result.url).toBe('postgres://a');
    expect(result.source).toBe('DATABASE_URL');
  });

  it('resolves POSTGRES_URL when DATABASE_URL is not set', () => {
    process.env.POSTGRES_URL = 'postgres://b';
    const result = resolveDatabaseUrl();
    expect(result.url).toBe('postgres://b');
    expect(result.source).toBe('POSTGRES_URL');
  });

  it('resolves aara_DATABASE_URL (prefixed)', () => {
    process.env.aara_DATABASE_URL = 'postgres://neon-pooled';
    const result = resolveDatabaseUrl();
    expect(result.url).toBe('postgres://neon-pooled');
    expect(result.source).toBe('aara_DATABASE_URL');
  });

  it('resolves aara_POSTGRES_URL (prefixed)', () => {
    process.env.aara_POSTGRES_URL = 'postgres://neon-postgres';
    const result = resolveDatabaseUrl();
    expect(result.url).toBe('postgres://neon-postgres');
    expect(result.source).toBe('aara_POSTGRES_URL');
  });

  it('resolves custom prefixed *_DATABASE_URL', () => {
    process.env.myapp_DATABASE_URL = 'postgres://custom';
    const result = resolveDatabaseUrl();
    expect(result.url).toBe('postgres://custom');
    expect(result.source).toBe('myapp_DATABASE_URL');
    expect(result.checkedNames).toContain('myapp_DATABASE_URL');
  });

  it('resolves custom prefixed *_POSTGRES_URL', () => {
    process.env.myapp_POSTGRES_URL = 'postgres://custom-pg';
    const result = resolveDatabaseUrl();
    expect(result.url).toBe('postgres://custom-pg');
    expect(result.source).toBe('myapp_POSTGRES_URL');
  });

  it('ignores *_UNPOOLED suffix', () => {
    process.env.aara_DATABASE_URL_UNPOOLED = 'postgres://unpooled';
    const result = resolveDatabaseUrl();
    expect(result.url).toBeNull();
    expect(result.checkedNames).not.toContain('aara_DATABASE_URL_UNPOOLED');
  });

  it('prefers known names over dynamic matches', () => {
    process.env.custom_DATABASE_URL = 'postgres://custom';
    process.env.aara_DATABASE_URL = 'postgres://neon';
    const result = resolveDatabaseUrl();
    expect(result.url).toBe('postgres://neon');
    expect(result.source).toBe('aara_DATABASE_URL');
  });

  it('includes all checked names in result', () => {
    const result = resolveDatabaseUrl();
    expect(result.checkedNames).toContain('DATABASE_URL');
    expect(result.checkedNames).toContain('POSTGRES_URL');
    expect(result.checkedNames).toContain('aara_DATABASE_URL');
    expect(result.checkedNames).toContain('aara_POSTGRES_URL');
  });
});

describe('getDatabaseEnvNames', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('includes known env names', () => {
    const names = getDatabaseEnvNames();
    expect(names).toContain('DATABASE_URL');
    expect(names).toContain('POSTGRES_URL');
    expect(names).toContain('aara_DATABASE_URL');
    expect(names).toContain('aara_POSTGRES_URL');
  });

  it('includes dynamic env names when present', () => {
    process.env.custom_DATABASE_URL = 'x';
    process.env.myapp_POSTGRES_URL = 'y';
    const names = getDatabaseEnvNames();
    expect(names).toContain('custom_DATABASE_URL');
    expect(names).toContain('myapp_POSTGRES_URL');
  });
});
