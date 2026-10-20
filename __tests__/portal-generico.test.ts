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

  it('guarda o texto do bloco em volta do link para a triagem não depender só do título', () => {
    const html = `<ul><li><a href="/chamada-ia-2026">Chamada pública de Inteligência Artificial 2026</a> Inscrições até 30/11/2026 para pesquisadores</li></ul>`;
    const [item] = extrairItensDePagina(html, 'https://exemplo.org/listagem', agora);
    expect(item.trecho).toContain('para pesquisadores');
    expect(item.trecho!.length).toBeLessThanOrEqual(600);
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

describe('páginas de texto corrido', () => {
  it('extrai editais escritos como parágrafos', () => {
    const html = `<div id="content-core"><p>Chamada <a href="/edital-1.pdf">(documento Nº 1)</a> para seleção de unidades da Rede Federal interessadas em apoio técnico.</p>
      <ul><li><a href="/retificacao.pdf">Retificação</a></li></ul><p>Texto qualquer curto.</p></div>`;
    const itens = extrairItensDePagina(html, 'https://gov.br/mec/editais/2026', agora);
    expect(itens).toHaveLength(1);
    expect(itens[0].link).toBe('https://gov.br/edital-1.pdf');
  });
});

describe('links genéricos para PDF', () => {
  it('usa o nome do arquivo como título', () => {
    const html = `<div><h3>Edital - Estudantes</h3><a href="/uploads/EDITAL-No-1.2026-DG-POLO-IFCE-Estudantes.pdf">Acesse o edital.</a></div>`;
    const itens = extrairItensDePagina(html, 'https://polo.ifce.edu.br/embrapii-editais/', agora);
    expect(itens).toHaveLength(1);
    expect(itens[0].titulo).toBe('EDITAL No 1.2026 DG POLO IFCE Estudantes');
  });
});
