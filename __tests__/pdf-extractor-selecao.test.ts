import { describe, it, expect } from 'vitest';
import { extrairUrlPDF } from '../lib/scraper/pdf-extractor';

const PAGINA = 'https://exemplo.gov.br/chamadas/edital-02-2026';
const TITULO = 'Edital 02/2026 - Programa de Fomento à Cultura';

const pagina = (links: string) => `<html><body>${links}</body></html>`;

describe('escolha do PDF dentro da página do edital', () => {
  it('escolhe o PDF do edital, e não o de resultado que aparece antes na página', async () => {
    const html = pagina(`
      <a href="/docs/resultado-final.pdf">Resultado final</a>
      <a href="/docs/edital-02-2026.pdf">Edital 02/2026</a>`);

    const r = await extrairUrlPDF(html, PAGINA, { titulo: TITULO });

    expect(r.url).toBe('https://exemplo.gov.br/docs/edital-02-2026.pdf');
  });

  it('não devolve PDF de notícia ou comunicado, mesmo quando é o único link', async () => {
    const html = pagina(`<a href="/noticias/comunicado-resultado.pdf">Comunicado</a>`);

    const r = await extrairUrlPDF(html, PAGINA, { titulo: TITULO });

    expect(r.url).toBeNull();
  });

  it('aceita o único PDF da página quando o nome não traz sinal negativo', async () => {
    const html = pagina(`<a href="/arquivos/doc123.pdf">Baixar</a>`);

    const r = await extrairUrlPDF(html, PAGINA, { titulo: TITULO });

    expect(r.url).toBe('https://exemplo.gov.br/arquivos/doc123.pdf');
  });
});
