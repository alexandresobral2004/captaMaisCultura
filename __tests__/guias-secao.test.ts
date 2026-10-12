import { describe, it, expect } from 'vitest';
import { tipoDaSecao, ondaDaSecao, guiaDaSecao, detectarProibidas, limparHtml, numerosNaoSuportados } from '../lib/projetos/guias-secao';

describe('guias de seção', () => {
  it('classifica títulos com acento e variações', () => {
    expect(tipoDaSecao('Justificativa e relevância')).toBe('justificativa');
    expect(tipoDaSecao('Plano de trabalho')).toBe('metodologia');
    expect(tipoDaSecao('Cronograma de Atividades')).toBe('cronograma');
    expect(tipoDaSecao('Orçamento detalhado')).toBe('orcamento');
    expect(tipoDaSecao('Ficha Técnica/Equipe')).toBe('equipe');
    expect(tipoDaSecao('Declarações diversas')).toBe('outra');
  });
  it('ordena as ondas', () => {
    expect(ondaDaSecao('objetivos')).toBe(1);
    expect(ondaDaSecao('cronograma')).toBe(2);
    expect(ondaDaSecao('resumo')).toBe(3);
  });
  it('guia muda entre pesquisa e cultura', () => {
    expect(guiaDaSecao('justificativa', true)).toContain('estado da arte');
    expect(guiaDaSecao('justificativa', false)).toContain('diagnóstico');
  });
  it('detecta expressões proibidas só como palavra inteira', () => {
    expect(detectarProibidas('<p>Uma jornada incrível.</p>')).toEqual(expect.arrayContaining(['jornada', 'incrível']));
    expect(detectarProibidas('A sinergética equipe')).toEqual([]);
  });
  it('remove a cerca de código', () => {
    expect(limparHtml('```html\n<p>oi</p>\n```')).toBe('<p>oi</p>');
  });
  it('aponta números que não estão no contexto', () => {
    const ctx = 'Valor máximo R$ 100.000 e prazo de 24 meses; 150 estudantes';
    expect(numerosNaoSuportados('<p>Atende 150 estudantes em 6 etapas com R$ 100.000.</p>', ctx)).toEqual([]);
    expect(numerosNaoSuportados('<p>Atende 600 estudantes.</p>', ctx)).toEqual(['600']);
  });
});
