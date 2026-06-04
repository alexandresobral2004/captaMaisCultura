/**
 * audit-logger.ts
 *
 * Módulo central de auditoria de decisões do filtro de TI.
 * Persiste motivos de forma rastreável e legível por humanos
 * na tabela `motivos_pontuacao`, diferenciando por fonte:
 *   - 'whitelist'  → termos TI encontrados e categoria ativada
 *   - 'blacklist'  → termos indesejados detectados, score negativo
 *   - 'ia'         → resultado da classificação OpenAI
 *   - 'fallback'   → IA falhou, edital encaminhado para revisão
 *   - 'decisao'    → decisão consolidada do pipeline
 *
 * CONTRATO DE ROBUSTEZ
 * ─────────────────────
 * Toda função neste módulo é `fire-and-forget`:
 *   - retorna void (não é awaitable no pipeline)
 *   - captura qualquer exceção internamente
 *   - nunca lança erro para o chamador
 *   - só persiste em ambiente server-side (Node.js)
 */

import type { BlacklistResult } from './blacklist-engine';
import { db } from '@/lib/database/db';
import { motivosPontuacao } from '@/lib/database/schema';
import { eq, and } from 'drizzle-orm';

// ─── Tipos de entrada ────────────────────────────────────────────────────────

export interface WhitelistAuditPayload {
  /** Categoria identificada (ex: 'Tecnologia TI', 'Pesquisa & Academia') */
  categoria?: string;
  /** Nível de confiança da validação */
  confianca: 'alta' | 'média' | 'baixa';
  /** Termos da whitelist que ativaram a validação */
  termosEncontrados: string[];
  /** Score positivo parcial gerado por esse resultado */
  scoreParcial?: number;
}

export interface BlacklistAuditPayload {
  /** Resultado completo do motor de blacklist */
  resultado: BlacklistResult;
  /** Score total do edital no momento da avaliação */
  scoreFinal?: number;
}

export interface IAAuditPayload {
  /** Modelo usado (ex: 'gpt-4o-mini') */
  modelo: string;
  /** Tecnologia classificada */
  tecnologia?: string;
  /** Tipo de ferramenta classificada */
  tipoFerramenta?: string;
  /** Score de relevância (0-100) */
  score?: number;
  /** Confiança da classificação (0-100) */
  confianca?: number;
  /** Razão da decisão */
  razao?: string;
  /** Score total do edital no momento da classificação */
  scoreFinal?: number;
}

export interface FallbackDuvidaPayload {
  /** Tipo do erro: timeout | rate_limit | auth | parse | unknown */
  erroTipo: 'timeout' | 'rate_limit' | 'auth' | 'parse' | 'unknown';
  /** Mensagem de erro original */
  mensagem: string;
  /** Modelo que falhou */
  modelo: string;
}

export interface DecisaoFinalPayload {
  /** Decisão: aprovado | rejeitado | duvida */
  decisao: 'aprovado' | 'rejeitado' | 'duvida';
  /** Score final do edital */
  scoreFinal?: number;
  /** Fontes que contribuíram para a decisão */
  fontes: Array<'whitelist' | 'blacklist' | 'ia' | 'fallback'>;
  /** Detalhe adicional (conflito, motivo principal, etc.) */
  detalhe?: string;
}

// ─── Helper interno de persistência ─────────────────────────────────────────

interface MotivoPersistidoParams {
  editalId: string;
  motivo: string;
  fonte: 'whitelist' | 'blacklist' | 'ia' | 'fallback' | 'decisao';
  scoreParcial?: number;
  scoreFinal?: number;
  detalhes?: Record<string, unknown>;
}

async function persistirMotivo(params: MotivoPersistidoParams): Promise<void> {
  // Só persiste em server-side; em ambiente de build/edge, silencia
  if (typeof window !== 'undefined') return;

  try {
    await db.insert(motivosPontuacao).values({
      editalId: params.editalId,
      motivo: params.motivo,
      fonte: params.fonte as any,
      scoreParcial: params.scoreParcial ?? null,
      scoreFinal: params.scoreFinal ?? null,
      detalhes: params.detalhes ? JSON.stringify(params.detalhes) : null,
    });
  } catch (err) {
    // Nunca quebra o pipeline — apenas registra no console
    console.warn(
      `[AuditLogger] Falha ao persistir motivo para edital '${params.editalId}': ${(err as Error).message}`
    );
  }
}

/** Persiste vários motivos em paralelo, sem esperar conclusão */
function persistirMotivos(motivos: MotivoPersistidoParams[]): void {
  if (!motivos.length) return;
  Promise.all(motivos.map(persistirMotivo)).catch((err) => {
    console.warn('[AuditLogger] Erro em lote de persistência:', (err as Error).message);
  });
}

// ─── API Pública ─────────────────────────────────────────────────────────────

/**
 * Registra o resultado da validação de Whitelist.
 *
 * Exemplo de motivo gerado:
 *   "Whitelist: categoria 'Tecnologia TI' ativada por termos [aprendizado de máquina, IA] — confiança alta"
 */
export function registrarMotivoWhitelist(
  editalId: string,
  payload: WhitelistAuditPayload
): void {
  const termosList = payload.termosEncontrados.slice(0, 5).join(', ');
  const termosExtra = payload.termosEncontrados.length > 5
    ? ` (+${payload.termosEncontrados.length - 5} outros)`
    : '';
  const categoriaStr = payload.categoria ? `'${payload.categoria}'` : 'não identificada';

  const motivo = `Whitelist: categoria ${categoriaStr} ativada por termos [${termosList}${termosExtra}] — confiança ${payload.confianca}`;

  persistirMotivos([{
    editalId,
    motivo,
    fonte: 'whitelist',
    scoreParcial: payload.scoreParcial,
    detalhes: {
      categoria: payload.categoria,
      confianca: payload.confianca,
      termosEncontrados: payload.termosEncontrados,
    },
  }]);
}

/**
 * Registra o resultado da análise de Blacklist.
 *
 * Exemplos de motivos gerados:
 *   "Blacklist: termo 'saúde bucal' penalizou score em -15 pontos (1 ocorrência)"
 *   "Blacklist: severidade alta — bloqueio recomendado (score -50)"
 *   "Blacklist: sem termos indesejados detectados"
 */
export function registrarMotivoBlacklist(
  editalId: string,
  payload: BlacklistAuditPayload
): void {
  const { resultado, scoreFinal } = payload;

  if (resultado.scoreNegativo === 0) {
    persistirMotivos([{
      editalId,
      motivo: 'Blacklist: nenhum termo indesejado detectado',
      fonte: 'blacklist',
      scoreParcial: 0,
      scoreFinal,
      detalhes: { scoreNegativo: 0, termosEncontrados: [] },
    }]);
    return;
  }

  const motivosDetalhados: MotivoPersistidoParams[] = resultado.termosEncontrados.map((t) => ({
    editalId,
    motivo: `Blacklist: termo '${t.termo}' penalizou score em -${t.peso} pontos (${t.ocorrencias}x)${t.contexto ? ` — ${t.contexto}` : ''}`,
    fonte: 'blacklist' as const,
    scoreParcial: -t.peso,
    scoreFinal,
    detalhes: {
      termo: t.termo,
      ocorrencias: t.ocorrencias,
      peso: t.peso,
      contexto: t.contexto,
      severidade: resultado.severidade,
      recomendacao: resultado.recomendacao,
    },
  }));

  // Motivo consolidado de recomendação (se relevante)
  if (resultado.recomendacao !== 'penalizar') {
    motivosDetalhados.push({
      editalId,
      motivo: `Blacklist: severidade ${resultado.severidade} — recomendação de ${resultado.recomendacao} (score acumulado -${resultado.scoreNegativo})`,
      fonte: 'blacklist' as const,
      scoreParcial: -resultado.scoreNegativo,
      scoreFinal,
      detalhes: {
        scoreNegativo: resultado.scoreNegativo,
        severidade: resultado.severidade,
        recomendacao: resultado.recomendacao,
        totalTermos: resultado.termosEncontrados.length,
      },
    });
  }

  persistirMotivos(motivosDetalhados);
}

/**
 * Registra o resultado bem-sucedido da classificação por IA (OpenAI).
 *
 * Exemplo de motivo gerado:
 *   "OpenAI (gpt-4o-mini): válido — categoria 'IA & Machine Learning', confiança 87%, score 82"
 *   "OpenAI (gpt-4o-mini): inválido — 'Edital fora do escopo de TI'"
 */
export function registrarMotivoIA(
  editalId: string,
  valido: boolean,
  payload: IAAuditPayload
): void {
  let motivo: string;

  if (valido) {
    const tecnologiaStr = payload.tecnologia ? `'${payload.tecnologia}'` : 'não classificada';
    motivo = `OpenAI (${payload.modelo}): válido — categoria ${tecnologiaStr}` +
      (payload.score !== undefined ? `, score ${payload.score}` : '') +
      (payload.confianca !== undefined ? `, confiança ${payload.confianca}%` : '');
  } else {
    motivo = `OpenAI (${payload.modelo}): inválido — ${payload.razao || 'fora do escopo de TI'}`;
  }

  persistirMotivos([{
    editalId,
    motivo,
    fonte: 'ia',
    scoreParcial: payload.score,
    scoreFinal: payload.scoreFinal,
    detalhes: {
      modelo: payload.modelo,
      valido,
      tecnologia: payload.tecnologia,
      tipoFerramenta: payload.tipoFerramenta,
      score: payload.score,
      confianca: payload.confianca,
      razao: payload.razao,
    },
  }]);
}

/**
 * Registra quando a IA falhou e o edital foi marcado como dúvida (fallback controlado).
 *
 * Exemplos de motivos gerados:
 *   "OpenAI: classificação indisponível por timeout — edital marcado para revisão humana"
 *   "OpenAI: classificação indisponível por rate limit — edital marcado para revisão humana"
 *   "OpenAI: classificação indisponível por auth — chave de API inválida ou ausente"
 */
export function registrarMotivoFallbackDuvida(
  editalId: string,
  payload: FallbackDuvidaPayload
): void {
  const tipoMsg: Record<FallbackDuvidaPayload['erroTipo'], string> = {
    timeout: 'timeout na chamada à API (>10s)',
    rate_limit: 'rate limit atingido na API da OpenAI',
    auth: 'falha de autenticação — chave de API inválida ou ausente',
    parse: 'resposta inválida retornada pela API (parse error)',
    unknown: 'erro desconhecido na chamada à API',
  };

  const motivo = `OpenAI (${payload.modelo}): classificação indisponível por ${tipoMsg[payload.erroTipo]} — edital marcado para revisão humana`;

  persistirMotivos([{
    editalId,
    motivo,
    fonte: 'fallback',
    detalhes: {
      erroTipo: payload.erroTipo,
      mensagem: payload.mensagem,
      modelo: payload.modelo,
    },
  }]);
}

/**
 * Registra a decisão final consolidada do pipeline de filtros.
 *
 * Exemplos de motivos gerados:
 *   "DecisionEngine: aprovado (score 78) — fontes: whitelist, ia"
 *   "DecisionEngine: rejeitado (score 20) — fontes: whitelist, blacklist — blacklist recomendou bloqueio"
 *   "DecisionEngine: conflito entre whitelist forte e blacklist média → encaminhado para revisão humana"
 */
export function registrarDecisaoFinal(
  editalId: string,
  payload: DecisaoFinalPayload
): void {
  const fontesStr = payload.fontes.join(', ');
  const scoreStr = payload.scoreFinal !== undefined ? ` (score ${payload.scoreFinal})` : '';
  const detalheStr = payload.detalhe ? ` — ${payload.detalhe}` : '';

  const motivo = `DecisionEngine: ${payload.decisao}${scoreStr} — fontes: ${fontesStr}${detalheStr}`;

  persistirMotivos([{
    editalId,
    motivo,
    fonte: 'decisao',
    scoreFinal: payload.scoreFinal,
    detalhes: {
      decisao: payload.decisao,
      fontes: payload.fontes,
      detalhe: payload.detalhe,
    },
  }]);
}

/**
 * Registra um motivo de conflito entre whitelist e blacklist.
 *
 * Exemplo de motivo gerado:
 *   "DecisionEngine: conflito entre whitelist forte e blacklist média → revisão humana"
 */
export function registrarConflito(
  editalId: string,
  whitelistConfianca: 'alta' | 'média' | 'baixa',
  blacklistSeveridade: 'alta' | 'media' | 'baixa',
  scoreFinal?: number
): void {
  const motivo = `DecisionEngine: conflito entre whitelist ${whitelistConfianca} e blacklist ${blacklistSeveridade} → encaminhado para revisão humana`;

  persistirMotivos([{
    editalId,
    motivo,
    fonte: 'decisao',
    scoreFinal,
    detalhes: {
      conflito: true,
      whitelistConfianca,
      blacklistSeveridade,
    },
  }]);
}

/**
 * Consulta todos os motivos de um edital, opcionalmente filtrados por fonte.
 * Útil para dashboard e tela de revisão.
 *
 * Retorna [] se o edital não tiver motivos ou em caso de erro.
 */
export async function consultarMotivos(
  editalId: string,
  fonte?: 'whitelist' | 'blacklist' | 'ia' | 'fallback' | 'decisao'
): Promise<Array<{
  id: number;
  motivo: string;
  fonte: string;
  scoreParcial: number | null;
  scoreFinal: number | null;
  detalhes: Record<string, unknown> | null;
  criadoEm: string | null;
}>> {
  if (typeof window !== 'undefined') return [];

  try {
    const where = fonte
      ? and(eq(motivosPontuacao.editalId, editalId), eq(motivosPontuacao.fonte, fonte as any))
      : eq(motivosPontuacao.editalId, editalId);

    const rows = await db
      .select()
      .from(motivosPontuacao)
      .where(where)
      .orderBy(motivosPontuacao.id);

    return rows.map((r) => ({
      id: r.id,
      motivo: r.motivo,
      fonte: r.fonte,
      scoreParcial: r.scoreParcial ?? null,
      scoreFinal: r.scoreFinal ?? null,
      detalhes: r.detalhes ? (() => { try { return JSON.parse(r.detalhes!); } catch { return null; } })() : null,
      criadoEm: r.criadoEm ?? null,
    }));
  } catch (err) {
    console.warn(`[AuditLogger] Falha ao consultar motivos do edital '${editalId}': ${(err as Error).message}`);
    return [];
  }
}
