import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { setupTestDbMock, clearAllTables, IS_POSTGRES } from '../setup';
import { JobStatus } from '../../lib/jobs/job-types';
import type { ProgressoBusca } from '../../lib/scraper/progresso-busca';

const PROGRESSO: ProgressoBusca = {
  etapa: 'processando',
  total: 4,
  verificados: 2,
  saoEditais: 1,
  uteis: 1,
  paraRevisar: 0,
  descartados: 1,
  jaExistentes: 0,
  atual: 'Edital de teste',
  percentual: 50,
  atualizadoEm: '2026-10-31T12:00:00.000Z',
};

describe('fila de jobs: tipo e progresso', () => {
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
    if (mock?.rawDb) clearAllTables(mock.rawDb);
  });

  it('grava e lê o tipo e o progresso do job', async () => {
    await repository.enfileirar('job-busca', 'busca_manual');
    await repository.gravarProgresso('job-busca', PROGRESSO);

    const job = await repository.buscarPorId('job-busca');
    expect(job.tipo).toBe('busca_manual');
    expect(job.progresso).toEqual(PROGRESSO);
  });

  it('sem tipo explícito, o job é uma varredura semanal e ainda não tem progresso', async () => {
    await repository.enfileirar('job-varredura');

    const job = await repository.buscarPorId('job-varredura');
    expect(job.tipo).toBe('varredura_semanal');
    expect(job.progresso).toBeNull();
    expect(job.status).toBe(JobStatus.PENDENTE);
  });

  it.skipIf(!IS_POSTGRES)('um segundo job ativo, de qualquer tipo, falha com 23505', async () => {
    await repository.enfileirar(crypto.randomUUID(), 'varredura_semanal');

    const segundo = repository.enfileirar(crypto.randomUUID(), 'busca_manual');
    await expect(segundo).rejects.toThrow();
    await expect(segundo).rejects.toMatchObject({ cause: { code: '23505' } });
  });
});
