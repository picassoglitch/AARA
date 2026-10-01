import { promises as fs } from 'fs';
import path from 'path';
import { getDatabase, closeDatabase } from './db/index.js';
import { getStorage } from './storage/index.js';
import { hashPassword } from './server/utils.js';

async function seed() {
  console.log('seeding database...');

  const db = await getDatabase();
  const storage = getStorage();

  await fs.mkdir('uploads', { recursive: true });

  const placeholderWidth = 800;
  const placeholderHeight = 1000;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${placeholderWidth}" height="${placeholderHeight}">
    <rect width="100%" height="100%" fill="#0a0a0a"/>
    <rect x="100" y="150" width="600" height="700" fill="#111" stroke="#1a1a1a" stroke-width="2"/>
    <circle cx="400" cy="400" r="150" fill="none" stroke="#222" stroke-width="1"/>
    <circle cx="400" cy="400" r="100" fill="none" stroke="#1a1a1a" stroke-width="1"/>
    <line x1="250" y1="400" x2="550" y2="400" stroke="#1a1a1a" stroke-width="1"/>
    <line x1="400" y1="250" x2="400" y2="550" stroke="#1a1a1a" stroke-width="1"/>
    <text x="400" y="750" fill="#333" font-family="serif" font-size="14" text-anchor="middle">nepantla</text>
  </svg>`;

  const imageBuffer = Buffer.from(svg);
  const uploaded = await storage.upload(imageBuffer, 'seed-artwork.svg', 'image/svg+xml');

  const artwork = await db.createArtwork({
    filename: uploaded.key,
    date: '2026.10.01',
    title: 'untitled (ixiptla)',
  });

  await db.setCurrentArtwork(artwork.id);
  console.log('created artwork:', artwork.date, '-', artwork.title);

  const campaign = await db.createCampaign({
    label: 'instagram post oct 1',
    source_url: 'https://instagram.com/p/example',
    short_code: 'ig0110',
  });
  console.log('created campaign:', campaign.label, '-> /c/' + campaign.short_code);

  const entries = [
    { contact: 'collector1@example.com', display_name: null, engagement: { likes: 5, shares: 2, tags: 1 }, whitelisted: true },
    { contact: 'collector2@example.com', display_name: 'anon', engagement: { likes: 3, shares: 1, tags: 0 }, whitelisted: true },
    { contact: 'collector3@example.com', display_name: null, engagement: { likes: 10, shares: 5, tags: 3 }, whitelisted: false },
    { contact: 'collector4@example.com', display_name: 'shadow', engagement: { likes: 0, shares: 0, tags: 0 }, whitelisted: false },
    { contact: 'collector5@example.com', display_name: null, engagement: { likes: 2, shares: 0, tags: 0 }, whitelisted: false },
  ];

  for (const entry of entries) {
    const token = `test-token-${Math.random().toString(36).slice(2)}`;
    const created = await db.createWaitlistEntry({
      token,
      contact: entry.contact,
      display_name: entry.display_name,
      campaign_id: campaign.id,
      is_whitelisted: entry.whitelisted,
    });
    
    await db.updateWaitlistEntry(created.id, {
      engagement_likes: entry.engagement.likes,
      engagement_shares: entry.engagement.shares,
      engagement_tags: entry.engagement.tags,
    });
  }
  console.log('created', entries.length, 'waitlist entries');

  const adminPass = process.env.ADMIN_PASSWORD || 'ara-dev-password';
  const hash = hashPassword(adminPass);
  console.log('\nadmin password hash (add to .env as ADMIN_PASSWORD_HASH):');
  console.log(hash);

  await closeDatabase();
  console.log('\nseeding complete.');
}

seed().catch(console.error);
