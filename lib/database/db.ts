import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { criarFTS, criarTabelas, migrarSchema } from './ddl';
import fs from 'fs';
import path from 'path';

// Carregar variáveis de ambiente manualmente se não estiverem definidas (útil no Next.js)
if (!process.env.OPENAI_API_KEY) {
  for (const filename of ['.env.local', 'env.local']) {
    const envPath = path.join(process.cwd(), filename);
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          // Ignorar se a linha começar com export
          const cleanLine = trimmed.startsWith('export ') ? trimmed.substring(7) : trimmed;
          const parts = cleanLine.split('=');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
            process.env[key] = val;
          }
        });
        console.log(`[DB SETUP] Variáveis de ambiente carregadas do arquivo ${filename}`);
        break;
      } catch (e: any) {
        console.warn(`[DB SETUP] Erro ao ler ${filename}:`, e.message);
      }
    }
  }
}

// DATABASE_PATH permite apontar para outro arquivo (ex.: testes); o padrão é data/db/editais.db
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'db', 'editais.db');

// Garantir que o diretorio existe
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Criar conexao SQLite
const sqlite = new Database(DB_PATH);

// Configuracoes de performance e integridade
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('cache_size = -64000'); // 64MB cache

// Criar instancia Drizzle
export const db = drizzle(sqlite, { schema });

// Funcao para executar SQL bruto
export function execSQL(sql: string) {
  sqlite.exec(sql);
}

// Funcao para obter a conexao raw
export function getRawDb() {
  return sqlite;
}

// Funcao para configurar FTS5
export function setupFTS() {
  criarFTS(sqlite);
}

// Funcao para criar tabelas (primeira execucao)
export function createTables() {
  criarTabelas(sqlite);
}

// Migração: adicionar colunas novas que podem não existir em bancos antigos
function migrateSchema() {
  migrarSchema(sqlite);
}

// Inicializar tabelas na primeira execucao (server-side only)
let initialized = false;

if (typeof window === 'undefined') {
  try {
    if (!initialized) {
      initialized = true;
      createTables();
      migrateSchema();
    }
  } catch (error) {
    console.warn('Erro ao criar tabelas:', error);
  }
}
