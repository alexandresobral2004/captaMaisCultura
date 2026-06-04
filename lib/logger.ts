import { db } from './database/db';
import { logsSistema } from './database/schema';
import { eq, desc, and, gte, lte, like, or, sql } from 'drizzle-orm';

export type LogNivel = 'error' | 'warning' | 'info';

export type LogAcao = 'retry' | 'mark_error' | 'human_review' | 'skip' | 'fallback' | 'ignore';

export type LogCenarioFalha =
  | 'autenticacao_prosas'
  | 'autenticacao_capta'
  | 'busca_portal'
  | 'download_pdf'
  | 'pdf_nao_encontrado'
  | 'pdf_corrompido'
  | 'extraction_llamaparse'
  | 'extraction_pdf_parse'
  | 'analise_ia'
  | 'classificacao_ia'
  | 'validacao_whitelist'
  | 'validacao_blacklist'
  | 'api_openai'
  | 'api_tavily'
  | 'salvar_banco'
  | 'session_expired'
  | 'rate_limit'
  | 'network_error'
  | 'timeout'
  | 'parse_error'
  | 'schema_validation'
  | 'file_not_found'
  | 'permission_denied'
  | 'unknown';

export const ACAO_LABELS: Record<LogAcao, string> = {
  retry: 'Repetir',
  mark_error: 'Marcar como erro',
  human_review: 'Revisão humana',
  skip: 'Pular',
  fallback: 'Usar alternativa',
  ignore: 'Ignorar',
};

export const CENARIO_LABELS: Record<LogCenarioFalha, string> = {
  autenticacao_prosas: 'Autenticação Prosas',
  autenticacao_capta: 'Autenticação Capta',
  busca_portal: 'Busca no Portal',
  download_pdf: 'Download de PDF',
  pdf_nao_encontrado: 'PDF Não Encontrado',
  pdf_corrompido: 'PDF Corrompido',
  extraction_llamaparse: 'Extração LlamaParse',
  extraction_pdf_parse: 'Extração pdf-parse',
  analise_ia: 'Análise IA',
  classificacao_ia: 'Classificação IA',
  validacao_whitelist: 'Validação Whitelist',
  validacao_blacklist: 'Validação Blacklist',
  api_openai: 'API OpenAI',
  api_tavily: 'API Tavily',
  salvar_banco: 'Salvar no Banco',
  session_expired: 'Sessão Expirada',
  rate_limit: 'Rate Limit',
  network_error: 'Erro de Rede',
  timeout: 'Timeout',
  parse_error: 'Erro de Parsing',
  schema_validation: 'Validação de Schema',
  file_not_found: 'Arquivo Não Encontrado',
  permission_denied: 'Permissão Negada',
  unknown: 'Desconhecido',
};

export interface LogEntry {
  nivel: LogNivel;
  mensagem: string;
  cenarioFalha?: LogCenarioFalha;
  acaoTomada?: LogAcao;
  repeticoes?: number;
  contexto?: string;
  caminho?: string;
  detalhes?: any;
  usuarioId?: string;
  ip?: string;
  userAgent?: string;
}

export interface LogFilters {
  nivel?: LogNivel | 'todos';
  cenario?: LogCenarioFalha | 'todos';
  acao?: LogAcao | 'todos';
  dataIni?: string;
  dataFim?: string;
  busca?: string;
  page?: number;
  limit?: number;
}

export interface LogStats {
  total: number;
  erros: number;
  warnings: number;
  infos: number;
  ultimoErro: string | null;
  porCenario?: Record<string, number>;
  porAcao?: Record<string, number>;
}

export interface LogEntryDisplay extends LogEntry {
  id: number;
  criadoEm: string;
}

class SystemLogger {
  private initialized = false;

  private init() {
    if (this.initialized) return;
    this.initialized = true;
  }

  async log(entry: LogEntry): Promise<number> {
    this.init();

    try {
      const result = await db.insert(logsSistema).values({
        nivel: entry.nivel,
        mensagem: entry.mensagem,
        cenarioFalha: entry.cenarioFalha || null,
        acaoTomada: entry.acaoTomada || null,
        repeticoes: entry.repeticoes || 0,
        contexto: entry.contexto || null,
        caminho: entry.caminho || null,
        detalhes: entry.detalhes ? JSON.stringify(entry.detalhes) : null,
        usuarioId: entry.usuarioId || null,
        ip: entry.ip || null,
        userAgent: entry.userAgent || null,
        criadoEm: new Date().toISOString(),
      }).returning({ id: logsSistema.id });

      return result[0]?.id || 0;
    } catch (error) {
      console.error('[Logger] Erro ao salvar log:', error);
      return 0;
    }
  }

  async logError(
    mensagem: string,
    cenarioFalha: LogCenarioFalha,
    acaoTomada: LogAcao,
    detalhes?: any
  ): Promise<number> {
    return this.log({
      nivel: 'error',
      mensagem,
      cenarioFalha,
      acaoTomada,
      detalhes,
    });
  }

  async logWarning(
    mensagem: string,
    cenarioFalha?: LogCenarioFalha,
    acaoTomada?: LogAcao,
    detalhes?: any
  ): Promise<number> {
    return this.log({
      nivel: 'warning',
      mensagem,
      cenarioFalha,
      acaoTomada,
      detalhes,
    });
  }

  async logInfo(
    mensagem: string,
    contexto?: string,
    caminho?: string,
    detalhes?: any
  ): Promise<number> {
    return this.log({
      nivel: 'info',
      mensagem,
      contexto,
      caminho,
      detalhes,
    });
  }

  async logRetry(
    mensagem: string,
    cenarioFalha: LogCenarioFalha,
    repeticoes: number,
    detalhes?: any
  ): Promise<number> {
    return this.log({
      nivel: 'warning',
      mensagem,
      cenarioFalha,
      acaoTomada: 'retry',
      repeticoes,
      detalhes,
    });
  }

  async getLogs(filters: LogFilters = {}): Promise<LogEntryDisplay[]> {
    this.init();

    const {
      nivel = 'todos',
      cenario = 'todos',
      acao = 'todos',
      dataIni,
      dataFim,
      busca,
      page = 1,
      limit = 20
    } = filters;

    const conditions = [];

    if (nivel && nivel !== 'todos') {
      conditions.push(eq(logsSistema.nivel, nivel));
    }

    if (cenario && cenario !== 'todos') {
      conditions.push(eq(logsSistema.cenarioFalha, cenario));
    }

    if (acao && acao !== 'todos') {
      conditions.push(eq(logsSistema.acaoTomada, acao));
    }

    if (dataIni) {
      conditions.push(gte(logsSistema.criadoEm, dataIni));
    }

    if (dataFim) {
      conditions.push(lte(logsSistema.criadoEm, dataFim + 'T23:59:59'));
    }

    if (busca && busca.trim()) {
      conditions.push(
        or(
          like(logsSistema.mensagem, `%${busca}%`),
          like(logsSistema.contexto || '', `%${busca}%`),
          like(logsSistema.caminho || '', `%${busca}%`)
        )
      );
    }

    const offset = (page - 1) * limit;

    try {
      const query = db.select()
        .from(logsSistema)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(logsSistema.criadoEm))
        .limit(limit)
        .offset(offset);

      const results = await query;

      return results.map((r) => {
        const row = r as {
          id: number;
          nivel: string;
          mensagem: string;
          cenarioFalha: string | null;
          acaoTomada: string | null;
          repeticoes: number | null;
          contexto: string | null;
          caminho: string | null;
          detalhes: string | null;
          usuarioId: string | null;
          ip: string | null;
          userAgent: string | null;
          criadoEm: string;
        };
        return {
          id: row.id,
          nivel: row.nivel as LogNivel,
          mensagem: row.mensagem,
          cenarioFalha: row.cenarioFalha as LogCenarioFalha | undefined,
          acaoTomada: row.acaoTomada as LogAcao | undefined,
          repeticoes: row.repeticoes ?? 0,
          contexto: row.contexto ?? undefined,
          caminho: row.caminho ?? undefined,
          detalhes: row.detalhes ? this.safeJsonParse(row.detalhes) : null,
          usuarioId: row.usuarioId ?? undefined,
          ip: row.ip ?? undefined,
          userAgent: row.userAgent ?? undefined,
          criadoEm: row.criadoEm,
        };
      });
    } catch (error) {
      console.error('[Logger] Erro ao buscar logs:', error);
      return [];
    }
  }

  async getStats(): Promise<LogStats> {
    this.init();

    try {
      const totalResult = await db.select({ count: sql<number>`COUNT(*)` }).from(logsSistema);
      const errosResult = await db.select({ count: sql<number>`COUNT(*)` }).from(logsSistema).where(eq(logsSistema.nivel, 'error'));
      const warningsResult = await db.select({ count: sql<number>`COUNT(*)` }).from(logsSistema).where(eq(logsSistema.nivel, 'warning'));
      const infosResult = await db.select({ count: sql<number>`COUNT(*)` }).from(logsSistema).where(eq(logsSistema.nivel, 'info'));

      const ultimoErroResult = await db.select({ criadoEm: logsSistema.criadoEm })
        .from(logsSistema)
        .where(eq(logsSistema.nivel, 'error'))
        .orderBy(desc(logsSistema.criadoEm))
        .limit(1);

      const porCenarioResult = await db.select({
        cenario: logsSistema.cenarioFalha,
        count: sql<number>`COUNT(*)`
      })
        .from(logsSistema)
        .where(sql`${logsSistema.cenarioFalha} IS NOT NULL`)
        .groupBy(logsSistema.cenarioFalha);

      const porAcaoResult = await db.select({
        acao: logsSistema.acaoTomada,
        count: sql<number>`COUNT(*)`
      })
        .from(logsSistema)
        .where(sql`${logsSistema.acaoTomada} IS NOT NULL`)
        .groupBy(logsSistema.acaoTomada);

      const porCenario: Record<string, number> = {};
      porCenarioResult.forEach(r => {
        if (r.cenario) porCenario[r.cenario] = r.count;
      });

      const porAcao: Record<string, number> = {};
      porAcaoResult.forEach(r => {
        if (r.acao) porAcao[r.acao] = r.count;
      });

      return {
        total: totalResult[0]?.count || 0,
        erros: errosResult[0]?.count || 0,
        warnings: warningsResult[0]?.count || 0,
        infos: infosResult[0]?.count || 0,
        ultimoErro: ultimoErroResult[0]?.criadoEm || null,
        porCenario,
        porAcao,
      };
    } catch (error) {
      console.error('[Logger] Erro ao buscar stats:', error);
      return { total: 0, erros: 0, warnings: 0, infos: 0, ultimoErro: null };
    }
  }

  async getTotalCount(filters: LogFilters = {}): Promise<number> {
    this.init();

    const { nivel = 'todos', cenario = 'todos', acao = 'todos', dataIni, dataFim, busca } = filters;
    const conditions = [];

    if (nivel && nivel !== 'todos') {
      conditions.push(eq(logsSistema.nivel, nivel));
    }

    if (cenario && cenario !== 'todos') {
      conditions.push(eq(logsSistema.cenarioFalha, cenario));
    }

    if (acao && acao !== 'todos') {
      conditions.push(eq(logsSistema.acaoTomada, acao));
    }

    if (dataIni) {
      conditions.push(gte(logsSistema.criadoEm, dataIni));
    }

    if (dataFim) {
      conditions.push(lte(logsSistema.criadoEm, dataFim + 'T23:59:59'));
    }

    if (busca && busca.trim()) {
      conditions.push(
        or(
          like(logsSistema.mensagem, `%${busca}%`),
          like(logsSistema.contexto || '', `%${busca}%`),
          like(logsSistema.caminho || '', `%${busca}%`)
        )
      );
    }

    try {
      const result = await db.select({ count: sql<number>`COUNT(*)` })
        .from(logsSistema)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      return result[0]?.count || 0;
    } catch (error) {
      console.error('[Logger] Erro ao contar logs:', error);
      return 0;
    }
  }

  async clearLogs(olderThanDays?: number): Promise<number> {
    this.init();

    try {
      if (olderThanDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        const cutoffStr = cutoffDate.toISOString();

        const result = await db.delete(logsSistema)
          .where(lte(logsSistema.criadoEm, cutoffStr));

        return result.changes || 0;
      } else {
        const result = await db.delete(logsSistema);
        return result.changes || 0;
      }
    } catch (error) {
      console.error('[Logger] Erro ao limpar logs:', error);
      return 0;
    }
  }

  private safeJsonParse(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }

  formatLogForDisplay(log: LogEntryDisplay): string {
    const date = new Date(log.criadoEm).toLocaleString('pt-BR');
    const nivel = log.nivel.toUpperCase().padEnd(7);
    const cenario = log.cenarioFalha ? ` [${CENARIO_LABELS[log.cenarioFalha] || log.cenarioFalha}]` : '';
    const acao = log.acaoTomada ? ` → ${ACAO_LABELS[log.acaoTomada] || log.acaoTomada}` : '';
    return `[${date}] [${nivel}]${cenario} ${log.mensagem}${acao}`;
  }
}

export const logger = new SystemLogger();