import { describe, it, expect, vi } from 'vitest';
import {
  enfileirarBuscaManual,
  consultarProgresso,
  ehFimDaBusca,
  mensagemFinal,
} from '../components/editais/fluxo-busca';
import type { ProgressoBusca } from '../lib/scraper/progresso-busca';

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

const PROGRESSO: ProgressoBusca = {
  etapa: 'processando', total: 3, verificados: 1, saoEditais: 1, uteis: 0, paraRevisar: 0,
  descartados: 0, jaExistentes: 0, atual: null, percentual: 33, atualizadoEm: '2026-10-31T12:00:00.000Z',
};

describe('fluxo da busca manual na tela', () => {
  it('202 devolve o jobId para consultar o andamento', async () => {
    const fetchFn = vi.fn(async () => resposta(202, { jobId: 'job-1' }));

    const r = await enfileirarBuscaManual(fetchFn);

    expect(r).toEqual({ ok: true, jobId: 'job-1' });
    expect(fetchFn).toHaveBeenCalledWith('/api/editais/busca', { method: 'POST' });
  });

  it('409 informa que a busca já está em andamento', async () => {
    const fetchFn = vi.fn(async () => resposta(409, { error: 'x' }));

    const r = await enfileirarBuscaManual(fetchFn);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe('em_andamento');
      expect(r.mensagem).toContain('em andamento');
    }
  });

  it('429 informa o limite semanal', async () => {
    const fetchFn = vi.fn(async () => resposta(429, { error: 'Limite' }));

    const r = await enfileirarBuscaManual(fetchFn);

    expect(r).toMatchObject({ ok: false, motivo: 'limite' });
  });

  it('consulta pelo jobId até a etapa final, e então mostra a mensagem final', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(resposta(200, PROGRESSO))
      .mockResolvedValueOnce(resposta(200, { ...PROGRESSO, etapa: 'concluida', percentual: 100, uteis: 2 }));

    const primeiro = await consultarProgresso('job-1', fetchFn);
    expect(fetchFn).toHaveBeenLastCalledWith(expect.stringContaining('jobId=job-1'), expect.anything());
    expect(primeiro && ehFimDaBusca(primeiro)).toBe(false);

    const final = await consultarProgresso('job-1', fetchFn);
    expect(final && ehFimDaBusca(final)).toBe(true);
    expect(final && mensagemFinal(final)).toContain('concluída');
  });
});
