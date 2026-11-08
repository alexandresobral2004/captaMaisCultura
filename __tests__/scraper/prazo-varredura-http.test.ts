import { describe, it, expect, afterEach, vi } from 'vitest';
import axios from 'axios';
import type { PortalConfig } from '../../lib/scraper/config';
import { PRAZO_VARREDURA_MS, iniciarOrcamentoVarredura, encerrarOrcamentoVarredura } from '../../lib/ai/orcamento-ia';

const portal: PortalConfig = {
  id: 'portal-prazo',
  nome: 'Portal de teste',
  urlBusca: 'https://exemplo.org/listagem',
  urlsFallback: [],
  tipo: 'html',
  categoria: 'Pesquisa',
  ativo: true,
  intervaloMinutos: 60,
};

const listagem = `<ul>
  <li><a href="/edital-a">Edital de apoio a projetos de software</a></li>
  <li><a href="/edital-b">Edital de apoio a projetos de hardware</a></li>
</ul>`;

describe('prazo da varredura nas buscas HTTP dos portais', () => {
  afterEach(() => {
    encerrarOrcamentoVarredura();
    vi.restoreAllMocks();
  });

  it('com o prazo já vencido, não faz nenhuma requisição ao portal', async () => {
    const { buscarEditaisPortalGenerico } = await import('../../lib/scraper/portal-generico');
    const get = vi.spyOn(axios, 'get');
    iniciarOrcamentoVarredura(0, { prazoMs: PRAZO_VARREDURA_MS, maxChamadas: 300 }, () => PRAZO_VARREDURA_MS + 1);

    const editais = await buscarEditaisPortalGenerico(portal);

    expect(editais).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it('se o prazo vence durante a listagem, não abre a página de cada candidato', async () => {
    const { buscarEditaisPortalGenerico } = await import('../../lib/scraper/portal-generico');
    let agora = 0;
    iniciarOrcamentoVarredura(0, { prazoMs: PRAZO_VARREDURA_MS, maxChamadas: 300 }, () => agora);
    const get = vi.spyOn(axios, 'get').mockImplementation(async () => {
      agora = PRAZO_VARREDURA_MS + 1; // o prazo vence enquanto a listagem é baixada
      return { data: listagem } as any;
    });

    await buscarEditaisPortalGenerico(portal);

    expect(get).toHaveBeenCalledTimes(1);
  });
});
