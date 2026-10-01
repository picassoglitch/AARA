import pg from 'pg';
import type { Database } from './interface.js';
import type {
  Artwork,
  WaitlistEntry,
  WaitlistEntryWithPosition,
  Campaign,
  CampaignClick,
  AdminSession,
} from '../types.js';

const { Pool } = pg;

export class PostgresDatabase implements Database {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS artworks (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        is_current BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        label TEXT NOT NULL,
        source_url TEXT,
        short_code TEXT UNIQUE NOT NULL,
        click_count INTEGER DEFAULT 0,
        unique_clicks INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS campaign_clicks (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
        visitor_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(campaign_id, visitor_hash)
      );

      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        contact TEXT NOT NULL,
        display_name TEXT,
        engagement_likes INTEGER DEFAULT 0,
        engagement_shares INTEGER DEFAULT 0,
        engagement_tags INTEGER DEFAULT 0,
        campaign_id INTEGER REFERENCES campaigns(id),
        is_whitelisted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_sessions (
        id TEXT PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS login_attempts (
        id SERIAL PRIMARY KEY,
        ip_hash TEXT NOT NULL,
        attempted_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_waitlist_token ON waitlist(token);
      CREATE INDEX IF NOT EXISTS idx_waitlist_contact ON waitlist(contact);
      CREATE INDEX IF NOT EXISTS idx_campaigns_short_code ON campaigns(short_code);
      CREATE INDEX IF NOT EXISTS idx_campaign_clicks_lookup ON campaign_clicks(campaign_id, visitor_hash);
      CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_hash, attempted_at);
    `);
  }

  private toArtwork(row: Record<string, unknown>): Artwork {
    return {
      id: row.id as number,
      filename: row.filename as string,
      date: row.date as string,
      title: row.title as string,
      is_current: row.is_current as boolean,
      created_at: (row.created_at as Date).toISOString(),
    };
  }

  private toWaitlistEntry(row: Record<string, unknown>): WaitlistEntry {
    return {
      id: row.id as number,
      token: row.token as string,
      contact: row.contact as string,
      display_name: row.display_name as string | null,
      engagement_likes: row.engagement_likes as number,
      engagement_shares: row.engagement_shares as number,
      engagement_tags: row.engagement_tags as number,
      campaign_id: row.campaign_id as number | null,
      is_whitelisted: row.is_whitelisted as boolean,
      created_at: (row.created_at as Date).toISOString(),
    };
  }

  private toCampaign(row: Record<string, unknown>): Campaign {
    return {
      id: row.id as number,
      label: row.label as string,
      source_url: row.source_url as string | null,
      short_code: row.short_code as string,
      click_count: row.click_count as number,
      unique_clicks: row.unique_clicks as number,
      created_at: (row.created_at as Date).toISOString(),
    };
  }

  async getArtwork(id: number): Promise<Artwork | null> {
    const { rows } = await this.pool.query('SELECT * FROM artworks WHERE id = $1', [id]);
    return rows[0] ? this.toArtwork(rows[0]) : null;
  }

  async getCurrentArtwork(): Promise<Artwork | null> {
    const { rows } = await this.pool.query('SELECT * FROM artworks WHERE is_current = TRUE');
    return rows[0] ? this.toArtwork(rows[0]) : null;
  }

  async createArtwork(data: { filename: string; date: string; title: string }): Promise<Artwork> {
    const { rows } = await this.pool.query(
      'INSERT INTO artworks (filename, date, title) VALUES ($1, $2, $3) RETURNING *',
      [data.filename, data.date, data.title]
    );
    return this.toArtwork(rows[0]);
  }

  async updateArtwork(id: number, data: Partial<Pick<Artwork, 'date' | 'title' | 'is_current'>>): Promise<Artwork | null> {
    const sets: string[] = [];
    const values: (string | boolean | number)[] = [];
    let idx = 1;

    if (data.date !== undefined) { sets.push(`date = $${idx++}`); values.push(data.date); }
    if (data.title !== undefined) { sets.push(`title = $${idx++}`); values.push(data.title); }
    if (data.is_current !== undefined) { sets.push(`is_current = $${idx++}`); values.push(data.is_current); }

    if (sets.length === 0) return this.getArtwork(id);

    values.push(id);
    const { rows } = await this.pool.query(
      `UPDATE artworks SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] ? this.toArtwork(rows[0]) : null;
  }

  async setCurrentArtwork(id: number): Promise<void> {
    await this.pool.query('UPDATE artworks SET is_current = FALSE');
    await this.pool.query('UPDATE artworks SET is_current = TRUE WHERE id = $1', [id]);
  }

  async listArtworks(): Promise<Artwork[]> {
    const { rows } = await this.pool.query('SELECT * FROM artworks ORDER BY created_at DESC');
    return rows.map(r => this.toArtwork(r));
  }

  async getWaitlistEntry(id: number): Promise<WaitlistEntry | null> {
    const { rows } = await this.pool.query('SELECT * FROM waitlist WHERE id = $1', [id]);
    return rows[0] ? this.toWaitlistEntry(rows[0]) : null;
  }

  async getWaitlistEntryByToken(token: string): Promise<WaitlistEntryWithPosition | null> {
    const { rows } = await this.pool.query('SELECT * FROM waitlist WHERE token = $1', [token]);
    if (!rows[0]) return null;

    const entry = this.toWaitlistEntry(rows[0]);
    const { rows: posRows } = await this.pool.query(`
      SELECT COUNT(*) + 1 as position FROM waitlist
      WHERE (is_whitelisted::int > $1 OR (is_whitelisted::int = $1 AND (
        (engagement_likes + engagement_shares + engagement_tags) > $2 OR
        ((engagement_likes + engagement_shares + engagement_tags) = $2 AND created_at < $3)
      )))
    `, [
      entry.is_whitelisted ? 1 : 0,
      entry.engagement_likes + entry.engagement_shares + entry.engagement_tags,
      entry.created_at
    ]);

    return { ...entry, position: parseInt(posRows[0].position, 10) };
  }

  async createWaitlistEntry(data: {
    token: string;
    contact: string;
    display_name?: string | null;
    campaign_id?: number | null;
    is_whitelisted?: boolean;
  }): Promise<WaitlistEntry> {
    const { rows } = await this.pool.query(
      `INSERT INTO waitlist (token, contact, display_name, campaign_id, is_whitelisted)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.token, data.contact, data.display_name ?? null, data.campaign_id ?? null, data.is_whitelisted ?? false]
    );
    return this.toWaitlistEntry(rows[0]);
  }

  async updateWaitlistEntry(id: number, data: Partial<Pick<WaitlistEntry,
    'contact' | 'display_name' | 'engagement_likes' | 'engagement_shares' |
    'engagement_tags' | 'is_whitelisted'
  >>): Promise<WaitlistEntry | null> {
    const sets: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let idx = 1;

    if (data.contact !== undefined) { sets.push(`contact = $${idx++}`); values.push(data.contact); }
    if (data.display_name !== undefined) { sets.push(`display_name = $${idx++}`); values.push(data.display_name); }
    if (data.engagement_likes !== undefined) { sets.push(`engagement_likes = $${idx++}`); values.push(data.engagement_likes); }
    if (data.engagement_shares !== undefined) { sets.push(`engagement_shares = $${idx++}`); values.push(data.engagement_shares); }
    if (data.engagement_tags !== undefined) { sets.push(`engagement_tags = $${idx++}`); values.push(data.engagement_tags); }
    if (data.is_whitelisted !== undefined) { sets.push(`is_whitelisted = $${idx++}`); values.push(data.is_whitelisted); }

    if (sets.length === 0) return this.getWaitlistEntry(id);

    values.push(id);
    const { rows } = await this.pool.query(
      `UPDATE waitlist SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] ? this.toWaitlistEntry(rows[0]) : null;
  }

  async listWaitlistEntries(): Promise<WaitlistEntryWithPosition[]> {
    const { rows } = await this.pool.query(`
      SELECT *,
        ROW_NUMBER() OVER (
          ORDER BY is_whitelisted DESC,
          (engagement_likes + engagement_shares + engagement_tags) DESC,
          created_at ASC
        ) as position
      FROM waitlist
      ORDER BY position ASC
    `);
    return rows.map(r => ({ ...this.toWaitlistEntry(r), position: parseInt(r.position, 10) }));
  }

  async getWaitlistCount(): Promise<number> {
    const { rows } = await this.pool.query('SELECT COUNT(*) as count FROM waitlist');
    return parseInt(rows[0].count, 10);
  }

  async checkContactExists(contact: string): Promise<boolean> {
    const { rows } = await this.pool.query('SELECT 1 FROM waitlist WHERE contact = $1', [contact]);
    return rows.length > 0;
  }

  async getCampaign(id: number): Promise<Campaign | null> {
    const { rows } = await this.pool.query('SELECT * FROM campaigns WHERE id = $1', [id]);
    return rows[0] ? this.toCampaign(rows[0]) : null;
  }

  async getCampaignByCode(code: string): Promise<Campaign | null> {
    const { rows } = await this.pool.query('SELECT * FROM campaigns WHERE short_code = $1', [code]);
    return rows[0] ? this.toCampaign(rows[0]) : null;
  }

  async createCampaign(data: { label: string; source_url?: string | null; short_code: string }): Promise<Campaign> {
    const { rows } = await this.pool.query(
      'INSERT INTO campaigns (label, source_url, short_code) VALUES ($1, $2, $3) RETURNING *',
      [data.label, data.source_url ?? null, data.short_code]
    );
    return this.toCampaign(rows[0]);
  }

  async updateCampaign(id: number, data: Partial<Pick<Campaign, 'label' | 'source_url'>>): Promise<Campaign | null> {
    const sets: string[] = [];
    const values: (string | null | number)[] = [];
    let idx = 1;

    if (data.label !== undefined) { sets.push(`label = $${idx++}`); values.push(data.label); }
    if (data.source_url !== undefined) { sets.push(`source_url = $${idx++}`); values.push(data.source_url); }

    if (sets.length === 0) return this.getCampaign(id);

    values.push(id);
    const { rows } = await this.pool.query(
      `UPDATE campaigns SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] ? this.toCampaign(rows[0]) : null;
  }

  async incrementCampaignClicks(id: number, isUnique: boolean): Promise<void> {
    if (isUnique) {
      await this.pool.query(
        'UPDATE campaigns SET click_count = click_count + 1, unique_clicks = unique_clicks + 1 WHERE id = $1',
        [id]
      );
    } else {
      await this.pool.query('UPDATE campaigns SET click_count = click_count + 1 WHERE id = $1', [id]);
    }
  }

  async listCampaigns(): Promise<Campaign[]> {
    const { rows } = await this.pool.query('SELECT * FROM campaigns ORDER BY created_at DESC');
    return rows.map(r => this.toCampaign(r));
  }

  async recordCampaignClick(data: { campaign_id: number; visitor_hash: string }): Promise<CampaignClick> {
    const { rows } = await this.pool.query(
      'INSERT INTO campaign_clicks (campaign_id, visitor_hash) VALUES ($1, $2) RETURNING *',
      [data.campaign_id, data.visitor_hash]
    );
    return {
      id: rows[0].id,
      campaign_id: rows[0].campaign_id,
      visitor_hash: rows[0].visitor_hash,
      created_at: (rows[0].created_at as Date).toISOString(),
    };
  }

  async getCampaignClick(campaign_id: number, visitor_hash: string): Promise<CampaignClick | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM campaign_clicks WHERE campaign_id = $1 AND visitor_hash = $2',
      [campaign_id, visitor_hash]
    );
    if (!rows[0]) return null;
    return {
      id: rows[0].id,
      campaign_id: rows[0].campaign_id,
      visitor_hash: rows[0].visitor_hash,
      created_at: (rows[0].created_at as Date).toISOString(),
    };
  }

  async getUniqueCampaignClickCount(campaign_id: number): Promise<number> {
    const { rows } = await this.pool.query(
      'SELECT COUNT(*) as count FROM campaign_clicks WHERE campaign_id = $1',
      [campaign_id]
    );
    return parseInt(rows[0].count, 10);
  }

  async createSession(data: { id: string; expires_at: Date }): Promise<AdminSession> {
    const { rows } = await this.pool.query(
      'INSERT INTO admin_sessions (id, expires_at) VALUES ($1, $2) RETURNING *',
      [data.id, data.expires_at]
    );
    return {
      id: rows[0].id,
      expires_at: (rows[0].expires_at as Date).toISOString(),
      created_at: (rows[0].created_at as Date).toISOString(),
    };
  }

  async getSession(id: string): Promise<AdminSession | null> {
    const { rows } = await this.pool.query('SELECT * FROM admin_sessions WHERE id = $1', [id]);
    if (!rows[0]) return null;
    const session = {
      id: rows[0].id,
      expires_at: (rows[0].expires_at as Date).toISOString(),
      created_at: (rows[0].created_at as Date).toISOString(),
    };
    if (new Date(session.expires_at) < new Date()) {
      await this.deleteSession(id);
      return null;
    }
    return session;
  }

  async deleteSession(id: string): Promise<void> {
    await this.pool.query('DELETE FROM admin_sessions WHERE id = $1', [id]);
  }

  async cleanExpiredSessions(): Promise<void> {
    await this.pool.query('DELETE FROM admin_sessions WHERE expires_at < NOW()');
  }

  async recordLoginAttempt(ip_hash: string): Promise<void> {
    await this.pool.query('INSERT INTO login_attempts (ip_hash) VALUES ($1)', [ip_hash]);
  }

  async getRecentLoginAttempts(ip_hash: string, since: Date): Promise<number> {
    const { rows } = await this.pool.query(
      'SELECT COUNT(*) as count FROM login_attempts WHERE ip_hash = $1 AND attempted_at > $2',
      [ip_hash, since]
    );
    return parseInt(rows[0].count, 10);
  }

  async cleanOldLoginAttempts(before: Date): Promise<void> {
    await this.pool.query('DELETE FROM login_attempts WHERE attempted_at < $1', [before]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
