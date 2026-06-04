import { v4 as uuidv4 } from 'uuid';

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

type Subscriber = (event: PipelineLogEvent) => void;

class PipelineLogger {
  private buffer: PipelineLogEvent[] = [];
  private subscribers: Set<Subscriber> = new Set();
  private maxBufferSize = 200;

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getBuffer(): PipelineLogEvent[] {
    return [...this.buffer];
  }

  private emit(event: Omit<PipelineLogEvent, 'id' | 'ts'>) {
    const fullEvent: PipelineLogEvent = {
      ...event,
      id: uuidv4(),
      ts: new Date().toISOString(),
    };

    this.buffer.push(fullEvent);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    this.subscribers.forEach((sub) => sub(fullEvent));
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
