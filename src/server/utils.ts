import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  
  const candidate = createHash('sha256').update(salt + password).digest('hex');
  
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(candidate));
  } catch {
    return false;
  }
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip + (process.env.IP_SALT || 'ara-salt')).digest('hex').slice(0, 16);
}

export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

export function generateShortCode(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

export function sanitizeInput(input: string): string {
  return input.trim().slice(0, 500);
}

export function getClientIp(request: Request, headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         headers.get('x-real-ip') ||
         '127.0.0.1';
}
