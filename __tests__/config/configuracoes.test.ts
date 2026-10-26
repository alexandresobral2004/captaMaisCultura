import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDbMock, clearAllTables } from '../setup';

describe('configuracoes e filtros no banco', () => {
  let mock: any;

  beforeEach(() => {
    vi.resetModules();
    mock = setupTestDbMock();
  });

  afterEach(() => {
    if (mock?.rawDb) {
      clearAllTables(mock.rawDb);
    }
  });

  it('grava, substitui e lê uma configuração', async () => {
    const cfg = await import('../../lib/config/configuracoes');

    await cfg.gravarConfiguracao('chave-teste', { a: 1 });
    expect(await cfg.lerConfiguracao('chave-teste')).toEqual({ a: 1 });

    await cfg.gravarConfiguracao('chave-teste', { a: 2 });
    expect(await cfg.lerConfiguracao('chave-teste')).toEqual({ a: 2 });

    expect(await cfg.lerConfiguracao('nao-existe')).toBeNull();
  });

  it('sincronizarFiltros semeia o banco com o arquivo do repositório na primeira vez', async () => {
    const cfg = await import('../../lib/config/configuracoes');
    const loaders = await import('../../lib/scraper/filtros/loaders');

    expect(await cfg.lerConfiguracao('filtros.whitelist')).toBeNull();
    await loaders.sincronizarFiltros();
    expect(await cfg.lerConfiguracao('filtros.whitelist')).not.toBeNull();
  });

  it('filtro gravado no banco tem precedência sobre o arquivo', async () => {
    const loaders = await import('../../lib/scraper/filtros/loaders');
    await loaders.sincronizarFiltros();

    const atual = loaders.loadWhitelist(true);
    const novo = {
      ...atual,
      tecnologia: [...atual.tecnologia, 'termo-de-teste-unico'],
    };

    await loaders.gravarFiltro('whitelist', novo);
    expect(loaders.loadWhitelist().tecnologia).toContain('termo-de-teste-unico');

    // Nova carga (simula outro processo subindo) lê do banco, não do arquivo
    vi.resetModules();
    const cfgNovo = await import('../../lib/scraper/filtros/loaders');
    await cfgNovo.sincronizarFiltros();
    expect(cfgNovo.loadWhitelist(true).tecnologia).toContain('termo-de-teste-unico');
  });
});
