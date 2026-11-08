import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { setupTestDbMock, clearAllTables } from '../setup';

// Entrada de teste: título que não é item de menu, para chegar à triagem de verdade
const entrada = {
  titulo: 'Chamada pública de apoio a projetos de inovação tecnológica',
  descricao: 'Seleção de projetos de pesquisa em tecnologia da informação',
  orgao: 'Órgão de teste',
  editalId: 'edital-teste-1',
};

describe('triagem com orçamento e aprendizado', () => {
  let mock: any;
  let fetchEspiao: ReturnType<typeof vi.fn>;
  let axiosEspiao: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    mock = setupTestDbMock();
    process.env.JEV_API_KEY = 'chave-de-teste';
    process.env.OPENAI_API_KEY = 'chave-de-teste';
    fetchEspiao = vi.fn();
    vi.stubGlobal('fetch', fetchEspiao);
    axiosEspiao = vi.spyOn(axios, 'post');
  });

  afterEach(async () => {
    const { encerrarOrcamentoVarredura } = await import('../../lib/ai/orcamento-ia');
    encerrarOrcamentoVarredura();
    vi.unstubAllGlobals();
    axiosEspiao.mockRestore();
    delete process.env.JEV_API_KEY;
    delete process.env.OPENAI_API_KEY;
    if (mock?.rawDb) clearAllTables(mock.rawDb);
  });

  it('sem orçamento, não chama a IA, não decide e conta o candidato como pendente', async () => {
    const orcamento = await import('../../lib/ai/orcamento-ia');
    const { triarEditalDoPortal } = await import('../../lib/triagem/scraper');
    orcamento.iniciarOrcamentoVarredura(0, { prazoMs: orcamento.PRAZO_VARREDURA_MS, maxChamadas: 0 }, () => 1);

    const resultado = await triarEditalDoPortal('portal-teste', entrada);

    expect(resultado.aceito).toBe(false);
    expect(resultado.motivo).toMatch(/Não triado/);
    expect(fetchEspiao).not.toHaveBeenCalled();
    expect(axiosEspiao).not.toHaveBeenCalled();
    expect(orcamento.pendentesDoOrcamento()).toBe(1);
  });
});
