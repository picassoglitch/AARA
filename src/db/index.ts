import type { Database } from './interface.js';
import { SQLiteDatabase } from './sqlite.js';
import { PostgresDatabase } from './postgres.js';
import { resolveDatabaseUrl } from './resolve-url.js';

export type { Database };
export { SQLiteDatabase, PostgresDatabase };
export { resolveDatabaseUrl, getDatabaseEnvNames } from './resolve-url.js';

let dbInstance: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const { url: databaseUrl, source, checkedNames } = resolveDatabaseUrl();
  const isVercel = !!process.env.VERCEL;

  if (databaseUrl) {
    dbInstance = new PostgresDatabase(databaseUrl);
  } else if (isVercel) {
    console.error(
      `[db] No database configured. Checked env vars: ${checkedNames.join(', ')}`
    );
    throw new Error(
      'No database configured for Vercel deployment. ' +
      `Set one of: ${checkedNames.join(', ')}`
    );
  } else {
    dbInstance = new SQLiteDatabase(process.env.SQLITE_PATH || 'ara.db');
  }

  await dbInstance.init();
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}
