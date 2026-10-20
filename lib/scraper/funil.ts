import type BetterSqlite3 from 'better-sqlite3';
import { sql } from 'drizzle-orm';

export type EtapaFunil = 'triagem' | 'duplicado' | 'fora_escopo' | 'documento' | 'pontuacao';
/** `duplicado`: já existia no banco ou foi excluído antes; não é uma decisão de qualidade, então não entra em descartado. */
export type ResultadoFunil = 'passou' | 'duvida' | 'descartado' | 'duplicado';

export interface DecisaoFunil {
  portal?: string;
  editalId?: string;
  titulo: string;
  etapa: EtapaFunil;
  resultado: ResultadoFunil;
  motivo?: string;
  /** Probabilidade ou certeza bruta da decisão, quando houver (0-1). */
  probabilidade?: number;
}

/** Guarda a decisão de uma etapa. Nunca lança: o registro não pode derrubar a busca. */
export function registrarDecisao(d: DecisaoFunil, sqlite: BetterSqlite3.Database | null = null): void {
  try {
    if (sqlite) {
      // Caminho SQLite (testes)
      sqlite.prepare(
        `INSERT INTO funil_decisoes (criada_em, portal, edital_id, titulo, etapa, resultado, motivo, probabilidade) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(new Date().toISOString(), d.portal ?? null, d.editalId ?? null, d.titulo, d.etapa, d.resultado, d.motivo ?? null, d.probabilidade ?? null);
    } else {
      // Caminho Drizzle/Postgres (produção) — fire-and-forget
      const { db } = require('../database/db') as typeof import('../database/db');
      const { funilDecisoes } = require('../database/schema') as typeof import('../database/schema');
      (db as any).insert(funilDecisoes).values({
        criadaEm: new Date().toISOString(),
        portal: d.portal ?? null,
        editalId: d.editalId ?? null,
        titulo: d.titulo,
        etapa: d.etapa,
        resultado: d.resultado,
        motivo: d.motivo ?? null,
        probabilidade: d.probabilidade ?? null,
      }).catch((e: Error) => console.warn(`Funil: não registrou decisão (${e.message})`));
    }
  } catch (erro) {
    console.warn(`   ⚠️ Funil: não registrou decisão (${(erro as Error).message})`);
  }
}

export interface LinhaFunil {
  etapa: EtapaFunil;
  passou: number;
  duvida: number;
  descartado: number;
  duplicado: number;
}

const ORDEM: EtapaFunil[] = ['triagem', 'duplicado', 'fora_escopo', 'documento', 'pontuacao'];

/** Quantos editais passaram, ficaram em dúvida ou caíram em cada etapa desde a data dada. */
export function resumoDoFunil(sqlite: BetterSqlite3.Database, desde = '1970-01-01T00:00:00.000Z'): LinhaFunil[] {
  const linhas = sqlite
    .prepare(`SELECT etapa, resultado, COUNT(*) AS n FROM funil_decisoes WHERE criada_em >= ? GROUP BY etapa, resultado`)
    .all(desde) as { etapa: EtapaFunil; resultado: ResultadoFunil; n: number }[];
  return ORDEM.map(etapa => {
    const da = linhas.filter(l => l.etapa === etapa);
    const conta = (r: ResultadoFunil) => da.find(l => l.resultado === r)?.n ?? 0;
    return { etapa, passou: conta('passou'), duvida: conta('duvida'), descartado: conta('descartado'), duplicado: conta('duplicado') };
  });
}

/** Versão assíncrona para uso com Drizzle/Postgres em produção. */
export async function resumoDoFunilAsync(desde = '1970-01-01T00:00:00.000Z'): Promise<LinhaFunil[]> {
  const { db } = require('../database/db') as typeof import('../database/db');
  const rows = await (db as any).execute(
    sql`SELECT etapa, resultado, COUNT(*) AS n FROM funil_decisoes WHERE criada_em >= ${desde} GROUP BY etapa, resultado`
  ) as { etapa: EtapaFunil; resultado: ResultadoFunil; n: number }[];
  return ORDEM.map(etapa => {
    const da = (Array.isArray(rows) ? rows : []).filter((l: any) => l.etapa === etapa);
    const conta = (r: ResultadoFunil) => da.find((l: any) => l.resultado === r)?.n ?? 0;
    return { etapa, passou: Number(conta('passou')), duvida: Number(conta('duvida')), descartado: Number(conta('descartado')), duplicado: Number(conta('duplicado')) };
  });
}
