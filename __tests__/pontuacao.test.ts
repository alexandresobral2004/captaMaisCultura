import { describe, it, expect } from 'vitest';
import { pontuar, comporNota, notaDoJev, camadaChamada, camadaEixo, camadaRegiao, camadaDocumento } from '../lib/triagem/pontuacao';
import { restritoAOutraRegiao } from '../lib/triagem/regiao';
import { validarDocumentoEdital } from '../lib/scraper/validacao-documento';

const p = (titulo: string, eixo: 'Cultura' | 'Pesquisa', descricao = '', orgao?: string) => pontuar({ titulo, descricao, eixo, orgao });

describe('C1: é chamada', () => {
  it('edital com inscrição e prazo soma pontos', () => {
    const c = camadaChamada({ titulo: 'Edital nº 12/2026 - Chamada Pública', descricao: 'Inscrições até o prazo de 30 dias; bolsa de fomento', eixo: 'Pesquisa' });
    expect(c.pontos).toBeGreaterThanOrEqual(30);
    expect(c.achados.join(' ')).toContain('inscrições');
  });

  it('item de menu perde pontos', () => {
    const c = camadaChamada({ titulo: 'Perguntas Frequentes', descricao: '', eixo: 'Pesquisa' });
    expect(c.pontos).toBeLessThan(0);
  });

  it('notícia e resultado final perdem pontos no eixo Cultura', () => {
    const c = camadaChamada({ titulo: 'Notícia: resultado final do festival', descricao: '', eixo: 'Cultura' });
    expect(c.pontos).toBeLessThan(0);
  });

  it('"chamada pública" não conta duas vezes como "chamada"', () => {
    const c = camadaChamada({ titulo: 'Chamada pública', descricao: '', eixo: 'Pesquisa' });
    expect(c.achados).toEqual(['chamada pública +12']);
  });
});

describe('C2: eixo', () => {
  it('termo genérico sozinho não pontua (festival genérico)', () => {
    const c = camadaEixo({ titulo: 'Festival de verão', descricao: '', eixo: 'Cultura' });
    expect(c.pontos).toBe(0);
    expect(c.fortes).toBe(0);
  });

  it('genérico reforça quando há termo forte', () => {
    const sozinho = camadaEixo({ titulo: 'Teatro', descricao: '', eixo: 'Cultura' });
    const junto = camadaEixo({ titulo: 'Teatro', descricao: 'festival', eixo: 'Cultura' });
    expect(junto.pontos).toBeGreaterThan(sozinho.pontos);
  });

  it('edital de TI com a palavra "chamada" pontua pelos termos de TI, não pela chamada', () => {
    const c = camadaEixo({ titulo: 'Chamada para projetos de inteligência artificial e machine learning', descricao: '', eixo: 'Pesquisa' });
    expect(c.fortes).toBeGreaterThanOrEqual(2);
    expect(c.achados.join(' ')).not.toMatch(/^chamada /);
  });

  it('termos da blacklist de TI descontam só no eixo Pesquisa', () => {
    const ti = camadaEixo({ titulo: 'Software para gestão de marketing e publicidade', descricao: '', eixo: 'Pesquisa' });
    expect(ti.achados.join(' ')).toContain('blacklist');
  });
});

describe('C3: região', () => {
  it('abrangência nacional ou Nordeste ganha pontos', () => {
    expect(camadaRegiao({ titulo: 'Chamada nacional de bolsas', descricao: '', eixo: 'Pesquisa' }).pontos).toBeGreaterThan(10);
  });

  it('sem menção territorial fica neutro', () => {
    const c = camadaRegiao({ titulo: 'Chamada de bolsas', descricao: '', eixo: 'Pesquisa' });
    expect(c.pontos).toBe(10);
    expect(c.veto).toBeUndefined();
  });

  it('edital de Belém (PA) e sigla de estado depois do traço são vetados', () => {
    expect(camadaRegiao({ titulo: 'BELÉM PA - CHAMAMENTO PÚBLICO - CULTURA - 2026', descricao: '', eixo: 'Cultura' }).veto).toBeTruthy();
    expect(camadaRegiao({ titulo: 'Chamamento público de fomento à cultura - PA', descricao: '', eixo: 'Cultura' }).veto).toBeTruthy();
  });

  it('FAPEAP e FAPERO são fundações de outro estado', () => {
    expect(restritoAOutraRegiao({ titulo: 'Chamada FAPEAP 2026 de bolsas' }).restrito).toBe(true);
    expect(restritoAOutraRegiao({ titulo: 'Chamada de pesquisa', orgao: 'FAPERO' }).restrito).toBe(true);
    expect(restritoAOutraRegiao({ titulo: 'Chamada FUNCAP 2026' }).restrito).toBe(false);
  });

  it('município do Ceará não é vetado', () => {
    expect(camadaRegiao({ titulo: 'FORTALEZA/CE - BOLSA - ARTISTAS - 2026', descricao: '', eixo: 'Cultura' }).veto).toBeUndefined();
    expect(camadaRegiao({ titulo: 'SOBRAL/CE - FOMENTO - CULTURA - 2026', descricao: '', eixo: 'Cultura' }).veto).toBeUndefined();
    expect(camadaRegiao({ titulo: 'CEARÁ - FOMENTO - CULTURA - 2026', descricao: '', eixo: 'Cultura' }).veto).toBeUndefined();
  });
});

describe('C4: documento', () => {
  it('pontua por grupo distinto e exige um grupo forte', () => {
    const forte = camadaDocumento(['identificacao', 'objeto', 'inscricao', 'prazo']);
    const frouxo = camadaDocumento(['identificacao', 'prazo', 'recursos']);
    expect(forte.pontos).toBeGreaterThan(frouxo.pontos);
    expect(frouxo.achados.join(' ')).toContain('sem objeto nem inscrição');
  });

  it('documento com vários grupos mas sem objeto nem inscrição não é aceito só pela regra', async () => {
    const texto = 'Edital. O prazo é de 30 dias. Recursos financeiros: R$ 100.000. Critérios de seleção. Disposições finais.';
    const r = await validarDocumentoEdital({ titulo: 'Manual', orgao: 'X', texto }, null);
    expect(r.grupos.length).toBeGreaterThanOrEqual(3);
    expect(r.decisao).toBe('duvida');
  });

  it('com objeto e inscrição a regra aceita', async () => {
    const texto = 'Edital. Do objeto. Inscrições abertas. O prazo é de 30 dias. Critérios de seleção.';
    const r = await validarDocumentoEdital({ titulo: 'Edital', orgao: 'X', texto }, null);
    expect(r.decisao).toBe('valido');
  });
});

describe('composição da nota', () => {
  it('sem Jev vale só a notaRegex', () => {
    expect(comporNota(70, null)).toMatchObject({ notaFinal: 70, faixa: 'liberar' });
    expect(comporNota(40, null).faixa).toBe('cinza');
    expect(comporNota(15, null).faixa).toBe('bloquear');
  });

  it('com Jev combina as duas notas pelos pesos', () => {
    const n = comporNota(50, 90);
    expect(n.notaFinal).toBe(Math.round(0.4 * 50 + 0.6 * 90));
    expect(n.faixa).toBe('liberar');
  });

  it('com Jev, nota baixa só bloqueia se o Jev tiver certeza; senão é zona cinzenta', () => {
    expect(comporNota(10, 30).faixa).toBe('cinza'); // Jev acha 70% improvável: não é certeza
    expect(comporNota(10, 5).faixa).toBe('bloquear');
  });

  it('com Jev, nota alta sem o Jev achar provável não libera', () => {
    expect(comporNota(100, 40).faixa).toBe('cinza');
  });

  it('notaDoJev é p(chamada) × p(relevante)', () => {
    expect(notaDoJev(0.9, 0.5)).toBe(45);
  });
});

describe('casos reais', () => {
  it('menu institucional fica abaixo do corte de bloqueio', () => {
    const r = p('Carta de Serviços', 'Pesquisa');
    expect(comporNota(r.notaRegex, null).faixa).toBe('bloquear');
  });

  it('notícia de cultura fica abaixo do corte de bloqueio', () => {
    const r = p('Notícia: museu reabre', 'Cultura', 'Entrevista com a diretora do museu');
    expect(comporNota(r.notaRegex, null).faixa).toBe('bloquear');
  });

  it('chamada clara de cultura passa sem Jev', () => {
    const r = p('Chamada pública para festival de teatro e dança', 'Cultura', 'Apoio a grupos artísticos. Inscrições abertas.');
    expect(comporNota(r.notaRegex, null).faixa).toBe('liberar');
  });

  it('edital de TI com a palavra "chamada" passa', () => {
    const r = p('Chamada FINEP de fomento a inteligência artificial', 'Pesquisa', 'Subvenção para startups de IA e machine learning. Submissão de propostas.');
    expect(comporNota(r.notaRegex, null).faixa).toBe('liberar');
  });

  it('festival genérico, sem outro sinal de cultura, não passa', () => {
    const r = p('Festival de verão', 'Cultura');
    expect(r.eixo.fortes).toBe(0);
    expect(comporNota(r.notaRegex, null).faixa).not.toBe('liberar');
  });

  it('edital de Belém e de FAPEAP trazem veto, qualquer que seja a nota', () => {
    expect(p('BELÉM PA - CHAMAMENTO PÚBLICO - AUDIOVISUAL - 2026', 'Cultura').vetos).toHaveLength(1);
    expect(p('Chamada FAPEAP de apoio à pesquisa', 'Pesquisa').vetos).toHaveLength(1);
  });
});
