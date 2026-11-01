import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { setupTestDbMock, rawQuery, IS_POSTGRES } from './setup';

const NOME_INDICE = 'idx_logs_contexto_id';
const TAG_MIGRACAO = '0006_logs_pipeline_indice';

describe('índice de logs_sistema por (contexto, id)', () => {
  it('existe no banco criado pelo projeto', async () => {
    const { rawDb } = setupTestDbMock();
    const linhas = IS_POSTGRES
      ? await rawQuery(rawDb, 'SELECT indexdef AS definicao FROM pg_indexes WHERE indexname = ?', [NOME_INDICE])
      : await rawQuery(rawDb, "SELECT sql AS definicao FROM sqlite_master WHERE type = 'index' AND name = ?", [NOME_INDICE]);

    expect(linhas).toHaveLength(1);
    expect(String(linhas[0].definicao)).toMatch(/\(contexto, id\)/);
  });

  it('a migração Postgres está no journal e no arquivo SQL', () => {
    const pasta = path.join(process.cwd(), 'lib', 'database', 'migrations-pg');
    const journal: { entries: { tag: string }[] } = JSON.parse(
      fs.readFileSync(path.join(pasta, 'meta', '_journal.json'), 'utf8'),
    );

    expect(journal.entries.map((e) => e.tag)).toContain(TAG_MIGRACAO);
    const sql = fs.readFileSync(path.join(pasta, `${TAG_MIGRACAO}.sql`), 'utf8');
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS "?idx_logs_contexto_id"? ON "?logs_sistema"? \("?contexto"?, "?id"?\)/);
  });
});
