import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { getDatabase } from '../../db/index.js';
import { getStorage } from '../../storage/index.js';
import { verifyPassword, generateToken, getClientIp, hashIp, generateShortCode } from '../utils.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { csrfProtection, getCsrfToken, ensureCsrfCookie } from '../middleware/csrf.js';
import { noIndex } from '../middleware/security.js';
import { getAdminHtml } from '../views/admin-html.js';

const SESSION_COOKIE = 'ara_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function getAdminPath(): string {
  return process.env.ADMIN_PATH || '_ara_admin_' + generateShortCode(12);
}

export function createAdminRoutes(): Hono {
  const adminPath = getAdminPath();
  const admin = new Hono();

  admin.use('*', noIndex());

  const requireAuth = async (c: any, next: () => Promise<void>) => {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (!sessionId) {
      return c.json({ error: 'not authenticated.' }, 401);
    }

    const db = await getDatabase();
    const session = await db.getSession(sessionId);
    if (!session) {
      deleteCookie(c, SESSION_COOKIE);
      return c.json({ error: 'session expired.' }, 401);
    }

    await next();
  };

  admin.get(`/${adminPath}`, ensureCsrfCookie(), async (c) => {
    const html = getAdminHtml(adminPath);
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    c.header('Pragma', 'no-cache');
    return c.html(html);
  });

  admin.get(`/${adminPath}/session`, ensureCsrfCookie(), async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (sessionId) {
      const db = await getDatabase();
      const session = await db.getSession(sessionId);
      if (session) {
        return c.json({ authenticated: true, csrfToken: getCsrfToken(c) });
      }
    }
    return c.json({ authenticated: false, csrfToken: getCsrfToken(c) });
  });

  admin.post(
    `/${adminPath}/login`,
    rateLimit({ windowMs: LOGIN_WINDOW_MS, max: MAX_LOGIN_ATTEMPTS, keyPrefix: 'admin-login' }),
    csrfProtection(),
    async (c) => {
      const body = await c.req.parseBody();
      const password = (body['password'] as string) || '';

      const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
      if (!adminPasswordHash) {
        return c.json({ error: 'admin not configured.' }, 500);
      }

      const ip = getClientIp(c.req.raw, c.req.raw.headers);
      const ipHash = hashIp(ip);
      const db = await getDatabase();

      const since = new Date(Date.now() - LOGIN_WINDOW_MS);
      const attempts = await db.getRecentLoginAttempts(ipHash, since);

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        return c.json({ error: 'too many attempts.' }, 429);
      }

      await db.recordLoginAttempt(ipHash);

      if (!verifyPassword(password, adminPasswordHash)) {
        return c.json({ error: 'invalid credentials.' }, 401);
      }

      const sessionId = generateToken(32);
      const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

      await db.createSession({ id: sessionId, expires_at: expiresAt });

      setCookie(c, SESSION_COOKIE, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        path: '/',
        maxAge: SESSION_DURATION_MS / 1000,
      });

      return c.json({ success: true, csrfToken: getCsrfToken(c) });
    }
  );

  admin.post(`/${adminPath}/logout`, requireAuth, async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (sessionId) {
      const db = await getDatabase();
      await db.deleteSession(sessionId);
    }
    deleteCookie(c, SESSION_COOKIE);
    return c.json({ success: true });
  });

  admin.get(`/${adminPath}/artworks`, requireAuth, async (c) => {
    const db = await getDatabase();
    const artworks = await db.listArtworks();
    const storage = getStorage();

    const artworksWithUrls = await Promise.all(
      artworks.map(async (a) => ({
        ...a,
        imageUrl: await storage.getUrl(a.filename),
      }))
    );

    return c.json({ artworks: artworksWithUrls });
  });

  admin.post(
    `/${adminPath}/artworks`,
    requireAuth,
    csrfProtection(),
    async (c) => {
      const body = await c.req.parseBody();
      const file = body['file'] as File | undefined;
      const date = (body['date'] as string) || '';
      const title = (body['title'] as string) || '';

      if (!file || !date || !title) {
        return c.json({ error: 'file, date, and title required.' }, 400);
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        return c.json({ error: 'invalid file type.' }, 400);
      }

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return c.json({ error: 'file too large.' }, 400);
      }

      const storage = getStorage();
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploaded = await storage.upload(buffer, file.name, file.type);

      const db = await getDatabase();
      const artwork = await db.createArtwork({
        filename: uploaded.key,
        date,
        title,
      });

      return c.json({
        artwork: {
          ...artwork,
          imageUrl: uploaded.url,
        },
      });
    }
  );

  admin.put(
    `/${adminPath}/artworks/:id`,
    requireAuth,
    csrfProtection(),
    async (c) => {
      const id = parseInt(c.req.param('id') || '0', 10);
      const body = await c.req.json();

      const db = await getDatabase();
      const artwork = await db.updateArtwork(id, body);

      if (!artwork) {
        return c.json({ error: 'not found.' }, 404);
      }

      return c.json({ artwork });
    }
  );

  admin.post(
    `/${adminPath}/artworks/:id/set-current`,
    requireAuth,
    csrfProtection(),
    async (c) => {
      const id = parseInt(c.req.param('id') || '0', 10);

      const db = await getDatabase();
      await db.setCurrentArtwork(id);

      return c.json({ success: true });
    }
  );

  admin.get(`/${adminPath}/waitlist`, requireAuth, async (c) => {
    const db = await getDatabase();
    const entries = await db.listWaitlistEntries();
    return c.json({ entries });
  });

  admin.put(
    `/${adminPath}/waitlist/:id`,
    requireAuth,
    csrfProtection(),
    async (c) => {
      const id = parseInt(c.req.param('id') || '0', 10);
      const body = await c.req.json();

      const db = await getDatabase();
      const entry = await db.updateWaitlistEntry(id, body);

      if (!entry) {
        return c.json({ error: 'not found.' }, 404);
      }

      return c.json({ entry });
    }
  );

  admin.get(`/${adminPath}/campaigns`, requireAuth, async (c) => {
    const db = await getDatabase();
    const campaigns = await db.listCampaigns();
    return c.json({ campaigns });
  });

  admin.post(
    `/${adminPath}/campaigns`,
    requireAuth,
    csrfProtection(),
    async (c) => {
      const body = await c.req.json();
      const label = (body.label as string) || '';
      const sourceUrl = body.source_url as string | undefined;

      if (!label) {
        return c.json({ error: 'label required.' }, 400);
      }

      const shortCode = generateShortCode(8);

      const db = await getDatabase();
      const campaign = await db.createCampaign({
        label,
        source_url: sourceUrl || null,
        short_code: shortCode,
      });

      return c.json({ campaign });
    }
  );

  admin.put(
    `/${adminPath}/campaigns/:id`,
    requireAuth,
    csrfProtection(),
    async (c) => {
      const id = parseInt(c.req.param('id') || '0', 10);
      const body = await c.req.json();

      const db = await getDatabase();
      const campaign = await db.updateCampaign(id, body);

      if (!campaign) {
        return c.json({ error: 'not found.' }, 404);
      }

      return c.json({ campaign });
    }
  );

  return admin;
}

export { getAdminPath };
