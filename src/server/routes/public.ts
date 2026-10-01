import { Hono } from 'hono';
import { getDatabase } from '../../db/index.js';
import { getStorage } from '../../storage/index.js';
import { generateToken, isValidEmail, sanitizeInput, getClientIp, hashIp } from '../utils.js';
import { rateLimit } from '../middleware/rateLimit.js';

const FIRST_N_WHITELIST = 10;

export const publicRoutes = new Hono();

publicRoutes.get('/api/artwork/current', async (c) => {
  const db = await getDatabase();
  const artwork = await db.getCurrentArtwork();
  
  if (!artwork) {
    return c.json({ artwork: null });
  }
  
  const storage = getStorage();
  const imageUrl = await storage.getUrl(artwork.filename);
  
  return c.json({
    artwork: {
      date: artwork.date,
      title: artwork.title,
      imageUrl,
    },
  });
});

publicRoutes.post(
  '/api/waitlist',
  rateLimit({ windowMs: 60 * 1000, max: 5, keyPrefix: 'waitlist' }),
  async (c) => {
    const body = await c.req.parseBody();
    
    const honeypot = body['website'] as string | undefined;
    if (honeypot) {
      return c.json({ error: 'invalid request.' }, 400);
    }
    
    const contact = sanitizeInput((body['contact'] as string) || '');
    const displayName = body['display_name'] ? sanitizeInput(body['display_name'] as string) : null;
    const campaignCode = body['ref'] as string | undefined;
    
    if (!contact) {
      return c.json({ error: 'contact required.' }, 400);
    }
    
    if (!isValidEmail(contact)) {
      return c.json({ error: 'invalid contact.' }, 400);
    }
    
    const db = await getDatabase();
    
    const exists = await db.checkContactExists(contact);
    if (exists) {
      return c.json({ error: 'already registered.' }, 400);
    }
    
    let campaignId: number | null = null;
    let isWhitelisted = false;
    
    if (campaignCode) {
      const campaign = await db.getCampaignByCode(campaignCode);
      if (campaign) {
        campaignId = campaign.id;
        
        const uniqueClicks = await db.getUniqueCampaignClickCount(campaign.id);
        if (uniqueClicks <= FIRST_N_WHITELIST) {
          const ip = getClientIp(c.req.raw, c.req.raw.headers);
          const visitorHash = hashIp(ip);
          const existingClick = await db.getCampaignClick(campaign.id, visitorHash);
          
          if (existingClick) {
            const clickOrder = await db.getUniqueCampaignClickCount(campaign.id);
            if (clickOrder <= FIRST_N_WHITELIST) {
              isWhitelisted = true;
            }
          }
        }
      }
    }
    
    const token = generateToken(32);
    const entry = await db.createWaitlistEntry({
      token,
      contact,
      display_name: displayName,
      campaign_id: campaignId,
      is_whitelisted: isWhitelisted,
    });
    
    const entryWithPosition = await db.getWaitlistEntryByToken(token);
    
    return c.json({
      token,
      position: entryWithPosition?.position || entry.id,
    });
  }
);

publicRoutes.get('/api/waitlist/position', async (c) => {
  const token = c.req.query('token');
  
  if (!token) {
    return c.json({ error: 'token required.' }, 400);
  }
  
  const db = await getDatabase();
  const entry = await db.getWaitlistEntryByToken(token);
  
  if (!entry) {
    return c.json({ error: 'not found.' }, 404);
  }
  
  return c.json({
    position: entry.position,
  });
});

publicRoutes.get('/api/campaign/:code', async (c) => {
  const code = c.req.param('code');
  
  const db = await getDatabase();
  const campaign = await db.getCampaignByCode(code);
  
  if (!campaign) {
    return c.json({ valid: false });
  }
  
  return c.json({ valid: true });
});

publicRoutes.post(
  '/api/campaign/:code/click',
  rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: 'campaign-click' }),
  async (c) => {
    const code = c.req.param('code');
    
    const db = await getDatabase();
    const campaign = await db.getCampaignByCode(code);
    
    if (!campaign) {
      return c.json({ error: 'not found.' }, 404);
    }
    
    const ip = getClientIp(c.req.raw, c.req.raw.headers);
    const visitorHash = hashIp(ip);
    
    const existingClick = await db.getCampaignClick(campaign.id, visitorHash);
    const isUnique = !existingClick;
    
    if (isUnique) {
      await db.recordCampaignClick({ campaign_id: campaign.id, visitor_hash: visitorHash });
    }
    
    await db.incrementCampaignClicks(campaign.id, isUnique);
    
    return c.json({ recorded: true });
  }
);
