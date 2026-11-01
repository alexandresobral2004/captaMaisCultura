import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDbMock, clearAllTables, IS_POSTGRES } from './setup';
import { TipoJob } from '../lib/jobs/job-types';

vi.mock('@/lib/api/auth', () => ({
  verificarAdmin: async () => ({
    ok: true,
    usuario: { id: 'admin', nome: 'Admin', email: 'admin@x', role: 'admin', status: 'ativo' },
  }),
}));

// Simula duas réplicas: o worker grava o andamento; a web (outro processo, módulos recarregados)
// tem que devolver o mesmo andamento sem nada em memória do worker.
// Só Postgres: JobRepository não roda no mock SQLite (mesmo critério de busca-manual-progresso.test.ts)
describe.skipIf(!IS_POSTGRES)('progresso da busca entre réplicas', () => {
  beforeEach(() => {
    const mock = setupTestDbMock();
    clearAllTables(mock.rawDb);
    vi.resetModules();
  });

  it('a rota de progresso devolve o snapshot gravado pelo worker, mesmo com módulos recarregados', async () => {
    // Worker
    const { JobRepository } = await import('../lib/jobs/job-repository');
    const { criarAcumuladorBusca } = await import('../lib/scraper/progresso-busca');
    await new JobRepository().enfileirar('job-replica', TipoJob.BUSCA_MANUAL);
    const acumulador = criarAcumuladorBusca();
    acumulador.comecarColeta();
    acumulador.comecarProcessamento(4);
    acumulador.registrarItem('edital_util', 'Edital A');
    await new JobRepository().gravarProgresso('job-replica', acumulador.ler());

    // Outra réplica: nenhum módulo carregado antes
    vi.resetModules();
    const rota = await import('../app/api/editais/busca/progresso/route');
    const res = await rota.GET(new NextRequest('http://x/api/editais/busca/progresso?jobId=job-replica'));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ etapa: 'processando', total: 4, verificados: 1, uteis: 1, atual: 'Edital A' });
  });
});
