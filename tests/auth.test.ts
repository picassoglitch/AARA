import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteDatabase } from '../src/db/sqlite.js';
import type { Database } from '../src/db/interface.js';
import { hashPassword, verifyPassword, generateToken } from '../src/server/utils.js';
import { promises as fs } from 'fs';

describe('admin authentication', () => {
  let db: Database;
  const testDbPath = 'test-auth.db';

  beforeEach(async () => {
    try { await fs.unlink(testDbPath); } catch {}
    db = new SQLiteDatabase(testDbPath);
    await db.init();
  });

  afterEach(async () => {
    await db.close();
    try { await fs.unlink(testDbPath); } catch {}
  });

  describe('password hashing', () => {
    it('hashes passwords with salt', () => {
      const hash1 = hashPassword('test123');
      const hash2 = hashPassword('test123');
      
      expect(hash1).not.toBe(hash2);
      expect(hash1).toContain(':');
    });

    it('verifies correct passwords', () => {
      const hash = hashPassword('secret');
      expect(verifyPassword('secret', hash)).toBe(true);
    });

    it('rejects incorrect passwords', () => {
      const hash = hashPassword('secret');
      expect(verifyPassword('wrong', hash)).toBe(false);
    });

    it('handles malformed hashes safely', () => {
      expect(verifyPassword('test', 'malformed')).toBe(false);
      expect(verifyPassword('test', '')).toBe(false);
    });
  });

  describe('session management', () => {
    it('creates sessions with expiry', async () => {
      const sessionId = generateToken(32);
      const expiresAt = new Date(Date.now() + 3600000);
      
      const session = await db.createSession({ id: sessionId, expires_at: expiresAt });
      
      expect(session.id).toBe(sessionId);
      expect(new Date(session.expires_at).getTime()).toBe(expiresAt.getTime());
    });

    it('retrieves valid sessions', async () => {
      const sessionId = generateToken(32);
      const expiresAt = new Date(Date.now() + 3600000);
      
      await db.createSession({ id: sessionId, expires_at: expiresAt });
      const retrieved = await db.getSession(sessionId);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(sessionId);
    });

    it('returns null for expired sessions', async () => {
      const sessionId = generateToken(32);
      const expiresAt = new Date(Date.now() - 1000);
      
      await db.createSession({ id: sessionId, expires_at: expiresAt });
      const retrieved = await db.getSession(sessionId);
      
      expect(retrieved).toBeNull();
    });

    it('returns null for non-existent sessions', async () => {
      const retrieved = await db.getSession('nonexistent');
      expect(retrieved).toBeNull();
    });

    it('deletes sessions', async () => {
      const sessionId = generateToken(32);
      const expiresAt = new Date(Date.now() + 3600000);
      
      await db.createSession({ id: sessionId, expires_at: expiresAt });
      await db.deleteSession(sessionId);
      
      const retrieved = await db.getSession(sessionId);
      expect(retrieved).toBeNull();
    });

    it('cleans expired sessions', async () => {
      const validId = generateToken(32);
      const expiredId = generateToken(32);
      
      await db.createSession({ id: validId, expires_at: new Date(Date.now() + 3600000) });
      await db.createSession({ id: expiredId, expires_at: new Date(Date.now() - 1000) });
      
      await db.cleanExpiredSessions();
      
      expect(await db.getSession(validId)).not.toBeNull();
    });
  });

  describe('login rate limiting', () => {
    it('records login attempts', async () => {
      const ipHash = 'testhash123';
      
      const before = new Date(Date.now() - 1000);
      
      await db.recordLoginAttempt(ipHash);
      await db.recordLoginAttempt(ipHash);
      await db.recordLoginAttempt(ipHash);
      
      const count = await db.getRecentLoginAttempts(ipHash, before);
      
      expect(count).toBe(3);
    });

    it('counts only recent attempts', async () => {
      const ipHash = 'testhash456';
      
      await db.recordLoginAttempt(ipHash);
      
      const future = new Date(Date.now() + 60000);
      const count = await db.getRecentLoginAttempts(ipHash, future);
      
      expect(count).toBe(0);
    });

    it('cleans old attempts', async () => {
      const ipHash = 'testhash789';
      
      await db.recordLoginAttempt(ipHash);
      
      const future = new Date(Date.now() + 60000);
      await db.cleanOldLoginAttempts(future);
      
      const since = new Date(Date.now() - 60000);
      const count = await db.getRecentLoginAttempts(ipHash, since);
      
      expect(count).toBe(0);
    });
  });
});

describe('token generation', () => {
  it('generates tokens of specified length', () => {
    const token = generateToken(32);
    expect(token.length).toBeGreaterThan(0);
  });

  it('generates unique tokens', () => {
    const tokens = new Set();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateToken(32));
    }
    expect(tokens.size).toBe(100);
  });
});
