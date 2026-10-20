import { vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../lib/database/schema';
import { criarTabelas, migrarSchema } from '../lib/database/ddl';

export const IS_POSTGRES = (process.env.DATABASE_URL ?? '').startsWith('postgres');

// ─── Modo SQLite (padrão) ─────────────────────────────────────────────────────

function createTestDbSQLite() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const testDb = drizzle(sqlite as any, { schema: schema as any });
  criarTabelas(sqlite);
  migrarSchema(sqlite);
  return { db: testDb as any, rawDb: sqlite };
}

// ─── Modo Postgres (npm run test:pg) ─────────────────────────────────────────

let pgConn: any = null;

const PG_TABLES = [
  'analise_pontos_fracos', 'analise_criterios', 'analise_documentos',
  'analise_itens_financiaveis', 'analise_requisitos', 'analise_ia',
  'palavras_chave', 'arquivos_anexos', 'motivos_pontuacao',
  'projetos_cientificos', 'projetos', 'rag_chunks', 'logs_sistema',
  'prompts_historico', 'prompts_customizados', 'prompts_sistema',
  'jobs', 'portais', 'editais',
];

if (IS_POSTGRES) {
  // Pré-aquece a conexão antes de qualquer teste no arquivo
  beforeAll(async () => {
    if (!pgConn) {
      const { initDb } = await import('../lib/database/db');
      pgConn = await initDb();
    }
  });

  // Limpa todas as tabelas antes de cada teste (substituindo o padrão SQLite de DELETE)
  beforeEach(async () => {
    if (pgConn) {
      await pgConn.execSQL(
        `TRUNCATE TABLE ${PG_TABLES.join(', ')} RESTART IDENTITY CASCADE`
      );
    }
  });

  afterAll(async () => {
    if (pgConn) {
      try { await pgConn.getRawDb().end(); } catch { /* ignore */ }
      pgConn = null;
    }
  });
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Prepara banco de teste e registra mock do módulo db.
 * Síncrono — em modo Postgres, a conexão já foi aquecida pelo beforeAll do setupFiles.
 */
export function setupTestDbMock() {
  if (IS_POSTGRES) {
    // pgConn já está inicializado pelo beforeAll global acima
    if (!pgConn) throw new Error('Postgres não inicializado — chame setupTestDbMock() só dentro de beforeEach');
    const mockDbObj = {
      db: pgConn.db,
      getRawDb: pgConn.getRawDb,
      execSQL: pgConn.execSQL,
      setupFTS: () => {},
      createTables: () => {},
      initDb: async () => pgConn,
    };
    vi.doMock('../lib/database/db', () => mockDbObj);
    vi.doMock('../../database/db', () => mockDbObj);
    vi.doMock('@/lib/database/db', () => mockDbObj);
    vi.doMock('../database/db', () => mockDbObj);
    return { db: pgConn.db as any, rawDb: pgConn.getRawDb() };
  }

  const { db, rawDb } = createTestDbSQLite();
  const mockDbObj = {
    db,
    getRawDb: () => rawDb,
    execSQL: (s: string) => rawDb.exec(s),
    setupFTS: () => {},
    createTables: () => {},
    initDb: async () => mockDbObj,
  };
  vi.doMock('../lib/database/db', () => mockDbObj);
  vi.doMock('../../database/db', () => mockDbObj);
  vi.doMock('@/lib/database/db', () => mockDbObj);
  vi.doMock('../database/db', () => mockDbObj);
  return { db, rawDb };
}

/** Versão async — para os poucos testes que precisam de await */
export async function setupTestDbMockAsync() {
  if (IS_POSTGRES && !pgConn) {
    const { initDb } = await import('../lib/database/db');
    pgConn = await initDb();
    await pgConn.execSQL(
      `TRUNCATE TABLE ${PG_TABLES.join(', ')} RESTART IDENTITY CASCADE`
    );
  }
  return setupTestDbMock();
}

/**
 * Executa SQL cru com placeholders `?` nos dois modos e devolve as linhas (colunas em snake_case).
 * Em Postgres converte `?` para `$1, $2...` e usa o cliente postgres-js.
 */
export async function rawQuery(rawDb: any, sql: string, params: unknown[] = []): Promise<any[]> {
  if (IS_POSTGRES) {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    return Array.from(await rawDb.unsafe(pgSql, params as any[]));
  }
  const stmt = rawDb.prepare(sql);
  if (stmt.reader) return stmt.all(...params);
  stmt.run(...params);
  return [];
}

/** Limpa tabelas — no-op em Postgres (feito pelo beforeEach global) */
export function clearAllTables(rawDb: any) {
  if (IS_POSTGRES) return;
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

export function createTestDb() {
  return createTestDbSQLite();
}

beforeEach(() => {
  vi.restoreAllMocks();
});
