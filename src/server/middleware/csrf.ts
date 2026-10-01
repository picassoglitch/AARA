import { Context, Next } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { generateToken } from '../utils.js';

const CSRF_COOKIE = 'ara_csrf';
const CSRF_HEADER = 'x-csrf-token';

function setTokenCookie(c: Context, token: string): void {
  setCookie(c, CSRF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
}

export function ensureCsrfCookie() {
  return async (c: Context, next: Next) => {
    let token = getCookie(c, CSRF_COOKIE);
    if (!token) {
      token = generateToken(32);
      setTokenCookie(c, token);
    }
    c.set('csrfToken', token);
    await next();
  };
}

export function csrfProtection() {
  return async (c: Context, next: Next) => {
    let token = getCookie(c, CSRF_COOKIE);
    
    if (!token) {
      token = generateToken(32);
      setTokenCookie(c, token);
    }
    
    c.set('csrfToken', token);
    
    const method = c.req.method.toUpperCase();
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const headerToken = c.req.header(CSRF_HEADER);
      const bodyToken = (await c.req.parseBody().catch(() => ({})) as Record<string, string>)['_csrf'];
      const submittedToken = headerToken || bodyToken;
      
      if (!submittedToken || submittedToken !== token) {
        return c.json({ error: 'invalid token.' }, 403);
      }
    }
    
    await next();
  };
}

export function getCsrfToken(c: Context): string {
  return c.get('csrfToken') || '';
}
