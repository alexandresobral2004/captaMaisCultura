import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analisarBlacklist } from '../lib/scraper/filtros/blacklist-engine';

describe('Blacklist Engine', () => {
  it('deve retornar score zero quando nenhum termo da blacklist estiver presente', () => {
    const result = analisarBlacklist(
      'Edital de Desenvolvimento de Software',
      'Este edital visa fomentar projetos inovadores de tecnologia, engenharia de software e inteligência artificial.'
    );
    expect(result.scoreNegativo).toBe(0);
    expect(result.termosEncontrados).toEqual([]);
    expect(result.severidade).toBe('baixa');
    expect(result.recomendacao).toBe('penalizar');
  });

  it('deve identificar e penalizar termos indesejados (sem exceção)', () => {
    const result = analisarBlacklist(
      'Edital de Desporto e Dança Contemporânea',
      'Fomento a projetos culturais, dança, teatro e artes plásticas nas escolas públicas.'
    );
    expect(result.scoreNegativo).toBeGreaterThan(0);
    expect(result.termosEncontrados.some((t) => t.termo === 'dança')).toBe(true);
    expect(result.termosEncontrados.some((t) => t.termo === 'teatro')).toBe(true);
  });

  it('deve atenuar penalidade quando exceção que contém o termo é encontrada', () => {
    // Texto com "saúde" (blacklist) mas casado com "saúde digital" (exceção que contém o termo)
    const resultComExcecao = analisarBlacklist(
      'Chamada Pública para Saúde Digital',
      'Buscamos soluções baseadas em inteligência artificial para o ecossistema de saúde digital.'
    );
    
    // Texto com "saúde" puro (bloqueio/penalização comum)
    const resultSemExcecao = analisarBlacklist(
      'Edital para Postos de Saúde Municipais',
      'Aquisição de materiais de consumo para postos de saúde e medicina.'
    );

    // O com exceção deve ter descontado o termo "saúde" (ficando com 0 ocorrências efetivas)
    const matchComExcecao = resultComExcecao.termosEncontrados.find((t) => t.termo === 'saúde');
    expect(matchComExcecao).toBeUndefined(); // Totalmente descontado pela exceção
    
    const matchSemExcecao = resultSemExcecao.termosEncontrados.find((t) => t.termo === 'saúde');
    expect(matchSemExcecao).toBeDefined();
    expect(matchSemExcecao!.ocorrencias).toBeGreaterThan(0);
  });

  it('deve atenuar penalidade quando exceção global que não contém o termo é encontrada', () => {
    // "e-health" é uma exceção global para "saúde" (que não contém a palavra "saúde" em si)
    const resultComGlobalExcecao = analisarBlacklist(
      'Chamada para projetos e-health',
      'Este programa apoia startups de e-health no desenvolvimento de softwares hospitalares.'
    );
    
    const match = resultComGlobalExcecao.termosEncontrados.find((t) => t.termo === 'saúde');
    expect(match).toBeUndefined(); // Totalmente neutralizado pela exceção global "e-health"
  });

  it('deve descontar ocorrências parciais e penalizar o restante', () => {
    // 2x "saúde" (1x pura e 1x em "saúde digital")
    const result = analisarBlacklist(
      'Fomento à Saúde Pública e Saúde Digital',
      'O edital apoia a saúde no Brasil e incentiva a saúde digital.'
    );
    
    const match = result.termosEncontrados.find((t) => t.termo === 'saúde');
    expect(match).toBeDefined();
    // 3 ocorrências totais de "saúde" ("saúde", "saúde", "saúde")
    // menos 2 ocorrências de "saúde digital" ("saúde digital", "saúde digital")
    // Ocorrências efetivas: 2
    expect(match!.ocorrencias).toBe(2);
    expect(match!.contexto).toContain('Reduzido');
  });

  it('deve calcular severidade alta e recomendar bloquear se o score negativo for alto', () => {
    const result = analisarBlacklist(
      'Edital de Artes Plásticas, Dança, Música, Cinema e Teatro',
      'Fomento a produções culturais em cinema, artes plásticas, escultura, teatro, dança, marketing e publicidade.'
    );
    expect(result.scoreNegativo).toBeGreaterThan(45);
    expect(result.severidade).toBe('alta');
    expect(result.recomendacao).toBe('bloquear');
  });

  it('deve ser case-insensitive e tolerar caracteres especiais de busca de regex', () => {
    const result = analisarBlacklist(
      'EDITAL DE CULTURA: DANÇA E CINEMA',
      'Este projeto apoia a dança (contemporânea).'
    );
    expect(result.termosEncontrados.some((t) => t.termo === 'dança')).toBe(true);
  });
});
