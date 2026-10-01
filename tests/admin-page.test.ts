import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';

const TEST_ADMIN_PATH = '_test_admin_xyz';
const TEST_PASSWORD_HASH = '5e884898da28047d9164d1aba:a9318b74000000102030405060708090a0b0c0d0e0f';

describe('admin page routes', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ADMIN_PATH: TEST_ADMIN_PATH,
      ADMIN_PASSWORD_HASH: TEST_PASSWORD_HASH,
    };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it('GET /<ADMIN_PATH> returns text/html containing injected path', async () => {
    const { createApp } = await import('../src/server/app.js');
    const app = createApp();

    const res = await app.request(`/${TEST_ADMIN_PATH}`);
    
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    
    const html = await res.text();
    expect(html).toContain(`'${TEST_ADMIN_PATH}'`);
    expect(html).toContain('ara admin');
  });

  it('GET /<ADMIN_PATH> sets Cache-Control no-store header', async () => {
    const { createApp } = await import('../src/server/app.js');
    const app = createApp();

    const res = await app.request(`/${TEST_ADMIN_PATH}`);
    
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('GET /<ADMIN_PATH> sets X-Robots-Tag noindex header', async () => {
    const { createApp } = await import('../src/server/app.js');
    const app = createApp();

    const res = await app.request(`/${TEST_ADMIN_PATH}`);
    
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag')).toContain('noindex');
  });

  it('GET /<ADMIN_PATH> sets CSRF cookie', async () => {
    const { createApp } = await import('../src/server/app.js');
    const app = createApp();

    const res = await app.request(`/${TEST_ADMIN_PATH}`);
    
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('ara_csrf=');
  });

  it('GET /admin.html returns 404', async () => {
    const { createApp } = await import('../src/server/app.js');
    const app = createApp();

    const res = await app.request('/admin.html');
    
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('not here.');
  });

  it('GET /<ADMIN_PATH>/session returns JSON with csrf token', async () => {
    const { createApp } = await import('../src/server/app.js');
    const app = createApp();

    const res = await app.request(`/${TEST_ADMIN_PATH}/session`);
    
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    
    const data = await res.json();
    expect(data).toHaveProperty('authenticated', false);
    expect(data).toHaveProperty('csrfToken');
    expect(typeof data.csrfToken).toBe('string');
  });

  it('login with correct password and CSRF returns 200 and sets session cookie', async () => {
    const { createApp } = await import('../src/server/app.js');
    const { hashPassword } = await import('../src/server/utils.js');
    
    const password = 'test-password-123';
    process.env.ADMIN_PASSWORD_HASH = hashPassword(password);
    
    const app = createApp();

    const sessionRes = await app.request(`/${TEST_ADMIN_PATH}/session`);
    const sessionData = await sessionRes.json() as { csrfToken: string };
    const csrfToken = sessionData.csrfToken;
    const csrfCookie = sessionRes.headers.get('set-cookie')?.split(';')[0] || '';

    const formData = new FormData();
    formData.append('password', password);
    formData.append('_csrf', csrfToken);

    const loginRes = await app.request(`/${TEST_ADMIN_PATH}/login`, {
      method: 'POST',
      body: formData,
      headers: {
        Cookie: csrfCookie,
      },
    });

    expect(loginRes.status).toBe(200);
    
    const loginData = await loginRes.json() as { success: boolean; csrfToken: string };
    expect(loginData.success).toBe(true);
    expect(loginData.csrfToken).toBeTruthy();
    
    const loginSetCookie = loginRes.headers.get('set-cookie');
    expect(loginSetCookie).toContain('ara_session=');
  });

  it('login without CSRF token returns 403', async () => {
    const { createApp } = await import('../src/server/app.js');
    const { hashPassword } = await import('../src/server/utils.js');
    
    const password = 'test-password-123';
    process.env.ADMIN_PASSWORD_HASH = hashPassword(password);
    
    const app = createApp();

    const formData = new FormData();
    formData.append('password', password);

    const loginRes = await app.request(`/${TEST_ADMIN_PATH}/login`, {
      method: 'POST',
      body: formData,
    });

    expect(loginRes.status).toBe(403);
  });
});
