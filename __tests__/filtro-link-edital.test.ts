import { describe, it, expect } from 'vitest';
import { linkEhPaginaDeNoticia } from '../lib/scraper/filtro-link-edital';

describe('linkEhPaginaDeNoticia: notícias e comunicados não são editais', () => {
  it.each([
    'https://www.gov.br/capes/pt-br/assuntos/noticias/2026/resultado-do-edital-05',
    'https://www.gov.br/cnpq/pt-br/assuntos/noticias/cnpq-abre-chamada',
    'https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/noticias/2026/10/chamada',
    'https://www.gov.br/finep/pt-br/comunicados/aviso-de-prazo',
  ])('marca "%s" como notícia', link => {
    expect(linkEhPaginaDeNoticia(link)).toBe(true);
  });

  it.each([
    'https://www.gov.br/cnpq/pt-br/financiamento/chamadas-abertas/chamada-33-2026',
    'https://www.gov.br/capes/pt-br/acesso-a-informacao/editais/edital-02-2026',
    'https://www.finep.gov.br/chamadas-publicas/chamadapublica/123',
  ])('deixa passar "%s", que parece edital', link => {
    expect(linkEhPaginaDeNoticia(link)).toBe(false);
  });
});
