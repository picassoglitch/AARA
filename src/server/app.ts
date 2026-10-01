import { Hono } from 'hono';
import { securityHeaders } from './middleware/security.js';
import { publicRoutes } from './routes/public.js';
import { createAdminRoutes, getAdminPath } from './routes/admin.js';

const stubPageTemplate = (content: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0b0a09">
  <meta name="robots" content="noindex, nofollow">
  <title>ara</title>
  <link rel="preload" href="/fonts/cormorant-garamond-light.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="stub-page">
    ${content}
    <span class="crest" aria-hidden="true">ixiptla</span>
  </div>
</body>
</html>`;

export function createApp() {
  const app = new Hono();

  app.use('*', securityHeaders());

  app.route('/', publicRoutes);

  const adminRoutes = createAdminRoutes();
  app.route('/', adminRoutes);

  app.get('/i/:code', async (c) => {
    return c.html(stubPageTemplate(`
    <p class="stub-line">this was left for you.</p>
    <p class="stub-line" style="margin-top:12px;">nepantla.</p>
    `));
  });

  app.get('/verify/:id', async (c) => {
    return c.html(stubPageTemplate(`
    <p class="stub-line">not recognized.</p>
    `));
  });

  app.get('/t/:id', async (c) => {
    return c.html(stubPageTemplate(`
    <p class="stub-line">teyolia.</p>
    `));
  });

  app.get('/c/:code', async (c) => {
    const code = c.req.param('code');
    return c.redirect(`/?ref=${code}`);
  });

  app.notFound((c) => {
    return c.html(stubPageTemplate(`
    <p class="stub-line">not here.</p>
    `), 404);
  });

  return app;
}

export { getAdminPath };
