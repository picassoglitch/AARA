import type { Database } from './interface.js';
import { SQLiteDatabase } from './sqlite.js';
import { PostgresDatabase } from './postgres.js';

export type { Database };
export { SQLiteDatabase, PostgresDatabase };

let dbInstance: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    dbInstance = new PostgresDatabase(databaseUrl);
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
