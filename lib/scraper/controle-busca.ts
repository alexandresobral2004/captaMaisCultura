import type BetterSqlite3 from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { db } from '../database/db';

/** Quantas buscas por novos editais podem ser iniciadas dentro da janela abaixo. */
export const LIMITE_BUSCAS = 2;
/** Janela móvel (dias). */
export const JANELA_DIAS = 7;
/** Intervalo do heartbeat enquanto a busca roda. */
export const INTERVALO_BATIDA_MS = 30 * 1000;
/** Busca "em andamento" sem heartbeat há mais que isso é considerada interrompida (órfã). */
export const TEMPO_SEM_BATIDA_MS = 5 * 60 * 1000;

const DIA_MS = 24 * 60 * 60 * 1000;

export interface SituacaoBusca {
  limite: number;
  usadas: number;
  restantes: number;
  /** Já existe uma busca rodando agora. */
  emAndamento: boolean;
  ultimaBusca: { iniciadaEm: string; status: string; novos: number; jaExistentes: number } | null;
  /** Quando volta a ter busca disponível (só quando restantes = 0). */
  liberadaEm: string | null;
  podeBuscar: boolean;
}

export interface EstatisticasBusca {
  novos: number;
  jaExistentes: number;
  descartados: number;
  comErro: number;
  mensagem?: string;
}

// ─── Implementação SQLite (usada nos testes e em dev local sem DATABASE_URL) ──

function marcarInterrompidasSQLite(sqlite: BetterSqlite3.Database, agora: Date) {
  sqlite
    .prepare(`UPDATE buscas_editais SET status = 'erro', concluida_em = ?, mensagem = 'Interrompida' WHERE status = 'em_andamento' AND COALESCE(atualizada_em, iniciada_em) < ?`)
    .run(agora.toISOString(), new Date(agora.getTime() - TEMPO_SEM_BATIDA_MS).toISOString());
}

/** Registra o heartbeat de uma busca em andamento. */
export function batidaBuscaSQLite(sqlite: BetterSqlite3.Database, id: number, agora = new Date()) {
  sqlite
    .prepare(`UPDATE buscas_editais SET atualizada_em = ? WHERE id = ? AND status = 'em_andamento'`)
    .run(agora.toISOString(), id);
}

export function situacaoDaBusca(sqlite: BetterSqlite3.Database, agora = new Date()): SituacaoBusca {
  marcarInterrompidasSQLite(sqlite, agora);
  const desde = new Date(agora.getTime() - JANELA_DIAS * DIA_MS).toISOString();
  // Busca que falhou não gasta o limite
  const contadas = sqlite
    .prepare(`SELECT iniciada_em FROM buscas_editais WHERE status != 'erro' AND iniciada_em >= ? ORDER BY iniciada_em ASC`)
    .all(desde) as { iniciada_em: string }[];
  const emAndamento = !!sqlite.prepare(`SELECT 1 FROM buscas_editais WHERE status = 'em_andamento' LIMIT 1`).get();
  const ultima = sqlite
    .prepare(`SELECT iniciada_em, status, novos, ja_existentes FROM buscas_editais ORDER BY iniciada_em DESC LIMIT 1`)
    .get() as { iniciada_em: string; status: string; novos: number; ja_existentes: number } | undefined;

  const usadas = contadas.length;
  const restantes = Math.max(0, LIMITE_BUSCAS - usadas);
  const liberadaEm = restantes === 0
    ? new Date(new Date(contadas[usadas - LIMITE_BUSCAS].iniciada_em).getTime() + JANELA_DIAS * DIA_MS).toISOString()
    : null;

  return {
    limite: LIMITE_BUSCAS,
    usadas,
    restantes,
    emAndamento,
    ultimaBusca: ultima
      ? { iniciadaEm: ultima.iniciada_em, status: ultima.status, novos: ultima.novos ?? 0, jaExistentes: ultima.ja_existentes ?? 0 }
      : null,
    liberadaEm,
    podeBuscar: restantes > 0 && !emAndamento,
  };
}

export type InicioBusca = { ok: true; id: number } | { ok: false; motivo: 'limite' | 'em_andamento'; situacao: SituacaoBusca };

/** Confere o limite e registra o início da busca de forma atômica. */
export function iniciarBusca(sqlite: BetterSqlite3.Database, agora = new Date()): InicioBusca {
  const tentar = sqlite.transaction((): InicioBusca => {
    const situacao = situacaoDaBusca(sqlite, agora);
    if (situacao.emAndamento) return { ok: false, motivo: 'em_andamento', situacao };
    if (situacao.restantes <= 0) return { ok: false, motivo: 'limite', situacao };
    const r = sqlite
      .prepare(`INSERT INTO buscas_editais (iniciada_em, atualizada_em, status) VALUES (?, ?, 'em_andamento')`)
      .run(agora.toISOString(), agora.toISOString());
    return { ok: true, id: Number(r.lastInsertRowid) };
  });
  return tentar.immediate();
}

export function finalizarBusca(sqlite: BetterSqlite3.Database, id: number, stats: EstatisticasBusca, falhou = false, agora = new Date()) {
  sqlite
    .prepare(`UPDATE buscas_editais SET status = ?, concluida_em = ?, novos = ?, ja_existentes = ?, descartados = ?, com_erro = ?, mensagem = ? WHERE id = ?`)
    .run(falhou ? 'erro' : 'concluida', agora.toISOString(), stats.novos, stats.jaExistentes, stats.descartados, stats.comErro, stats.mensagem ?? null, id);
}

// ─── Versões assíncronas para Drizzle/Postgres (produção) ─────────────────────

async function marcarInterrompidasAsync(db: any, agora: Date) {
  await db.execute(
    sql`UPDATE buscas_editais SET status = 'erro', concluida_em = ${agora.toISOString()}, mensagem = 'Interrompida' WHERE status = 'em_andamento' AND COALESCE(atualizada_em, iniciada_em) < ${new Date(agora.getTime() - TEMPO_SEM_BATIDA_MS).toISOString()}`
  );
}

/** Marca como interrompidas as buscas sem heartbeat. Chamada na subida do sistema e ao consultar a situação. */
export async function recuperarBuscasOrfasAsync(agora = new Date()) {
  await marcarInterrompidasAsync(db, agora);
}

/** Heartbeat: a busca em andamento registra que segue viva. */
export async function batidaBuscaAsync(id: number, agora = new Date()) {
  await (db as any).execute(
    sql`UPDATE buscas_editais SET atualizada_em = ${agora.toISOString()} WHERE id = ${id} AND status = 'em_andamento'`
  );
}

export async function situacaoDaBuscaAsync(agora = new Date()): Promise<SituacaoBusca> {
  await marcarInterrompidasAsync(db, agora);
  const desde = new Date(agora.getTime() - JANELA_DIAS * DIA_MS).toISOString();

  const [contadas, emAndamentoRow, ultima] = await Promise.all([
    (db as any).execute(sql`SELECT iniciada_em FROM buscas_editais WHERE status != 'erro' AND iniciada_em >= ${desde} ORDER BY iniciada_em ASC`),
    (db as any).execute(sql`SELECT 1 FROM buscas_editais WHERE status = 'em_andamento' LIMIT 1`),
    (db as any).execute(sql`SELECT iniciada_em, status, novos, ja_existentes FROM buscas_editais ORDER BY iniciada_em DESC LIMIT 1`),
  ]);

  const contadasArr = Array.isArray(contadas) ? contadas : [];
  const emAndamento = Array.isArray(emAndamentoRow) && emAndamentoRow.length > 0;
  const ultimaRow = Array.isArray(ultima) && ultima.length > 0 ? ultima[0] as any : undefined;

  const usadas = contadasArr.length;
  const restantes = Math.max(0, LIMITE_BUSCAS - usadas);
  const liberadaEm = restantes === 0
    ? new Date(new Date(contadasArr[usadas - LIMITE_BUSCAS].iniciada_em).getTime() + JANELA_DIAS * DIA_MS).toISOString()
    : null;

  return {
    limite: LIMITE_BUSCAS,
    usadas,
    restantes,
    emAndamento,
    ultimaBusca: ultimaRow
      ? { iniciadaEm: ultimaRow.iniciada_em, status: ultimaRow.status, novos: ultimaRow.novos ?? 0, jaExistentes: ultimaRow.ja_existentes ?? 0 }
      : null,
    liberadaEm,
    podeBuscar: restantes > 0 && !emAndamento,
  };
}

export async function iniciarBuscaAsync(agora = new Date()): Promise<InicioBusca> {
  return (db as any).transaction(async (tx: any) => {
    const situacao = await situacaoDaBuscaAsync(agora);
    if (situacao.emAndamento) return { ok: false, motivo: 'em_andamento', situacao };
    if (situacao.restantes <= 0) return { ok: false, motivo: 'limite', situacao };
    const rows = await tx.execute(sql`INSERT INTO buscas_editais (iniciada_em, atualizada_em, status) VALUES (${agora.toISOString()}, ${agora.toISOString()}, 'em_andamento') RETURNING id`);
    const id = Array.isArray(rows) && rows.length > 0 ? Number((rows[0] as any).id) : 0;
    return { ok: true, id };
  });
}

export async function finalizarBuscaAsync(id: number, stats: EstatisticasBusca, falhou = false, agora = new Date()) {
  await (db as any).execute(
    sql`UPDATE buscas_editais SET status = ${falhou ? 'erro' : 'concluida'}, concluida_em = ${agora.toISOString()}, novos = ${stats.novos}, ja_existentes = ${stats.jaExistentes}, descartados = ${stats.descartados}, com_erro = ${stats.comErro}, mensagem = ${stats.mensagem ?? null} WHERE id = ${id}`
  );
}

/** Edital que já foi baixado ou avaliado antes: não precisa baixar de novo. */
export function editalJaProcessado(e: { pdfSalvoEm?: string | null; statusAnalise?: string | null }): boolean {
  if (e.pdfSalvoEm) return true;
  return ['analisado', 'pdf_baixado', 'descartado', 'duvida', 'sem_pdf'].includes(e.statusAnalise ?? '');
}
