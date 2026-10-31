import type BetterSqlite3 from 'better-sqlite3';
import crypto from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../database/db';
import type { Consulta } from '../database/consulta';
import { buscasEditais } from '../database/schema';
import { JobRepository, TEMPO_PENDENTE_MS, TEMPO_SEM_ATUALIZACAO_MS, MENSAGEM_WORKER_INDISPONIVEL } from '../jobs/job-repository';
import { TipoJob } from '../jobs/job-types';
import { ehConflitoDeFila } from '../jobs/enfileirar';

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

async function marcarInterrompidasAsync(executor: Consulta, agora: Date) {
  await executor.execute(
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

export async function situacaoDaBuscaAsync(agora = new Date(), executor: Consulta = db): Promise<SituacaoBusca> {
  await recuperarOrfaosAsync(executor, agora);
  const desde = new Date(agora.getTime() - JANELA_DIAS * DIA_MS).toISOString();

  // Em andamento: busca manual aguardando ou rodando, ou qualquer job ativo (a varredura semanal também bloqueia)
  const [contadas, emAndamentoRow, ultima] = await Promise.all([
    executor.execute(sql`SELECT iniciada_em FROM buscas_editais WHERE status != 'erro' AND iniciada_em >= ${desde} ORDER BY iniciada_em ASC`),
    executor.execute(sql`SELECT 1 WHERE EXISTS (SELECT 1 FROM buscas_editais WHERE status IN ('pendente', 'em_andamento')) OR EXISTS (SELECT 1 FROM jobs WHERE status IN ('PENDENTE', 'RODANDO'))`),
    executor.execute(sql`SELECT iniciada_em, status, novos, ja_existentes FROM buscas_editais ORDER BY iniciada_em DESC LIMIT 1`),
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

export type InicioBuscaManual =
  | { ok: true; jobId: string; buscaId: number }
  | { ok: false; motivo: 'limite' | 'em_andamento'; situacao: SituacaoBusca };

/** Lê o id devolvido por INSERT ... RETURNING id, sem assumir o formato do driver. */
function idDaPrimeiraLinha(linhas: unknown): number | null {
  if (!Array.isArray(linhas) || linhas.length === 0) return null;
  const primeira: unknown = linhas[0];
  if (typeof primeira !== 'object' || primeira === null) return null;
  const campos: Record<string, unknown> = { ...primeira };
  return typeof campos.id === 'number' ? campos.id : null;
}

/** Chave do pg_advisory_xact_lock que serializa o início de buscas manuais. */
const LOCK_INICIO_BUSCA = 'busca_manual_inicio';

/**
 * Enfileira uma busca manual: confere limite e situação e cria o job (PENDENTE) e a linha da busca
 * (status 'pendente') na mesma transação. O lock serializa as tentativas; o índice único de jobs
 * continua sendo a trava final (conflito vira 'em_andamento').
 */
export async function iniciarBuscaManualAsync(agora = new Date()): Promise<InicioBuscaManual> {
  try {
    return await db.transaction(async (tx: Consulta) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${LOCK_INICIO_BUSCA}))`);
      const situacao = await situacaoDaBuscaAsync(agora, tx);
      if (situacao.emAndamento) return { ok: false as const, motivo: 'em_andamento' as const, situacao };
      if (situacao.restantes <= 0) return { ok: false as const, motivo: 'limite' as const, situacao };

      const jobId = crypto.randomUUID();
      await new JobRepository(tx).enfileirar(jobId, TipoJob.BUSCA_MANUAL);
      const iso = agora.toISOString();
      const linhas = await tx.execute(sql`INSERT INTO buscas_editais (iniciada_em, atualizada_em, status, job_id) VALUES (${iso}, ${iso}, 'pendente', ${jobId}) RETURNING id`);
      const buscaId = idDaPrimeiraLinha(linhas);
      if (buscaId === null) throw new Error('Não foi possível registrar a busca manual');
      return { ok: true as const, jobId, buscaId };
    });
  } catch (erro) {
    if (ehConflitoDeFila(erro)) {
      return { ok: false, motivo: 'em_andamento', situacao: await situacaoDaBuscaAsync(agora) };
    }
    throw erro;
  }
}

export async function finalizarBuscaAsync(id: number, stats: EstatisticasBusca, falhou = false, agora = new Date()) {
  await (db as any).execute(
    sql`UPDATE buscas_editais SET status = ${falhou ? 'erro' : 'concluida'}, concluida_em = ${agora.toISOString()}, novos = ${stats.novos}, ja_existentes = ${stats.jaExistentes}, descartados = ${stats.descartados}, com_erro = ${stats.comErro}, mensagem = ${stats.mensagem ?? null} WHERE id = ${id}`
  );
}

/** Linha da busca criada para um job de busca manual. */
export async function buscaDoJobAsync(jobId: string): Promise<{ id: number } | null> {
  const [busca] = await db.select({ id: buscasEditais.id }).from(buscasEditais).where(eq(buscasEditais.jobId, jobId)).limit(1);
  return busca ?? null;
}

/** O worker começou a executar a busca: 'pendente' vira 'em_andamento'. */
export async function iniciarExecucaoBuscaAsync(id: number, agora = new Date()) {
  await db.update(buscasEditais)
    .set({ status: 'em_andamento', atualizadaEm: agora.toISOString() })
    .where(eq(buscasEditais.id, id));
}

/**
 * Encerra o que ficou preso, em um só lugar: busca em andamento sem heartbeat (Interrompida),
 * job RODANDO sem heartbeat (erro) e job PENDENTE sem worker (Worker indisponível).
 * A busca de um job pendente vencido vira 'erro', e erro não conta no limite semanal.
 */
export async function recuperarOrfaosAsync(executor: Consulta = db, agora = new Date()) {
  await marcarInterrompidasAsync(executor, agora);
  const limitePendente = new Date(agora.getTime() - TEMPO_PENDENTE_MS).toISOString();
  await executor.execute(sql`UPDATE buscas_editais SET status = 'erro', concluida_em = ${agora.toISOString()}, mensagem = ${MENSAGEM_WORKER_INDISPONIVEL} WHERE status = 'pendente' AND job_id IN (SELECT id FROM jobs WHERE status = 'PENDENTE' AND iniciado_em < ${limitePendente})`);
  const repositorio = new JobRepository(executor);
  await repositorio.encerrarOrfaos(TEMPO_SEM_ATUALIZACAO_MS, agora);
  await repositorio.encerrarPendentesVencidos(TEMPO_PENDENTE_MS, agora);
}

/** Heartbeat da busca manual, disparado pelo heartbeat do job. */
export async function batidaBuscaPorJobAsync(jobId: string, agora = new Date()) {
  await db.update(buscasEditais)
    .set({ atualizadaEm: agora.toISOString() })
    .where(and(eq(buscasEditais.jobId, jobId), eq(buscasEditais.status, 'em_andamento')));
}

/** Edital que já foi baixado ou avaliado antes: não precisa baixar de novo. */
export function editalJaProcessado(e: { pdfSalvoEm?: string | null; statusAnalise?: string | null }): boolean {
  if (e.pdfSalvoEm) return true;
  return ['analisado', 'pdf_baixado', 'descartado', 'duvida', 'sem_pdf'].includes(e.statusAnalise ?? '');
}
