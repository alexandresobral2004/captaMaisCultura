import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupTestDbMock, clearAllTables } from '../setup';
import { JobStatus } from '../../lib/jobs/job-types';
import * as fetcher from '../../lib/scraper/fetcher';

// Mock dependencies
vi.mock('../../lib/scraper/fetcher');
vi.mock('../../lib/ai/analyzer');
vi.mock('../../lib/scraper/pdf-downloader');
vi.mock('../../lib/db/editais-store');

describe('JobRunner', () => {
  let JobRunner: any;
  let runner: any;
  let mock: any;

  beforeEach(async () => {
    vi.resetModules();
    mock = setupTestDbMock();
    const mod = await import('../../lib/jobs/job-runner');
    JobRunner = mod.JobRunner;
    runner = new JobRunner();
    
    // Default mocks
    vi.spyOn(fetcher, 'buscarEditaisPortais').mockResolvedValue([]);
    vi.spyOn(fetcher, 'filtrarComClassificador').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (mock?.rawDb) {
      clearAllTables(mock.rawDb);
    }
  });

  it('deve impedir a execução concorrente de dois jobs', async () => {
    const { JobRepository } = await import('../../lib/jobs/job-repository');
    const { ConflictError } = await import('../../lib/jobs/job-runner');
    const repo = new JobRepository();
    await repo.criar('job-existente');

    await expect(runner.executar()).rejects.toThrow(ConflictError);
  });

  it('deve executar o pipeline vazio e retornar CONCLUIDO se nao houver editais', async () => {
    const resultado = await runner.executar();

    expect(resultado.status).toBe(JobStatus.CONCLUIDO);
    expect(resultado.totalEncontrados).toBe(0);
    expect(fetcher.buscarEditaisPortais).toHaveBeenCalled();
    expect(fetcher.filtrarComClassificador).toHaveBeenCalled();
    
    // Verificar se o job foi salvo como CONCLUIDO
    const { JobRepository } = await import('../../lib/jobs/job-repository');
    const repo = new JobRepository();
    const jobSalvo = await repo.buscarPorId(resultado.jobId);
    expect(jobSalvo?.status).toBe(JobStatus.CONCLUIDO);
  });
  
  it('deve registrar erro fatal se buscarEditaisPortais falhar', async () => {
    vi.spyOn(fetcher, 'buscarEditaisPortais').mockRejectedValue(new Error('API indisponível'));
    
    const resultado = await runner.executar();

    expect(resultado.status).toBe(JobStatus.ERRO);
    expect(resultado.erros.length).toBeGreaterThan(0);
    expect(resultado.erros.some((e: any) => e.mensagem.includes('FATAL: API indisponível'))).toBe(true);
    
    // Verificar se o job foi salvo como ERRO
    const { JobRepository } = await import('../../lib/jobs/job-repository');
    const repo = new JobRepository();
    const jobSalvo = await repo.buscarPorId(resultado.jobId);
    expect(jobSalvo?.status).toBe(JobStatus.ERRO);
  });
});
