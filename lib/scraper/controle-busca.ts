import type Database from 'better-sqlite3';

/** Quantas buscas por novos editais podem ser iniciadas dentro da janela abaixo. */
export const LIMITE_BUSCAS = 2;
/** Janela móvel (dias). */
export const JANELA_DIAS = 7;
/** Uma busca "em andamento" há mais tempo que isso é considerada interrompida. */
const TEMPO_MAXIMO_MS = 2 * 60 * 60 * 1000;

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

function marcarInterrompidas(sqlite: Database.Database, agora: Date) {
  sqlite
    .prepare(`UPDATE buscas_editais SET status = 'erro', concluida_em = ?, mensagem = 'Interrompida' WHERE status = 'em_andamento' AND iniciada_em < ?`)
    .run(agora.toISOString(), new Date(agora.getTime() - TEMPO_MAXIMO_MS).toISOString());
}

export function situacaoDaBusca(sqlite: Database.Database, agora = new Date()): SituacaoBusca {
  marcarInterrompidas(sqlite, agora);
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
  // O limite volta quando a busca mais antiga da janela sai dela
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
export function iniciarBusca(sqlite: Database.Database, agora = new Date()): InicioBusca {
  const tentar = sqlite.transaction((): InicioBusca => {
    const situacao = situacaoDaBusca(sqlite, agora);
    if (situacao.emAndamento) return { ok: false, motivo: 'em_andamento', situacao };
    if (situacao.restantes <= 0) return { ok: false, motivo: 'limite', situacao };
    const r = sqlite.prepare(`INSERT INTO buscas_editais (iniciada_em, status) VALUES (?, 'em_andamento')`).run(agora.toISOString());
    return { ok: true, id: Number(r.lastInsertRowid) };
  });
  return tentar.immediate();
}

export function finalizarBusca(sqlite: Database.Database, id: number, stats: EstatisticasBusca, falhou = false, agora = new Date()) {
  sqlite
    .prepare(`UPDATE buscas_editais SET status = ?, concluida_em = ?, novos = ?, ja_existentes = ?, descartados = ?, com_erro = ?, mensagem = ? WHERE id = ?`)
    .run(falhou ? 'erro' : 'concluida', agora.toISOString(), stats.novos, stats.jaExistentes, stats.descartados, stats.comErro, stats.mensagem ?? null, id);
}

/** Edital que já foi baixado ou avaliado antes: não precisa baixar de novo. */
export function editalJaProcessado(e: { pdfSalvoEm?: string | null; statusAnalise?: string | null }): boolean {
  if (e.pdfSalvoEm) return true;
  return ['analisado', 'pdf_baixado', 'descartado', 'duvida', 'sem_pdf'].includes(e.statusAnalise ?? '');
}
