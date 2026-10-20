import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { registrarDecisao, resumoDoFunil } from '../lib/scraper/funil';

function bancoComFunil() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE funil_decisoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, criada_em TEXT NOT NULL, portal TEXT, edital_id TEXT,
    titulo TEXT NOT NULL, etapa TEXT NOT NULL, resultado TEXT NOT NULL, motivo TEXT, probabilidade REAL)`);
  return db;
}

describe('funil de filtragem', () => {
  it('conta passou, dúvida e descartado por etapa', () => {
    const db = bancoComFunil();
    registrarDecisao({ titulo: 'A', etapa: 'triagem', resultado: 'passou' }, db);
    registrarDecisao({ titulo: 'B', etapa: 'triagem', resultado: 'duvida' }, db);
    registrarDecisao({ titulo: 'C', etapa: 'triagem', resultado: 'descartado' }, db);
    registrarDecisao({ titulo: 'A', etapa: 'documento', resultado: 'passou', probabilidade: 0.9 }, db);
    registrarDecisao({ titulo: 'D', etapa: 'duplicado', resultado: 'duplicado' }, db);
    const r = resumoDoFunil(db);
    expect(r.find(l => l.etapa === 'triagem')).toEqual({ etapa: 'triagem', passou: 1, duvida: 1, descartado: 1, duplicado: 0 });
    // Duplicado tem coluna própria e não infla o descartado
    expect(r.find(l => l.etapa === 'duplicado')).toEqual({ etapa: 'duplicado', passou: 0, duvida: 0, descartado: 0, duplicado: 1 });
    expect(r.find(l => l.etapa === 'documento')?.passou).toBe(1);
    expect(r.find(l => l.etapa === 'pontuacao')?.passou).toBe(0);
  });

  it('não lança quando a tabela não existe', () => {
    expect(() => registrarDecisao({ titulo: 'X', etapa: 'triagem', resultado: 'passou' }, new Database(':memory:'))).not.toThrow();
  });
});
