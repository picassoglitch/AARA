import Database from 'better-sqlite3';
import type { Database as DatabaseInterface } from './interface.js';
import type {
  Artwork,
  WaitlistEntry,
  WaitlistEntryWithPosition,
  Campaign,
  CampaignClick,
  AdminSession,
} from '../types.js';

export class SQLiteDatabase implements DatabaseInterface {
  private db: Database.Database;

  constructor(path: string = 'ara.db') {
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
  }

  async init(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS artworks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        is_current INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        source_url TEXT,
        short_code TEXT UNIQUE NOT NULL,
        click_count INTEGER DEFAULT 0,
        unique_clicks INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS campaign_clicks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
        visitor_hash TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(campaign_id, visitor_hash)
      );

      CREATE TABLE IF NOT EXISTS waitlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        contact TEXT NOT NULL,
        display_name TEXT,
        engagement_likes INTEGER DEFAULT 0,
        engagement_shares INTEGER DEFAULT 0,
        engagement_tags INTEGER DEFAULT 0,
        campaign_id INTEGER REFERENCES campaigns(id),
        is_whitelisted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS admin_sessions (
        id TEXT PRIMARY KEY,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_hash TEXT NOT NULL,
        attempted_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_waitlist_token ON waitlist(token);
      CREATE INDEX IF NOT EXISTS idx_waitlist_contact ON waitlist(contact);
      CREATE INDEX IF NOT EXISTS idx_campaigns_short_code ON campaigns(short_code);
      CREATE INDEX IF NOT EXISTS idx_campaign_clicks_lookup ON campaign_clicks(campaign_id, visitor_hash);
      CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_hash, attempted_at);
    `);
  }

  async getArtwork(id: number): Promise<Artwork | null> {
    const row = this.db.prepare('SELECT * FROM artworks WHERE id = ?').get(id) as Artwork | undefined;
    return row ? { ...row, is_current: Boolean(row.is_current) } : null;
  }

  async getCurrentArtwork(): Promise<Artwork | null> {
    const row = this.db.prepare('SELECT * FROM artworks WHERE is_current = 1').get() as Artwork | undefined;
    return row ? { ...row, is_current: true } : null;
  }

  async createArtwork(data: { filename: string; date: string; title: string }): Promise<Artwork> {
    const result = this.db.prepare(
      'INSERT INTO artworks (filename, date, title, is_current) VALUES (?, ?, ?, 0)'
    ).run(data.filename, data.date, data.title);
    return (await this.getArtwork(result.lastInsertRowid as number))!;
  }

  async updateArtwork(id: number, data: Partial<Pick<Artwork, 'date' | 'title' | 'is_current'>>): Promise<Artwork | null> {
    const sets: string[] = [];
    const values: (string | number)[] = [];
    
    if (data.date !== undefined) { sets.push('date = ?'); values.push(data.date); }
    if (data.title !== undefined) { sets.push('title = ?'); values.push(data.title); }
    if (data.is_current !== undefined) { sets.push('is_current = ?'); values.push(data.is_current ? 1 : 0); }
    
    if (sets.length === 0) return this.getArtwork(id);
    
    values.push(id);
    this.db.prepare(`UPDATE artworks SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.getArtwork(id);
  }

  async setCurrentArtwork(id: number): Promise<void> {
    this.db.transaction(() => {
      this.db.prepare('UPDATE artworks SET is_current = 0').run();
      this.db.prepare('UPDATE artworks SET is_current = 1 WHERE id = ?').run(id);
    })();
  }

  async listArtworks(): Promise<Artwork[]> {
    const rows = this.db.prepare('SELECT * FROM artworks ORDER BY created_at DESC').all() as Artwork[];
    return rows.map(r => ({ ...r, is_current: Boolean(r.is_current) }));
  }

  async getWaitlistEntry(id: number): Promise<WaitlistEntry | null> {
    const row = this.db.prepare('SELECT * FROM waitlist WHERE id = ?').get(id) as WaitlistEntry | undefined;
    return row ? { ...row, is_whitelisted: Boolean(row.is_whitelisted) } : null;
  }

  async getWaitlistEntryByToken(token: string): Promise<WaitlistEntryWithPosition | null> {
    const entry = this.db.prepare('SELECT * FROM waitlist WHERE token = ?').get(token) as WaitlistEntry | undefined;
    if (!entry) return null;

    const position = this.db.prepare(`
      SELECT COUNT(*) + 1 as position FROM waitlist 
      WHERE (is_whitelisted > ? OR (is_whitelisted = ? AND (
        (engagement_likes + engagement_shares + engagement_tags) > (? + ? + ?) OR
        ((engagement_likes + engagement_shares + engagement_tags) = (? + ? + ?) AND created_at < ?)
      )))
    `).get(
      entry.is_whitelisted ? 1 : 0, entry.is_whitelisted ? 1 : 0,
      entry.engagement_likes, entry.engagement_shares, entry.engagement_tags,
      entry.engagement_likes, entry.engagement_shares, entry.engagement_tags,
      entry.created_at
    ) as { position: number };

    return { ...entry, is_whitelisted: Boolean(entry.is_whitelisted), position: position.position };
  }

  async createWaitlistEntry(data: {
    token: string;
    contact: string;
    display_name?: string | null;
    campaign_id?: number | null;
    is_whitelisted?: boolean;
  }): Promise<WaitlistEntry> {
    const result = this.db.prepare(`
      INSERT INTO waitlist (token, contact, display_name, campaign_id, is_whitelisted)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      data.token,
      data.contact,
      data.display_name ?? null,
      data.campaign_id ?? null,
      data.is_whitelisted ? 1 : 0
    );
    return (await this.getWaitlistEntry(result.lastInsertRowid as number))!;
  }

  async updateWaitlistEntry(id: number, data: Partial<Pick<WaitlistEntry,
    'contact' | 'display_name' | 'engagement_likes' | 'engagement_shares' |
    'engagement_tags' | 'is_whitelisted'
  >>): Promise<WaitlistEntry | null> {
    const sets: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.contact !== undefined) { sets.push('contact = ?'); values.push(data.contact); }
    if (data.display_name !== undefined) { sets.push('display_name = ?'); values.push(data.display_name); }
    if (data.engagement_likes !== undefined) { sets.push('engagement_likes = ?'); values.push(data.engagement_likes); }
    if (data.engagement_shares !== undefined) { sets.push('engagement_shares = ?'); values.push(data.engagement_shares); }
    if (data.engagement_tags !== undefined) { sets.push('engagement_tags = ?'); values.push(data.engagement_tags); }
    if (data.is_whitelisted !== undefined) { sets.push('is_whitelisted = ?'); values.push(data.is_whitelisted ? 1 : 0); }

    if (sets.length === 0) return this.getWaitlistEntry(id);

    values.push(id);
    this.db.prepare(`UPDATE waitlist SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.getWaitlistEntry(id);
  }

  async listWaitlistEntries(): Promise<WaitlistEntryWithPosition[]> {
    const rows = this.db.prepare(`
      SELECT *, 
        ROW_NUMBER() OVER (
          ORDER BY is_whitelisted DESC, 
          (engagement_likes + engagement_shares + engagement_tags) DESC, 
          created_at ASC
        ) as position
      FROM waitlist
      ORDER BY position ASC
    `).all() as (WaitlistEntry & { position: number })[];
    
    return rows.map(r => ({ ...r, is_whitelisted: Boolean(r.is_whitelisted) }));
  }

  async getWaitlistCount(): Promise<number> {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM waitlist').get() as { count: number };
    return row.count;
  }

  async checkContactExists(contact: string): Promise<boolean> {
    const row = this.db.prepare('SELECT 1 FROM waitlist WHERE contact = ?').get(contact);
    return !!row;
  }

  async getCampaign(id: number): Promise<Campaign | null> {
    return this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Campaign | undefined ?? null;
  }

  async getCampaignByCode(code: string): Promise<Campaign | null> {
    return this.db.prepare('SELECT * FROM campaigns WHERE short_code = ?').get(code) as Campaign | undefined ?? null;
  }

  async createCampaign(data: { label: string; source_url?: string | null; short_code: string }): Promise<Campaign> {
    const result = this.db.prepare(
      'INSERT INTO campaigns (label, source_url, short_code) VALUES (?, ?, ?)'
    ).run(data.label, data.source_url ?? null, data.short_code);
    return (await this.getCampaign(result.lastInsertRowid as number))!;
  }

  async updateCampaign(id: number, data: Partial<Pick<Campaign, 'label' | 'source_url'>>): Promise<Campaign | null> {
    const sets: string[] = [];
    const values: (string | null)[] = [];

    if (data.label !== undefined) { sets.push('label = ?'); values.push(data.label); }
    if (data.source_url !== undefined) { sets.push('source_url = ?'); values.push(data.source_url); }

    if (sets.length === 0) return this.getCampaign(id);

    values.push(id as unknown as string);
    this.db.prepare(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.getCampaign(id);
  }

  async incrementCampaignClicks(id: number, isUnique: boolean): Promise<void> {
    if (isUnique) {
      this.db.prepare('UPDATE campaigns SET click_count = click_count + 1, unique_clicks = unique_clicks + 1 WHERE id = ?').run(id);
    } else {
      this.db.prepare('UPDATE campaigns SET click_count = click_count + 1 WHERE id = ?').run(id);
    }
  }

  async listCampaigns(): Promise<Campaign[]> {
    return this.db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all() as Campaign[];
  }

  async recordCampaignClick(data: { campaign_id: number; visitor_hash: string }): Promise<CampaignClick> {
    const result = this.db.prepare(
      'INSERT INTO campaign_clicks (campaign_id, visitor_hash) VALUES (?, ?)'
    ).run(data.campaign_id, data.visitor_hash);
    return this.db.prepare('SELECT * FROM campaign_clicks WHERE id = ?').get(result.lastInsertRowid) as CampaignClick;
  }

  async getCampaignClick(campaign_id: number, visitor_hash: string): Promise<CampaignClick | null> {
    return this.db.prepare(
      'SELECT * FROM campaign_clicks WHERE campaign_id = ? AND visitor_hash = ?'
    ).get(campaign_id, visitor_hash) as CampaignClick | undefined ?? null;
  }

  async getUniqueCampaignClickCount(campaign_id: number): Promise<number> {
    const row = this.db.prepare(
      'SELECT COUNT(*) as count FROM campaign_clicks WHERE campaign_id = ?'
    ).get(campaign_id) as { count: number };
    return row.count;
  }

  async createSession(data: { id: string; expires_at: Date }): Promise<AdminSession> {
    this.db.prepare(
      'INSERT INTO admin_sessions (id, expires_at) VALUES (?, ?)'
    ).run(data.id, data.expires_at.toISOString());
    return this.db.prepare('SELECT * FROM admin_sessions WHERE id = ?').get(data.id) as AdminSession;
  }

  async getSession(id: string): Promise<AdminSession | null> {
    const session = this.db.prepare('SELECT * FROM admin_sessions WHERE id = ?').get(id) as AdminSession | undefined;
    if (!session) return null;
    if (new Date(session.expires_at) < new Date()) {
      await this.deleteSession(id);
      return null;
    }
    return session;
  }

  async deleteSession(id: string): Promise<void> {
    this.db.prepare('DELETE FROM admin_sessions WHERE id = ?').run(id);
  }

  async cleanExpiredSessions(): Promise<void> {
    this.db.prepare("DELETE FROM admin_sessions WHERE expires_at < datetime('now')").run();
  }

  async recordLoginAttempt(ip_hash: string): Promise<void> {
    this.db.prepare('INSERT INTO login_attempts (ip_hash) VALUES (?)').run(ip_hash);
  }

  async getRecentLoginAttempts(ip_hash: string, since: Date): Promise<number> {
    const sinceStr = since.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
    const row = this.db.prepare(
      'SELECT COUNT(*) as count FROM login_attempts WHERE ip_hash = ? AND attempted_at > ?'
    ).get(ip_hash, sinceStr) as { count: number };
    return row.count;
  }

  async cleanOldLoginAttempts(before: Date): Promise<void> {
    const beforeStr = before.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
    this.db.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').run(beforeStr);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
