import { describe, it, expect } from 'vitest';
import { extrairTituloDoTexto } from '@/lib/editais/titulo';

describe('extrairTituloDoTexto', () => {
  it('monta o título de um PDF com texto simples (pdf-parse)', () => {
    const texto = [
      'Chamada CNPq Nº 34/2026',
      'Auxílio à Promoção de Eventos Científicos, Tecnológicos e/ou',
      'de Inovação - ARC',
      'O Conselho Nacional de Desenvolvimento Científico e Tecnológico',
    ].join('\n');
    expect(extrairTituloDoTexto(texto)).toBe(
      'Chamada CNPq Nº 34/2026 Auxílio à Promoção de Eventos Científicos, Tecnológicos e/ou de Inovação - ARC'
    );
  });

  it('ignora marcação Markdown do LlamaParse e pula o nome do órgão', () => {
    const texto = [
      '# CNPq',
      '**Conselho Nacional de Desenvolvimento Científico e Tecnológico**',
      '',
      '# **Chamada CNPq N° 34/2026**',
      '# **Auxílio à Promoção de Eventos Científicos, Tecnológicos e/ou de Inovação - ARC**',
    ].join('\n');
    const titulo = extrairTituloDoTexto(texto);
    expect(titulo).not.toMatch(/[#*]/);
    expect(titulo.startsWith('Chamada CNPq N° 34/2026')).toBe(true);
    expect(titulo).toContain('Auxílio à Promoção');
  });

  it('usa a primeira linha quando nenhuma parece título', () => {
    expect(extrairTituloDoTexto('Documento de referência\nTexto corrido')).toBe('Documento de referência Texto corrido');
  });

  it('respeita o limite de caracteres', () => {
    const longo = 'Edital ' + 'x'.repeat(500);
    expect(extrairTituloDoTexto(longo, 50).length).toBeLessThanOrEqual(50);
  });

  it('retorna vazio para texto sem linhas úteis', () => {
    expect(extrairTituloDoTexto('\n\n  \n')).toBe('');
  });
});
