import { Context, Next } from 'hono';

export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next();
    
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
    c.res.headers.set('X-Frame-Options', 'DENY');
    c.res.headers.set('X-XSS-Protection', '1; mode=block');
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
    
    c.res.headers.set('Content-Security-Policy', csp);
  };
}

export function noIndex() {
  return async (c: Context, next: Next) => {
    await next();
    c.res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  };
}
