import { Hono } from 'hono';
import { serveStatic } from 'hono/serve-static';
import { securityHeaders } from './middleware/security.js';
import { publicRoutes } from './routes/public.js';
import { createAdminRoutes, getAdminPath } from './routes/admin.js';

export function createApp() {
  const app = new Hono();

  app.use('*', securityHeaders());

  app.route('/', publicRoutes);

  const adminRoutes = createAdminRoutes();
  app.route('/', adminRoutes);

  app.get('/i/:code', async (c) => {
    const code = c.req.param('code');
    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ara</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="stub-page">
    <p class="stub-message">this was left for you.</p>
    <p class="stub-word">nepantla.</p>
  </div>
</body>
</html>`);
  });

  app.get('/verify/:id', async (c) => {
    const id = c.req.param('id');
    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ara</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="stub-page">
    <p class="stub-message">not recognized.</p>
  </div>
</body>
</html>`);
  });

  app.get('/t/:id', async (c) => {
    const id = c.req.param('id');
    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ara</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="stub-page">
    <p class="stub-word">teyolia.</p>
  </div>
</body>
</html>`);
  });

  app.get('/c/:code', async (c) => {
    const code = c.req.param('code');
    return c.redirect(`/?ref=${code}`);
  });

  app.notFound((c) => {
    if (c.req.path === '/admin' || c.req.path.startsWith('/admin/')) {
      return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ara</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="stub-page">
    <p class="stub-message">not here.</p>
  </div>
</body>
</html>`, 404);
    }

    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ara</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="stub-page">
    <p class="stub-message">not here.</p>
  </div>
</body>
</html>`, 404);
  });

  return app;
}

export { getAdminPath };
