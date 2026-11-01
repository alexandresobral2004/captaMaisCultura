import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDbMock, clearAllTables } from './setup';

// Simula a edição feita por outra réplica: grava direto no repositório de configuração
async function gravarWhitelistExterna(termo: string) {
  const cfg = await import('../lib/config/configuracoes');
  const atual = await cfg.lerConfiguracao<{ tecnologia: string[] }>('filtros.whitelist');
  if (!atual) throw new Error('whitelist não semeada no banco');
  await cfg.gravarConfiguracao('filtros.whitelist', {
    ...atual,
    tecnologia: [...atual.tecnologia, termo],
  });
}

function putWhitelist(termo: string) {
  return new NextRequest('http://x/api/v1/filtros/whitelist', {
    method: 'PUT',
    body: JSON.stringify({ categoria: 'tecnologia', termo }),
    headers: { 'content-type': 'application/json' },
  });
}

describe('filtros em múltiplas réplicas', () => {
  let mock: any;

  beforeEach(() => {
    vi.resetModules();
    mock = setupTestDbMock();
  });

  afterEach(() => {
    if (mock?.rawDb) clearAllTables(mock.rawDb);
  });

  it('PUT enxerga termo gravado por outra réplica (conta o termo externo no total)', async () => {
    const loaders = await import('../lib/scraper/filtros/loaders');
    await loaders.sincronizarFiltros();
    const tamanhoInicial = loaders.loadWhitelist(true).tecnologia.length;

    await gravarWhitelistExterna('termo-externo-unico');

    const rota = await import('../app/api/v1/filtros/whitelist/route');
    const res = await rota.PUT(putWhitelist('termo-local-unico'));
    const corpo = await res.json();

    expect(res.status).toBe(200);
    // Inicial + externo + local: a réplica precisa ter lido a versão do banco antes de somar
    expect(corpo.total).toBe(tamanhoInicial + 2);
  });

  it('PUT não apaga termo gravado por outra réplica (sem lost update)', async () => {
    const loaders = await import('../lib/scraper/filtros/loaders');
    await loaders.sincronizarFiltros();

    await gravarWhitelistExterna('termo-externo-preservado');

    const rota = await import('../app/api/v1/filtros/whitelist/route');
    const res = await rota.PUT(putWhitelist('termo-local-preservado'));
    expect(res.status).toBe(200);

    const cfg = await import('../lib/config/configuracoes');
    const persistida = await cfg.lerConfiguracao<{ tecnologia: string[] }>('filtros.whitelist');
    expect(persistida?.tecnologia).toContain('termo-externo-preservado');
    expect(persistida?.tecnologia).toContain('termo-local-preservado');
  });
});
