import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteDatabase } from '../src/db/sqlite.js';
import type { Database } from '../src/db/interface.js';
import { promises as fs } from 'fs';

describe('queue ordering', () => {
  let db: Database;
  const testDbPath = 'test-queue.db';

  beforeEach(async () => {
    try { await fs.unlink(testDbPath); } catch {}
    db = new SQLiteDatabase(testDbPath);
    await db.init();
  });

  afterEach(async () => {
    await db.close();
    try { await fs.unlink(testDbPath); } catch {}
  });

  it('orders whitelisted entries first', async () => {
    await db.createWaitlistEntry({ token: 'a', contact: 'a@test.com', is_whitelisted: false });
    await db.createWaitlistEntry({ token: 'b', contact: 'b@test.com', is_whitelisted: true });
    await db.createWaitlistEntry({ token: 'c', contact: 'c@test.com', is_whitelisted: false });

    const entries = await db.listWaitlistEntries();
    
    expect(entries[0].contact).toBe('b@test.com');
    expect(entries[0].position).toBe(1);
    expect(entries[0].is_whitelisted).toBe(true);
  });

  it('orders by engagement score within same whitelist status', async () => {
    const e1 = await db.createWaitlistEntry({ token: 'a', contact: 'a@test.com' });
    const e2 = await db.createWaitlistEntry({ token: 'b', contact: 'b@test.com' });
    const e3 = await db.createWaitlistEntry({ token: 'c', contact: 'c@test.com' });

    await db.updateWaitlistEntry(e1.id, { engagement_likes: 1, engagement_shares: 0, engagement_tags: 0 });
    await db.updateWaitlistEntry(e2.id, { engagement_likes: 5, engagement_shares: 3, engagement_tags: 2 });
    await db.updateWaitlistEntry(e3.id, { engagement_likes: 2, engagement_shares: 1, engagement_tags: 0 });

    const entries = await db.listWaitlistEntries();
    
    expect(entries[0].contact).toBe('b@test.com');
    expect(entries[1].contact).toBe('c@test.com');
    expect(entries[2].contact).toBe('a@test.com');
  });

  it('orders by creation time when engagement is equal', async () => {
    await db.createWaitlistEntry({ token: 'first', contact: 'first@test.com' });
    await new Promise(r => setTimeout(r, 10));
    await db.createWaitlistEntry({ token: 'second', contact: 'second@test.com' });
    await new Promise(r => setTimeout(r, 10));
    await db.createWaitlistEntry({ token: 'third', contact: 'third@test.com' });

    const entries = await db.listWaitlistEntries();
    
    expect(entries[0].contact).toBe('first@test.com');
    expect(entries[1].contact).toBe('second@test.com');
    expect(entries[2].contact).toBe('third@test.com');
  });

  it('returns correct position via token lookup', async () => {
    const e1 = await db.createWaitlistEntry({ token: 'token-a', contact: 'a@test.com' });
    const e2 = await db.createWaitlistEntry({ token: 'token-b', contact: 'b@test.com', is_whitelisted: true });
    const e3 = await db.createWaitlistEntry({ token: 'token-c', contact: 'c@test.com' });
    
    await db.updateWaitlistEntry(e1.id, { engagement_likes: 10 });
    await db.updateWaitlistEntry(e3.id, { engagement_likes: 5 });

    const posA = await db.getWaitlistEntryByToken('token-a');
    const posB = await db.getWaitlistEntryByToken('token-b');
    const posC = await db.getWaitlistEntryByToken('token-c');

    expect(posB?.position).toBe(1);
    expect(posA?.position).toBe(2);
    expect(posC?.position).toBe(3);
  });

  it('handles combined ordering correctly', async () => {
    const wl1 = await db.createWaitlistEntry({ token: 'wl1', contact: 'wl1@test.com', is_whitelisted: true });
    const wl2 = await db.createWaitlistEntry({ token: 'wl2', contact: 'wl2@test.com', is_whitelisted: true });
    const reg1 = await db.createWaitlistEntry({ token: 'reg1', contact: 'reg1@test.com' });
    const reg2 = await db.createWaitlistEntry({ token: 'reg2', contact: 'reg2@test.com' });
    
    await db.updateWaitlistEntry(wl1.id, { engagement_likes: 5 });
    await db.updateWaitlistEntry(wl2.id, { engagement_likes: 10 });
    await db.updateWaitlistEntry(reg1.id, { engagement_likes: 100 });
    await db.updateWaitlistEntry(reg2.id, { engagement_likes: 1 });

    const entries = await db.listWaitlistEntries();
    
    expect(entries[0].contact).toBe('wl2@test.com');
    expect(entries[1].contact).toBe('wl1@test.com');
    expect(entries[2].contact).toBe('reg1@test.com');
    expect(entries[3].contact).toBe('reg2@test.com');
  });
});
