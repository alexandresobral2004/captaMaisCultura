/**
 * Conexão com o banco de dados.
 *
 * Modo dual:
 * - Se DATABASE_URL começa com "postgres", usa postgres.js + Drizzle pg
 * - Caso contrário (testes, ou DATABASE_PATH definido), usa better-sqlite3 + Drizzle SQLite
 */

import * as schema from './schema';
import { criarFTS, criarTabelas, migrarSchema } from './ddl';
import { drizzle as drizzleSQLite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import BetterSQLite from 'better-sqlite3';
import postgres from 'postgres';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

export type AppDb = ReturnType<typeof drizzleSQLite<typeof schema>>;

const DATABASE_URL = process.env.DATABASE_URL ?? '';

function criarConexaoSQLite() {
  const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), 'data', 'db', 'editais.db');
  const dbDir = dirname(DB_PATH);
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

  const sqlite = new BetterSQLite(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('cache_size = -64000');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _db = drizzleSQLite(sqlite as any, { schema: schema as any });

  if (typeof window === 'undefined') {
    try {
      criarTabelas(sqlite);
      migrarSchema(sqlite);
    } catch (error) {
      console.warn('Erro ao criar tabelas SQLite:', error);
    }
  }

  return {
    db: _db as any,
    getRawDb: () => sqlite as any,
    execSQL: (s: string) => sqlite.exec(s),
    setupFTS: () => criarFTS(sqlite),
    createTables: () => criarTabelas(sqlite),
  };
}

// postgres() não abre conexão até a primeira query, então a criação pode ser síncrona e lazy
function criarConexaoPostgres() {
  const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
  const client = postgres(DATABASE_URL, { ssl: isLocalhost ? false : 'require' });
  const _db = drizzlePg(client, { schema });
  return {
    db: _db as any,
    getRawDb: () => client as any,
    execSQL: async (s: string) => { await client.unsafe(s); },
    setupFTS: () => {},
    createTables: () => {},
  };
}

// Conexão criada no primeiro uso
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _conn: any = null;

function getConn() {
  if (!_conn) {
    _conn = DATABASE_URL.startsWith('postgres') ? criarConexaoPostgres() : criarConexaoSQLite();
  }
  return _conn;
}

// Mantida por compatibilidade (testes); a conexão já é criada sob demanda por getConn()
export async function initDb() {
  return getConn();
}

// Inicializa imediatamente para SQLite (síncrono)
if (!DATABASE_URL.startsWith('postgres')) {
  _conn = criarConexaoSQLite();
}

export const db: any = new Proxy({} as any, {
  get(_target, prop) {
    return (getConn() as any).db[prop];
  },
});

export function getRawDb() { return getConn().getRawDb(); }
export function execSQL(s: string) { return getConn().execSQL(s); }
export function setupFTS() { return getConn().setupFTS(); }
export function createTables() { return getConn().createTables(); }
