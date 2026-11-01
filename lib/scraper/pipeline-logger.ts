import { randomUUID as uuidv4 } from 'crypto';
import { db } from '../database/db';
import { logsSistema } from '../database/schema';

/** No máximo uma gravação em lote por este intervalo. */
const INTERVALO_GRAVACAO_MS = 1000;

export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'step';

export interface PipelineLogEvent {
  id: string;
  ts: string;
  level: LogLevel;
  phase: 'busca' | 'whitelist' | 'blacklist' | 'ia' | 'pipeline' | 'resultado';
  editalId?: string;
  editalTitulo?: string;
  message: string;
  detail?: string;
  termosEncontrados?: string[];
  scoreNegativo?: number;
  scoreIA?: number;
}

type LinhaLog = typeof logsSistema.$inferInsert;

/** Nome e código do erro, sem a mensagem (que pode carregar dados). */
function resumoDoErro(erro: unknown): { nome: string; codigo: unknown } {
  const nome = erro instanceof Error ? erro.name : 'desconhecido';
  const codigo = typeof erro === 'object' && erro !== null && 'code' in erro ? erro.code : undefined;
  return { nome, codigo };
}

class PipelineLogger {
  private jobAtual: string | null = null;
  private pendentes: LinhaLog[] = [];
  private agendado: ReturnType<typeof setTimeout> | null = null;
  private ultimaGravacao = 0;
  /** Gravações em fila: uma por vez, na ordem em que foram disparadas. Nunca rejeita. */
  private gravando: Promise<void> = Promise.resolve();
  /** Verdadeiro enquanto a falha de gravação é reportada no console: não pode virar evento do pipeline. */
  private reportandoFalha = false;
  private emit(event: Omit<PipelineLogEvent, 'id' | 'ts'>) {
    const fullEvent: PipelineLogEvent = {
      ...event,
      id: uuidv4(),
      ts: new Date().toISOString(),
    };

    this.enfileirar(fullEvent);
  }

  /** Eventos seguintes ficam ligados a este job (o worker roda um job por vez). */
  iniciarJob(jobId: string) {
    this.jobAtual = jobId;
  }

  private enfileirar(evento: PipelineLogEvent) {
    if (this.reportandoFalha) return;
    this.pendentes.push({
      nivel: evento.level === 'error' ? 'error' : evento.level === 'warning' ? 'warning' : 'info',
      mensagem: evento.message,
      contexto: 'pipeline',
      detalhes: JSON.stringify({ ...evento, jobId: this.jobAtual }),
      criadoEm: evento.ts,
    });
    if (this.agendado === null) {
      // Espera ao menos o intervalo: junta os eventos da janela num lote só
      const espera = Math.max(INTERVALO_GRAVACAO_MS, this.ultimaGravacao + INTERVALO_GRAVACAO_MS - Date.now());
      this.agendado = setTimeout(() => {
        this.agendado = null;
        void this.gravarPendentes();
      }, espera);
    }
  }

  /** Grava já o que está na fila (fim da busca), respeitando o intervalo mínimo entre gravações. */
  async descarregar(): Promise<void> {
    if (this.pendentes.length > 0) {
      if (this.agendado !== null) {
        clearTimeout(this.agendado);
        this.agendado = null;
      }
      const espera = this.ultimaGravacao + INTERVALO_GRAVACAO_MS - Date.now();
      if (espera > 0) await new Promise((resolve) => setTimeout(resolve, espera));
      this.gravarPendentes();
    }
    // Espera a fila inteira, inclusive gravações já em curso
    await this.gravando;
  }

  /** Tira da fila o que está pendente e o põe no fim da cadeia de gravação. */
  private gravarPendentes(): Promise<void> {
    if (this.pendentes.length === 0) return this.gravando;
    const lote = this.pendentes;
    this.pendentes = [];
    this.gravando = this.gravando.then(() => this.gravarLote(lote));
    return this.gravando;
  }

  private async gravarLote(lote: LinhaLog[]): Promise<void> {
    this.ultimaGravacao = Date.now();
    try {
      await db.insert(logsSistema).values(lote);
    } catch (erro) {
      // Log é registro, não regra de negócio: a falha não pode derrubar a busca.
      // O reporte não volta ao pipeline (senão a falha se repetiria a cada gravação).
      this.reportandoFalha = true;
      try {
        console.error('[PipelineLogger] Falha ao gravar logs do pipeline:', resumoDoErro(erro));
      } finally {
        this.reportandoFalha = false;
      }
    }
  }

  logBusca(message: string, detail?: string) {
    this.emit({
      level: 'step',
      phase: 'busca',
      message,
      detail,
    });
  }

  logWhitelist(editalId: string, titulo: string, valido: boolean, confidence: string, termos: string[]) {
    // Check if any generic term triggered it
    const genericTerms = ['projeto', 'programa', 'bolsa', 'investimento', 'pesquisa', 'desenvolvimento', 'fomento', 'professor'];
    const hasGenericTerm = termos.some(t => genericTerms.includes(t.toLowerCase()));
    
    let level: LogLevel = valido ? (hasGenericTerm ? 'warning' : 'success') : 'error';
    
    this.emit({
      level,
      phase: 'whitelist',
      editalId,
      editalTitulo: titulo,
      message: valido ? `✅ PASSOU (${confidence})` : `❌ BLOQUEADO`,
      detail: termos.length > 0 ? `Termos: ${termos.join(', ')}` : undefined,
      termosEncontrados: termos,
    });
  }

  logBlacklist(editalId: string, titulo: string, score: number, recomendacao: string, termos?: string[]) {
    this.emit({
      level: score > 35 ? 'error' : (score > 15 ? 'warning' : 'success'),
      phase: 'blacklist',
      editalId,
      editalTitulo: titulo,
      message: score > 35 ? `❌ BLOQUEADO (${score})` : `✅ LIMPA (score ${score})`,
      detail: recomendacao + (termos && termos.length > 0 ? ` | Termos: ${termos.join(', ')}` : ''),
      scoreNegativo: score,
      termosEncontrados: termos
    });
  }

  logIA(editalId: string, titulo: string, valido: boolean, tecnologia?: string, score?: number) {
    this.emit({
      level: valido ? 'success' : 'error',
      phase: 'ia',
      editalId,
      editalTitulo: titulo,
      message: valido ? `✅ VÁLIDO` : `❌ INVÁLIDO`,
      detail: (tecnologia ? `Tecnologia: ${tecnologia}` : '') + (score ? ` | Score: ${score}` : ''),
      scoreIA: score,
    });
  }

  logResultado(editalId: string, titulo: string, decisao: 'salvo' | 'rejeitado' | 'erro', motivo: string) {
    this.emit({
      level: decisao === 'salvo' ? 'success' : (decisao === 'erro' ? 'error' : 'warning'),
      phase: 'resultado',
      editalId,
      editalTitulo: titulo,
      message: decisao === 'salvo' ? `💾 SALVO` : (decisao === 'erro' ? `🚫 ERRO` : `🚫 REJEITADO`),
      detail: motivo,
    });
  }

  logErro(editalId: string, message: string) {
    this.emit({
      level: 'error',
      phase: 'pipeline',
      editalId,
      message: `❌ ERRO: ${message}`,
    });
  }
}

// Singleton export
export const pipelineLogger = new PipelineLogger();
