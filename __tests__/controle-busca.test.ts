import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { criarTabelas, migrarSchema } from '../lib/database/ddl';
import { iniciarBusca, finalizarBusca, situacaoDaBusca, editalJaProcessado } from '../lib/scraper/controle-busca';

const dia = 24 * 60 * 60 * 1000;
const base = new Date('2026-10-13T12:00:00Z');
const depois = (ms: number) => new Date(base.getTime() + ms);

let sqlite: Database.Database;
beforeEach(() => {
  sqlite = new Database(':memory:');
  criarTabelas(sqlite);
  migrarSchema(sqlite);
});

const stats = { novos: 3, jaExistentes: 10, descartados: 1, comErro: 0 };

describe('controle das buscas por novos editais', () => {
  it('libera 2 buscas por semana e bloqueia a terceira', () => {
    const a = iniciarBusca(sqlite, base);
    expect(a.ok).toBe(true);
    if (a.ok) finalizarBusca(sqlite, a.id, stats, false, base);
    const b = iniciarBusca(sqlite, depois(dia));
    expect(b.ok).toBe(true);
    if (b.ok) finalizarBusca(sqlite, b.id, stats, false, depois(dia));
    const c = iniciarBusca(sqlite, depois(2 * dia));
    expect(c).toMatchObject({ ok: false, motivo: 'limite' });
  });

  it('informa quando o limite volta (7 dias após a mais antiga que conta)', () => {
    for (const t of [0, dia]) {
      const r = iniciarBusca(sqlite, depois(t));
      if (r.ok) finalizarBusca(sqlite, r.id, stats, false, depois(t));
    }
    const s = situacaoDaBusca(sqlite, depois(2 * dia));
    expect(s.restantes).toBe(0);
    expect(s.liberadaEm).toBe(depois(7 * dia).toISOString());
  });

  it('volta a liberar depois de 7 dias', () => {
    for (const t of [0, dia]) {
      const r = iniciarBusca(sqlite, depois(t));
      if (r.ok) finalizarBusca(sqlite, r.id, stats, false, depois(t));
    }
    expect(iniciarBusca(sqlite, depois(7 * dia + 1000)).ok).toBe(true);
  });

  it('não permite duas buscas ao mesmo tempo', () => {
    expect(iniciarBusca(sqlite, base).ok).toBe(true);
    expect(iniciarBusca(sqlite, depois(1000))).toMatchObject({ ok: false, motivo: 'em_andamento' });
  });

  it('busca que falhou não gasta o limite', () => {
    const a = iniciarBusca(sqlite, base);
    if (a.ok) finalizarBusca(sqlite, a.id, stats, true, base);
    expect(situacaoDaBusca(sqlite, depois(1000)).restantes).toBe(2);
  });

  it('busca esquecida em andamento é considerada interrompida', () => {
    iniciarBusca(sqlite, base);
    const s = situacaoDaBusca(sqlite, depois(3 * 60 * 60 * 1000));
    expect(s.emAndamento).toBe(false);
    expect(s.restantes).toBe(2);
  });
});

describe('editalJaProcessado', () => {
  it('reconhece o que já foi baixado ou avaliado', () => {
    expect(editalJaProcessado({ pdfSalvoEm: 'data/downloads/a.pdf' })).toBe(true);
    for (const st of ['analisado', 'descartado', 'duvida', 'sem_pdf']) expect(editalJaProcessado({ statusAnalise: st })).toBe(true);
  });
  it('permite tentar de novo pendente sem arquivo e erro', () => {
    expect(editalJaProcessado({ statusAnalise: 'pendente' })).toBe(false);
    expect(editalJaProcessado({ statusAnalise: 'erro' })).toBe(false);
    expect(editalJaProcessado({})).toBe(false);
  });
});
