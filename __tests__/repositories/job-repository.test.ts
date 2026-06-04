import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables } from '../setup';
import { JobStatus, JobPhase } from '../../lib/jobs/job-types';
import crypto from 'crypto';

describe('JobRepository', () => {
  let JobRepository: any;
  let repository: any;
  let mock: any;

  beforeEach(async () => {
    vi.resetModules();
    mock = setupTestDbMock();
    if (mock?.rawDb) clearAllTables(mock.rawDb);
    const mod = await import('../../lib/jobs/job-repository');
    JobRepository = mod.JobRepository;
    repository = new JobRepository();
  });

  afterEach(() => {
    if (mock?.rawDb) {
      clearAllTables(mock.rawDb);
    }
  });

  it('deve criar um job com status RODANDO', async () => {
    const id = crypto.randomUUID();
    const job = await repository.criar(id);

    expect(job).toBeDefined();
    expect(job.id).toBe(id);
    expect(job.status).toBe(JobStatus.RODANDO);
    expect(job.fase).toBeNull();
    expect(job.iniciadoEm).toBeDefined();
    expect(job.atualizadoEm).toBeDefined();
    expect(job.totalEncontrados).toBe(0);
  });

  it('deve atualizar a fase e o progresso do job', async () => {
    const id = crypto.randomUUID();
    await repository.criar(id);

    const jobAtualizado = await repository.atualizarFase(id, JobPhase.BUSCA, {
      totalEncontrados: 10,
      totalValidados: 5
    });

    expect(jobAtualizado).toBeDefined();
    expect(jobAtualizado?.fase).toBe(JobPhase.BUSCA);
    expect(jobAtualizado?.totalEncontrados).toBe(10);
    expect(jobAtualizado?.totalValidados).toBe(5);
    expect(jobAtualizado?.totalDownloads).toBe(0);
  });

  it('deve registrar um erro parcial e incrementar o contador', async () => {
    const id = crypto.randomUUID();
    await repository.criar(id);

    const jobComErro = await repository.registrarErro(id, JobPhase.DOWNLOAD, 'Erro de rede');

    expect(jobComErro).toBeDefined();
    expect(jobComErro?.totalErros).toBe(1);
    
    const errosDetalhes = JSON.parse(jobComErro?.erroDetalhes || '[]');
    expect(errosDetalhes).toHaveLength(1);
    expect(errosDetalhes[0].fase).toBe(JobPhase.DOWNLOAD);
    expect(errosDetalhes[0].mensagem).toBe('Erro de rede');
  });

  it('deve finalizar um job', async () => {
    const id = crypto.randomUUID();
    await repository.criar(id);

    const jobFinalizado = await repository.finalizar(id, JobStatus.CONCLUIDO);

    expect(jobFinalizado).toBeDefined();
    expect(jobFinalizado?.status).toBe(JobStatus.CONCLUIDO);
    expect(jobFinalizado?.finalizadoEm).toBeDefined();
  });

  it('deve buscar um job que esteja RODANDO', async () => {
    const id1 = crypto.randomUUID();
    await repository.criar(id1);
    await repository.finalizar(id1, JobStatus.CONCLUIDO);

    const id2 = crypto.randomUUID();
    await repository.criar(id2);

    const jobRodando = await repository.buscarRodando();
    expect(jobRodando).toBeDefined();
    expect(jobRodando?.id).toBe(id2);
    expect(jobRodando?.status).toBe(JobStatus.RODANDO);
  });
});
