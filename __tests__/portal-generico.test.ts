import { describe, it, expect } from 'vitest';
import { extrairItensDePagina, tituloDeAnoPassado } from '@/lib/scraper/portal-generico';

const agora = new Date(2026, 9, 12);

describe('extrairItensDePagina', () => {
  it('extrai links de edital com prazo futuro e descarta encerrados e navegação', () => {
    const html = `
      <nav><a href="/editais">Editais e chamadas públicas</a></nav>
      <ul>
        <li><a href="/chamada-ia-2026">Chamada pública de Inteligência Artificial 2026</a> Inscrições até 30/11/2026</li>
        <li><a href="/edital-antigo">Edital de bolsas de pesquisa 2024</a> Inscrições até 10/01/2025</li>
        <li><a href="/edital-sem-prazo">Edital de apoio a projetos de software</a></li>
        <li><a href="/contato">Fale conosco com a nossa equipe</a></li>
        <li><a href="/chamada-ia-2026">Chamada pública de Inteligência Artificial 2026</a></li>
      </ul>`;
    const itens = extrairItensDePagina(html, 'https://exemplo.org/listagem', agora);
    expect(itens.map(i => i.link)).toEqual([
      'https://exemplo.org/chamada-ia-2026',
      'https://exemplo.org/edital-sem-prazo',
    ]);
    expect(itens[0].dataLimite).toBe('30/11/2026');
    expect(itens[1].dataLimite).toBe('A consultar');
  });
});

describe('filtros de título', () => {
  it('descarta adendo, errata, resultado e anos passados', () => {
    const html = `<ul>
      <li><a href="/a">Adendo nº 01/2026 ao Edital nº 30/2026 de pesquisa</a></li>
      <li><a href="/b">Resultado preliminar do Edital de bolsas 2026</a></li>
      <li><a href="/c">Chamada de Propostas FAPESP / MCTIC – 2018</a></li>
      <li><a href="/d">Edital nº 28/2026 – Apoio a projetos de pesquisa</a></li>
    </ul>`;
    expect(extrairItensDePagina(html, 'https://x.org/', agora).map(i => i.link)).toEqual(['https://x.org/d']);
    expect(tituloDeAnoPassado('Chamada 2018', agora)).toBe(true);
    expect(tituloDeAnoPassado('Edital 12/2026', agora)).toBe(false);
  });
});
