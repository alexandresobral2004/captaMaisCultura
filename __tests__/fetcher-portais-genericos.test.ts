import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PortalConfig } from '../lib/scraper/config';

const portalHtml: PortalConfig = {
  id: 'portal-exemplo',
  nome: 'Portal Exemplo',
  urlBusca: 'https://exemplo.gov.br/editais',
  urlsFallback: [],
  tipo: 'html',
  categoria: 'Geral',
  ativo: true,
  intervaloMinutos: 60,
};

vi.mock('../lib/scraper/config', () => ({
  getPortaisAtivos: vi.fn(async () => [portalHtml]),
}));

vi.mock('../lib/db/editais-store', () => ({
  saveEdital: vi.fn(async (ed: { id: string }) => ({ ...ed, deletedAt: null })),
  parseDateString: vi.fn(() => null),
}));

vi.mock('../lib/scraper/prosas-scraper', () => ({ buscarEditaisProsas: vi.fn(async () => []) }));
vi.mock('../lib/scraper/capta-scraper', () => ({ buscarEditaisCapta: vi.fn(async () => []) }));
vi.mock('../lib/scraper/portais-finep-cnpq-capes', () => ({
  buscarEditaisFinep: vi.fn(async () => []),
  buscarEditaisCNPq: vi.fn(async () => []),
  buscarEditaisCapes: vi.fn(async () => []),
  buscarEditaisMinisterioCiencia: vi.fn(async () => []),
}));
vi.mock('../lib/scraper/portal-generico', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/scraper/portal-generico')>();
  return {
    PORTAIS_COM_COLETOR_PROPRIO: original.PORTAIS_COM_COLETOR_PROPRIO,
    buscarEditaisPortalGenerico: vi.fn(async () => []),
  };
});

describe('busca de portais inclui os portais html cadastrados no banco', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('chama o coletor genérico com o portal html ativo', async () => {
    const { buscarEditaisPortais } = await import('../lib/scraper/fetcher');
    const { buscarEditaisPortalGenerico } = await import('../lib/scraper/portal-generico');

    await buscarEditaisPortais();

    expect(buscarEditaisPortalGenerico).toHaveBeenCalledWith(portalHtml);
  }, 15000);

  it('não chama o coletor genérico para portal do tipo rss', async () => {
    const config = await import('../lib/scraper/config');
    const { buscarEditaisPortais } = await import('../lib/scraper/fetcher');
    const { buscarEditaisPortalGenerico } = await import('../lib/scraper/portal-generico');
    vi.mocked(config.getPortaisAtivos).mockResolvedValueOnce([{ ...portalHtml, id: 'portal-rss', tipo: 'rss' }]);

    await buscarEditaisPortais();

    expect(buscarEditaisPortalGenerico).not.toHaveBeenCalled();
  }, 15000);

  it('não chama o coletor genérico para portal html que tem coletor próprio', async () => {
    const config = await import('../lib/scraper/config');
    const { buscarEditaisPortais } = await import('../lib/scraper/fetcher');
    const { buscarEditaisPortalGenerico } = await import('../lib/scraper/portal-generico');
    vi.mocked(config.getPortaisAtivos).mockResolvedValueOnce([{ ...portalHtml, id: 'capta', tipo: 'html' }]);

    await buscarEditaisPortais();

    expect(buscarEditaisPortalGenerico).not.toHaveBeenCalled();
  }, 15000);
});
