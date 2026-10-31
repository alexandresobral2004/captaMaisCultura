import { and, asc, desc, eq, lt, sql } from 'drizzle-orm';
import { jobs } from '../database/schema';
import { BaseRepository } from '../database/repositories/base.repository';
import { JobStatus, JobPhase, JobProgresso, JobRecord, ErroFase, TipoJob } from './job-types';
import type { ProgressoBusca } from '../scraper/progresso-busca';
import type { Consulta } from '../database/consulta';

/** Job sem atualização há mais que isso é considerado órfão (processo morto). */
export const TEMPO_SEM_ATUALIZACAO_MS = 5 * 60 * 1000;
/** Job PENDENTE sem worker por mais que isso é considerado sem worker disponível. */
export const TEMPO_PENDENTE_MS = 3 * 60 * 1000;
export const MENSAGEM_WORKER_INDISPONIVEL = 'Worker indisponível';

/** Lê o progresso gravado no banco. Texto ausente ou fora do formato vira null. */
function lerProgressoGravado(texto: string | null): ProgressoBusca | null {
  if (!texto) return null;
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof dados !== 'object' || dados === null) return null;
  return 'etapa' in dados && typeof dados.etapa === 'string' ? dados as ProgressoBusca : null;
}

export class JobRepository extends BaseRepository {
  /** @param executor transação aberta, quando o enfileiramento precisa ser atômico com outras gravações */
  constructor(executor?: Consulta) {
    super();
    if (executor) this.database = executor;
  }

  /**
   * Cria um novo job no banco de dados com status RODANDO
   */
  async criar(id: string): Promise<JobRecord> {
    const now = new Date().toISOString();
    
    const result = await this.database.insert(jobs).values({
      id,
      status: JobStatus.RODANDO,
      fase: null,
      iniciadoEm: now,
      atualizadoEm: now,
    }).returning();
    
    return this.mapToJobRecord(result[0]);
  }

  /**
   * Atualiza a fase atual e os contadores de progresso do job
   */
  async atualizarFase(id: string, fase: JobPhase, progresso?: Partial<JobProgresso>): Promise<JobRecord | null> {
    const now = new Date().toISOString();
    
    const updateData: any = {
      fase,
      atualizadoEm: now,
    };
    
    if (progresso) {
      if (progresso.totalEncontrados !== undefined) updateData.totalEncontrados = progresso.totalEncontrados;
      if (progresso.totalValidados !== undefined) updateData.totalValidados = progresso.totalValidados;
      if (progresso.totalDownloads !== undefined) updateData.totalDownloads = progresso.totalDownloads;
      if (progresso.totalAnalisados !== undefined) updateData.totalAnalisados = progresso.totalAnalisados;
      if (progresso.totalErros !== undefined) updateData.totalErros = progresso.totalErros;
    }

    const result = await this.database
      .update(jobs)
      .set(updateData)
      .where(eq(jobs.id, id))
      .returning();
      
    if (result.length === 0) return null;
    return this.mapToJobRecord(result[0]);
  }

  /**
   * Adiciona um erro à lista de erros da fase sem abortar o job
   */
  async registrarErro(id: string, fase: JobPhase, mensagem: string): Promise<JobRecord | null> {
    const job = await this.buscarPorId(id);
    if (!job) return null;

    const errosAtual: ErroFase[] = job.erroDetalhes ? JSON.parse(job.erroDetalhes) : [];
    
    const novoErro: ErroFase = {
      fase,
      mensagem,
      timestamp: new Date().toISOString()
    };
    
    errosAtual.push(novoErro);
    
    const result = await this.database
      .update(jobs)
      .set({
        erroDetalhes: JSON.stringify(errosAtual),
        totalErros: (job.totalErros || 0) + 1,
        atualizadoEm: new Date().toISOString()
      })
      .where(eq(jobs.id, id))
      .returning();
      
    return this.mapToJobRecord(result[0]);
  }

  /**
   * Finaliza o job com status CONCLUIDO ou ERRO
   */
  async finalizar(id: string, status: JobStatus): Promise<JobRecord | null> {
    const now = new Date().toISOString();
    
    const result = await this.database
      .update(jobs)
      .set({
        status,
        finalizadoEm: now,
        atualizadoEm: now
      })
      .where(eq(jobs.id, id))
      .returning();
      
    if (result.length === 0) return null;
    return this.mapToJobRecord(result[0]);
  }

  /**
   * Busca um job que esteja com status RODANDO
   */
  async buscarRodando(): Promise<JobRecord | null> {
    const result = await this.database
      .select()
      .from(jobs)
      .where(eq(jobs.status, JobStatus.RODANDO))
      .limit(1);
      
    if (result.length === 0) return null;
    return this.mapToJobRecord(result[0]);
  }

  /**
   * Marca como ERRO os jobs RODANDO sem atualização há mais de `limiteMs`.
   * Cobre processos encerrados no meio (deploy, reinício, parada da VM) que
   * nunca chegaram a finalizar o job.
   */
  async encerrarOrfaos(limiteMs: number, agora = new Date()): Promise<number> {
    const agoraIso = agora.toISOString();
    const limite = new Date(agora.getTime() - limiteMs).toISOString();
    const mensagem = `Job interrompido: sem heartbeat por mais de ${Math.round(limiteMs / 60000)} minutos`;

    // Um único UPDATE condicionado: dois workers não encerram o mesmo job por engano
    const result = await this.database
      .update(jobs)
      .set({
        status: JobStatus.ERRO,
        finalizadoEm: agoraIso,
        atualizadoEm: agoraIso,
        // Preserva erros parciais já registrados; se não houver, grava o motivo do encerramento
        erroDetalhes: sql`COALESCE(${jobs.erroDetalhes}, ${JSON.stringify([{ mensagem, timestamp: agoraIso }])})`,
      })
      .where(and(eq(jobs.status, JobStatus.RODANDO), lt(jobs.atualizadoEm, limite)))
      .returning({ id: jobs.id });
    return result.length;
  }

  /**
   * Enfileira uma varredura: cria o job com status PENDENTE, para um worker executar depois.
   */
  async enfileirar(id: string, tipo: TipoJob = TipoJob.VARREDURA_SEMANAL): Promise<JobRecord> {
    const now = new Date().toISOString();
    const result = await this.database.insert(jobs).values({
      id,
      status: JobStatus.PENDENTE,
      tipo,
      fase: null,
      iniciadoEm: now,
      atualizadoEm: now,
    }).returning();
    return this.mapToJobRecord(result[0]);
  }

  /**
   * Marca como ERRO os jobs PENDENTE há mais de `limiteMs`: o worker não os reivindicou (worker parado).
   */
  async encerrarPendentesVencidos(limiteMs: number, agora = new Date()): Promise<number> {
    const agoraIso = agora.toISOString();
    const limite = new Date(agora.getTime() - limiteMs).toISOString();
    const result = await this.database
      .update(jobs)
      .set({
        status: JobStatus.ERRO,
        finalizadoEm: agoraIso,
        atualizadoEm: agoraIso,
        erroDetalhes: JSON.stringify([{ mensagem: MENSAGEM_WORKER_INDISPONIVEL, timestamp: agoraIso }]),
      })
      .where(and(eq(jobs.status, JobStatus.PENDENTE), lt(jobs.iniciadoEm, limite)))
      .returning({ id: jobs.id });
    return result.length;
  }

  /** Busca um job PENDENTE (aguardando worker). */
  async buscarPendente(): Promise<JobRecord | null> {
    const [pendente] = await this.database
      .select()
      .from(jobs)
      .where(eq(jobs.status, JobStatus.PENDENTE))
      .limit(1);
    return pendente ? this.mapToJobRecord(pendente) : null;
  }

  /**
   * Reivindica o job PENDENTE mais antigo, trocando para RODANDO de forma atômica.
   * Se outro worker já tiver um job RODANDO (índice único parcial), devolve null.
   */
  async reivindicarProximoPendente(): Promise<JobRecord | null> {
    const [pendente] = await this.database
      .select()
      .from(jobs)
      .where(eq(jobs.status, JobStatus.PENDENTE))
      .orderBy(asc(jobs.iniciadoEm))
      .limit(1);
    if (!pendente) return null;

    try {
      const now = new Date().toISOString();
      const result = await this.database
        .update(jobs)
        .set({ status: JobStatus.RODANDO, atualizadoEm: now })
        .where(and(eq(jobs.id, pendente.id), eq(jobs.status, JobStatus.PENDENTE)))
        .returning();
      if (result.length === 0) return null;
      return this.mapToJobRecord(result[0]);
    } catch (erro: any) {
      // 23505: já existe outro RODANDO; este pendente continua na fila
      if (erro?.code === '23505') return null;
      throw erro;
    }
  }

  /**
   * Heartbeat: registra que o job segue vivo. Chamado periodicamente pelo runner.
   */
  async heartbeat(id: string): Promise<void> {
    await this.database
      .update(jobs)
      .set({ atualizadoEm: new Date().toISOString() })
      .where(eq(jobs.id, id));
  }

  /** Grava o andamento da busca manual no próprio job (lido de qualquer instância pela tela). */
  async gravarProgresso(id: string, progresso: ProgressoBusca): Promise<void> {
    await this.database
      .update(jobs)
      .set({ progresso: JSON.stringify(progresso), atualizadoEm: new Date().toISOString() })
      .where(eq(jobs.id, id));
  }

  /** Job mais recente de um tipo (por data de início). */
  async buscarUltimoDeTipo(tipo: TipoJob): Promise<JobRecord | null> {
    const [ultimo] = await this.database
      .select()
      .from(jobs)
      .where(eq(jobs.tipo, tipo))
      .orderBy(desc(jobs.iniciadoEm))
      .limit(1);
    return ultimo ? this.mapToJobRecord(ultimo) : null;
  }

  /**
   * Busca um job por ID
   */
  async buscarPorId(id: string): Promise<JobRecord | null> {
    const result = await this.database
      .select()
      .from(jobs)
      .where(eq(jobs.id, id))
      .limit(1);
      
    if (result.length === 0) return null;
    return this.mapToJobRecord(result[0]);
  }

  /**
   * Mapeia do banco para a interface de domínio
   */
  private mapToJobRecord(raw: any): JobRecord {
    return {
      id: raw.id,
      status: raw.status as JobStatus,
      tipo: raw.tipo === TipoJob.BUSCA_MANUAL ? TipoJob.BUSCA_MANUAL : TipoJob.VARREDURA_SEMANAL,
      progresso: lerProgressoGravado(raw.progresso),
      fase: raw.fase as JobPhase | null,
      totalEncontrados: raw.totalEncontrados || 0,
      totalValidados: raw.totalValidados || 0,
      totalDownloads: raw.totalDownloads || 0,
      totalAnalisados: raw.totalAnalisados || 0,
      totalErros: raw.totalErros || 0,
      erroDetalhes: raw.erroDetalhes || null,
      iniciadoEm: raw.iniciadoEm,
      finalizadoEm: raw.finalizadoEm || null,
      atualizadoEm: raw.atualizadoEm,
    };
  }
}
