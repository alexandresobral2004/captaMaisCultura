import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Leitura do histórico é controlada pelo teste: a conexão fica "presa" no primeiro await
const ultimoId = vi.hoisted(() => ({ fn: vi.fn<() => Promise<number>>() }));
const depois = vi.hoisted(() => ({ fn: vi.fn<(cursor: number) => Promise<{ id: number; detalhes: string | null }[]>>(async () => []) }));

vi.mock('@/lib/scraper/pipeline-eventos', () => ({
  ultimoIdPipeline: () => ultimoId.fn(),
  lerUltimosPipeline: vi.fn(async () => []),
  lerDepoisDePipeline: (cursor: number) => depois.fn(cursor),
}));

function adiado<T>() {
  let resolver!: (valor: T) => void;
  const promise = new Promise<T>((r) => { resolver = r; });
  return { promise, resolver };
}

async function drenarMicrotasks() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

describe('SSE de logs não deixa timers vivos quando a conexão cai durante o início', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('cancel() antes do histórico chegar não deixa timers', async () => {
    vi.useFakeTimers();
    const espera = adiado<number>();
    ultimoId.fn.mockReturnValue(espera.promise);

    const rota = await import('../app/api/v1/scraper/logs/stream/route');
    const res = await rota.GET(new NextRequest('http://x/api/v1/scraper/logs/stream'));

    await res.body?.cancel();
    espera.resolver(5);
    await drenarMicrotasks();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('abort do signal antes do histórico chegar não deixa timers', async () => {
    vi.useFakeTimers();
    const espera = adiado<number>();
    ultimoId.fn.mockReturnValue(espera.promise);
    const controle = new AbortController();

    const rota = await import('../app/api/v1/scraper/logs/stream/route');
    await rota.GET(new NextRequest('http://x/api/v1/scraper/logs/stream', { signal: controle.signal }));

    controle.abort();
    espera.resolver(5);
    await drenarMicrotasks();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancel() durante a leitura do ciclo não reporta falha nem reagenda', async () => {
    vi.useFakeTimers();
    ultimoId.fn.mockResolvedValue(5);
    const leitura = adiado<{ id: number; detalhes: string | null }[]>();
    depois.fn.mockReturnValue(leitura.promise);
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

    const rota = await import('../app/api/v1/scraper/logs/stream/route');
    const res = await rota.GET(new NextRequest('http://x/api/v1/scraper/logs/stream?history=false'));
    await drenarMicrotasks();
    vi.advanceTimersByTime(1500);

    await res.body?.cancel();
    leitura.resolver([{ id: 6, detalhes: '{}' }]);
    await drenarMicrotasks();

    expect(erro).not.toHaveBeenCalledWith(expect.stringContaining('Falha ao ler logs'));
    expect(vi.getTimerCount()).toBe(0);
    erro.mockRestore();
  });
});
