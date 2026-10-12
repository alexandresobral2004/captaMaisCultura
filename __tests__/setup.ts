import { vi, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../lib/database/schema';
import { criarTabelas, migrarSchema } from '../lib/database/ddl';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  const testDb = drizzle(sqlite, { schema });

  // Mesmo DDL e migração do banco real (lib/database/ddl.ts)
  criarTabelas(sqlite);
  migrarSchema(sqlite);

  return { db: testDb, rawDb: sqlite };
}

export function clearAllTables(rawDb: Database.Database) {
  rawDb.exec('DELETE FROM analise_pontos_fracos');
  rawDb.exec('DELETE FROM analise_criterios');
  rawDb.exec('DELETE FROM analise_documentos');
  rawDb.exec('DELETE FROM analise_itens_financiaveis');
  rawDb.exec('DELETE FROM analise_requisitos');
  rawDb.exec('DELETE FROM analise_ia');
  rawDb.exec('DELETE FROM palavras_chave');
  rawDb.exec('DELETE FROM arquivos_anexos');
  rawDb.exec('DELETE FROM motivos_pontuacao');
  rawDb.exec('DELETE FROM projetos');
  rawDb.exec('DELETE FROM projetos_cientificos');
  rawDb.exec('DELETE FROM editais');
  rawDb.exec('DELETE FROM jobs');
  rawDb.exec('DELETE FROM portais');
}

export function setupTestDbMock() {
  const { db: testDb, rawDb } = createTestDb();

  const mockDbObj = {
    db: testDb,
    getRawDb: () => rawDb,
    execSQL: (sql: string) => rawDb.exec(sql),
  };

  vi.doMock('../lib/database/db', () => mockDbObj);
  vi.doMock('../../database/db', () => mockDbObj);
  vi.doMock('@/lib/database/db', () => mockDbObj);
  vi.doMock('../database/db', () => mockDbObj);

  return { db: testDb, rawDb };
}

beforeEach(() => {
  vi.restoreAllMocks();
});
