import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';

/**
 * Garante que o banco criado por lib/database/db.ts (DDL + migrateSchema) tem todas as
 * tabelas e colunas declaradas em schema.ts. Evita o bug em que uma coluna existia no
 * drizzle, mas faltava no banco real (ex.: editais.erro_analise) e quebrava as consultas.
 */

// rag_chunks tem criação própria (FTS + triggers) em scripts/setup-rag-db.ts e é opcional.
const TABELAS_OPCIONAIS = new Set(['rag_chunks']);

const arquivo = path.join(os.tmpdir(), `capta-drift-${process.pid}-${Date.now()}.db`);

afterAll(() => {
  for (const sufixo of ['', '-wal', '-shm']) fs.rmSync(arquivo + sufixo, { force: true });
});

describe('schema.ts x banco criado por db.ts', () => {
  it('todas as tabelas e colunas do drizzle existem no banco real', async () => {
    process.env.DATABASE_PATH = arquivo;
    const schema = await import('../lib/database/schema');
    await import('../lib/database/db'); // cria tabelas e roda migrateSchema

    const raw = new Database(arquivo, { readonly: true });
    const faltando: string[] = [];

    for (const valor of Object.values(schema)) {
      let cfg;
      try {
        cfg = getTableConfig(valor as any);
      } catch {
        continue; // não é tabela (enum, relations etc.)
      }
      if (TABELAS_OPCIONAIS.has(cfg.name)) continue;

      const colunas = (raw.prepare(`PRAGMA table_info(${cfg.name})`).all() as any[]).map((c) => c.name);
      if (colunas.length === 0) {
        faltando.push(`tabela ${cfg.name}`);
        continue;
      }
      for (const coluna of cfg.columns) {
        if (!colunas.includes(coluna.name)) faltando.push(`${cfg.name}.${coluna.name}`);
      }
    }
    raw.close();

    expect(faltando).toEqual([]);
  });
});
