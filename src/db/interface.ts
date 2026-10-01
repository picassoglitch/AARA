import type {
  Artwork,
  WaitlistEntry,
  WaitlistEntryWithPosition,
  Campaign,
  CampaignClick,
  AdminSession,
  LoginAttempt,
} from '../types.js';

export interface Database {
  init(): Promise<void>;

  getArtwork(id: number): Promise<Artwork | null>;
  getCurrentArtwork(): Promise<Artwork | null>;
  createArtwork(data: { filename: string; date: string; title: string }): Promise<Artwork>;
  updateArtwork(id: number, data: Partial<Pick<Artwork, 'date' | 'title' | 'is_current'>>): Promise<Artwork | null>;
  setCurrentArtwork(id: number): Promise<void>;
  listArtworks(): Promise<Artwork[]>;

  getWaitlistEntry(id: number): Promise<WaitlistEntry | null>;
  getWaitlistEntryByToken(token: string): Promise<WaitlistEntryWithPosition | null>;
  createWaitlistEntry(data: {
    token: string;
    contact: string;
    display_name?: string | null;
    campaign_id?: number | null;
    is_whitelisted?: boolean;
  }): Promise<WaitlistEntry>;
  updateWaitlistEntry(id: number, data: Partial<Pick<WaitlistEntry, 
    'contact' | 'display_name' | 'engagement_likes' | 'engagement_shares' | 
    'engagement_tags' | 'is_whitelisted'
  >>): Promise<WaitlistEntry | null>;
  listWaitlistEntries(): Promise<WaitlistEntryWithPosition[]>;
  getWaitlistCount(): Promise<number>;
  checkContactExists(contact: string): Promise<boolean>;

  getCampaign(id: number): Promise<Campaign | null>;
  getCampaignByCode(code: string): Promise<Campaign | null>;
  createCampaign(data: { label: string; source_url?: string | null; short_code: string }): Promise<Campaign>;
  updateCampaign(id: number, data: Partial<Pick<Campaign, 'label' | 'source_url'>>): Promise<Campaign | null>;
  incrementCampaignClicks(id: number, isUnique: boolean): Promise<void>;
  listCampaigns(): Promise<Campaign[]>;

  recordCampaignClick(data: { campaign_id: number; visitor_hash: string }): Promise<CampaignClick>;
  getCampaignClick(campaign_id: number, visitor_hash: string): Promise<CampaignClick | null>;
  getUniqueCampaignClickCount(campaign_id: number): Promise<number>;

  createSession(data: { id: string; expires_at: Date }): Promise<AdminSession>;
  getSession(id: string): Promise<AdminSession | null>;
  deleteSession(id: string): Promise<void>;
  cleanExpiredSessions(): Promise<void>;

  recordLoginAttempt(ip_hash: string): Promise<void>;
  getRecentLoginAttempts(ip_hash: string, since: Date): Promise<number>;
  cleanOldLoginAttempts(before: Date): Promise<void>;

  close(): Promise<void>;
}
