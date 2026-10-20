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
import BetterSQLite from 'better-sqlite3';
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

async function criarConexaoPostgres() {
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const postgres = (await import('postgres')).default;
  const client = postgres(DATABASE_URL, { ssl: 'require' });
  const _db = drizzle(client, { schema });
  return {
    db: _db as any,
    getRawDb: () => client as any,
    execSQL: async (s: string) => { await client.unsafe(s); },
    setupFTS: () => {},
    createTables: () => {},
  };
}

// Conexão lazy para Postgres (aguarda resolução da Promise)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _conn: any = null;

function getConn() {
  if (!_conn) {
    if (DATABASE_URL.startsWith('postgres')) {
      // Em produção: lança erro se tentar usar antes de init()
      throw new Error('Banco Postgres ainda não inicializado. Aguarde init().');
    }
    _conn = criarConexaoSQLite();
  }
  return _conn;
}

// Inicialização assíncrona para Postgres
export async function initDb() {
  if (!_conn) {
    _conn = DATABASE_URL.startsWith('postgres')
      ? await criarConexaoPostgres()
      : criarConexaoSQLite();
  }
  return _conn;
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
