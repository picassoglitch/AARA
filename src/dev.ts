import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp, getAdminPath } from './server/app.js';
import { getDatabase } from './db/index.js';
import { hashPassword } from './server/utils.js';

async function main() {
  const db = await getDatabase();
  
  if (!process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_PASSWORD) {
    const hash = hashPassword(process.env.ADMIN_PASSWORD);
    console.log('admin password hash:', hash);
    process.env.ADMIN_PASSWORD_HASH = hash;
  }
  
  if (!process.env.ADMIN_PASSWORD_HASH) {
    const defaultPassword = 'ara-dev-password';
    const hash = hashPassword(defaultPassword);
    process.env.ADMIN_PASSWORD_HASH = hash;
    console.log(`dev mode: admin password set to "${defaultPassword}"`);
  }

  const adminPath = getAdminPath();
  const app = createApp();

  app.use('/uploads/*', serveStatic({ root: './' }));

  app.use('/*', serveStatic({ root: './public' }));

  const port = parseInt(process.env.PORT || '3000', 10);

  console.log(`server running at http://localhost:${port}`);
  console.log(`admin path: /${adminPath}`);

  serve({ fetch: app.fetch, port });
}

main().catch(console.error);
