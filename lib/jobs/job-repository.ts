import { eq } from 'drizzle-orm';
import { jobs } from '../database/schema';
import { BaseRepository } from '../database/repositories/base.repository';
import { JobStatus, JobPhase, JobProgresso, JobRecord, ErroFase } from './job-types';

export class JobRepository extends BaseRepository {
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
