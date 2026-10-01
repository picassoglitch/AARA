export interface Artwork {
  id: number;
  filename: string;
  date: string;
  title: string;
  is_current: boolean;
  created_at: string;
}

export interface WaitlistEntry {
  id: number;
  token: string;
  contact: string;
  display_name: string | null;
  engagement_likes: number;
  engagement_shares: number;
  engagement_tags: number;
  campaign_id: number | null;
  is_whitelisted: boolean;
  created_at: string;
}

export interface Campaign {
  id: number;
  label: string;
  source_url: string | null;
  short_code: string;
  click_count: number;
  unique_clicks: number;
  created_at: string;
}

export interface CampaignClick {
  id: number;
  campaign_id: number;
  visitor_hash: string;
  created_at: string;
}

export interface AdminSession {
  id: string;
  expires_at: string;
  created_at: string;
}

export interface LoginAttempt {
  id: number;
  ip_hash: string;
  attempted_at: string;
}

export interface WaitlistEntryWithPosition extends WaitlistEntry {
  position: number;
}
