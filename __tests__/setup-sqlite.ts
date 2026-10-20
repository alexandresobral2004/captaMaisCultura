import { vi } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../lib/database/schema';
import { criarTabelas, migrarSchema } from '../lib/database/ddl';

export function createTestDbSync() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const testDb = drizzle(sqlite as any, { schema: schema as any });

  criarTabelas(sqlite);
  migrarSchema(sqlite);

  return { db: testDb as any, rawDb: sqlite };
}

export function setupTestDbMockSync() {
  const { db: testDb, rawDb } = createTestDbSync();

  const mockDbObj = {
    db: testDb,
    getRawDb: () => rawDb,
    execSQL: (sql: string) => rawDb.exec(sql),
    setupFTS: () => {},
    createTables: () => {},
    initDb: async () => mockDbObj,
  };

  vi.doMock('../lib/database/db', () => mockDbObj);
  vi.doMock('../../database/db', () => mockDbObj);
  vi.doMock('@/lib/database/db', () => mockDbObj);
  vi.doMock('../database/db', () => mockDbObj);

  return { db: testDb, rawDb };
}
