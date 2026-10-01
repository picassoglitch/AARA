import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteDatabase } from '../src/db/sqlite.js';
import type { Database } from '../src/db/interface.js';
import { promises as fs } from 'fs';

describe('first-10 whitelist mechanic', () => {
  let db: Database;
  const testDbPath = 'test-whitelist.db';

  beforeEach(async () => {
    try { await fs.unlink(testDbPath); } catch {}
    db = new SQLiteDatabase(testDbPath);
    await db.init();
  });

  afterEach(async () => {
    await db.close();
    try { await fs.unlink(testDbPath); } catch {}
  });

  it('tracks unique clicks per campaign', async () => {
    const campaign = await db.createCampaign({
      label: 'test campaign',
      short_code: 'test123',
    });

    await db.recordCampaignClick({ campaign_id: campaign.id, visitor_hash: 'visitor1' });
    await db.recordCampaignClick({ campaign_id: campaign.id, visitor_hash: 'visitor2' });
    await db.recordCampaignClick({ campaign_id: campaign.id, visitor_hash: 'visitor3' });

    const count = await db.getUniqueCampaignClickCount(campaign.id);
    expect(count).toBe(3);
  });

  it('detects returning visitors', async () => {
    const campaign = await db.createCampaign({
      label: 'test campaign',
      short_code: 'test456',
    });

    await db.recordCampaignClick({ campaign_id: campaign.id, visitor_hash: 'visitor1' });
    
    const firstClick = await db.getCampaignClick(campaign.id, 'visitor1');
    expect(firstClick).not.toBeNull();

    const newVisitor = await db.getCampaignClick(campaign.id, 'visitor2');
    expect(newVisitor).toBeNull();
  });

  it('prevents duplicate click records', async () => {
    const campaign = await db.createCampaign({
      label: 'test campaign',
      short_code: 'test789',
    });

    await db.recordCampaignClick({ campaign_id: campaign.id, visitor_hash: 'visitor1' });
    
    await expect(
      db.recordCampaignClick({ campaign_id: campaign.id, visitor_hash: 'visitor1' })
    ).rejects.toThrow();
  });

  it('increments click counts correctly', async () => {
    const campaign = await db.createCampaign({
      label: 'test campaign',
      short_code: 'testabc',
    });

    await db.incrementCampaignClicks(campaign.id, true);
    await db.incrementCampaignClicks(campaign.id, true);
    await db.incrementCampaignClicks(campaign.id, false);

    const updated = await db.getCampaign(campaign.id);
    expect(updated?.click_count).toBe(3);
    expect(updated?.unique_clicks).toBe(2);
  });

  it('can check if visitor qualifies for whitelist', async () => {
    const campaign = await db.createCampaign({
      label: 'test campaign',
      short_code: 'testdef',
    });

    for (let i = 1; i <= 10; i++) {
      await db.recordCampaignClick({ campaign_id: campaign.id, visitor_hash: `visitor${i}` });
    }

    const countAt10 = await db.getUniqueCampaignClickCount(campaign.id);
    expect(countAt10).toBe(10);

    await db.recordCampaignClick({ campaign_id: campaign.id, visitor_hash: 'visitor11' });
    const countAt11 = await db.getUniqueCampaignClickCount(campaign.id);
    expect(countAt11).toBe(11);
  });

  it('whitelist entries sorted before regular entries', async () => {
    await db.createWaitlistEntry({ 
      token: 'reg1', 
      contact: 'regular@test.com', 
      is_whitelisted: false 
    });

    await db.createWaitlistEntry({ 
      token: 'wl1', 
      contact: 'whitelist@test.com', 
      is_whitelisted: true 
    });

    const entries = await db.listWaitlistEntries();
    expect(entries[0].is_whitelisted).toBe(true);
    expect(entries[0].position).toBe(1);
    expect(entries[1].is_whitelisted).toBe(false);
    expect(entries[1].position).toBe(2);
  });
});
