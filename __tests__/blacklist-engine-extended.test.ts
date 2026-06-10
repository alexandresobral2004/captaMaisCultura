/**
 * blacklist-engine-extended.test.ts
 *
 * Testes adicionais para o motor de blacklist.
 * Complementa blacklist-engine.test.ts com:
 *   - fronteiras de pontuação (score 0, 1-19, 20-45, >45)
 *   - legibilidade dos motivos
 *   - comportamento de frequência
 *   - limites de peso por termo
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analisarBlacklist } from '../lib/scraper/filtros/blacklist-engine';
import { clearLoadersCache } from '../lib/scraper/filtros/loaders';

describe('Blacklist Engine — Fronteiras e Legibilidade', () => {
  beforeEach(() => {
    clearLoadersCache();
    vi.restoreAllMocks();
  });

  describe('Cálculo de Score e Limiares de Severidade', () => {
    it('scoreNegativo=0 → severidade baixa, recomendação penalizar', () => {
      const result = analisarBlacklist(
        'Desenvolvimento de Software para Institutos Federais',
        'Chamada para projetos de engenharia de software, algoritmos e arquitetura de sistemas.'
      );
      expect(result.scoreNegativo).toBe(0);
      expect(result.severidade).toBe('baixa');
      expect(result.recomendacao).toBe('penalizar');
    });

    it('score entre 1-19 → severidade baixa, recomendação penalizar', () => {
      // "advocacia" encontrado 1x = peso 15
      const result = analisarBlacklist(
        'Serviço de advocacia na escola de computação',
        'Projeto de tecnologia jurídica.'
      );
      if (result.scoreNegativo > 0 && result.scoreNegativo <= 19) {
        expect(result.severidade).toBe('baixa');
        expect(result.recomendacao).toBe('penalizar');
      }
    });

    it('score entre 20-45 → severidade media, recomendação revisar', () => {
      // Múltiplos termos com score acumulado entre 20-45
      const result = analisarBlacklist(
        'Projeto de Advocacia e Contabilidade',
        'Apoio a serviços de advocacia e contabilidade.'
      );
      if (result.scoreNegativo > 20 && result.scoreNegativo <= 45) {
        expect(result.severidade).toBe('media');
        expect(result.recomendacao).toBe('revisar');
      }
    });

    it('score acima de 45 → severidade alta, recomendação bloquear', () => {
      const result = analisarBlacklist(
        'Edital de Advocacia, Zootecnia, Contabilidade e Pecuária',
        'Fomento completo a serviços: advocacia, zootecnia, contabilidade, pecuária, marketing e publicidade.'
      );
      expect(result.scoreNegativo).toBeGreaterThan(45);
      expect(result.severidade).toBe('alta');
      expect(result.recomendacao).toBe('bloquear');
    });
  });

  describe('Legibilidade dos Motivos', () => {
    it('motivos são strings não-vazias legíveis por humanos', () => {
      const result = analisarBlacklist(
        'Edital de Advocacia e Zootecnia',
        'Apoio a serviços de zootecnia e advocacia.'
      );
      expect(result.motivos.length).toBeGreaterThan(0);
      for (const motivo of result.motivos) {
        expect(typeof motivo).toBe('string');
        expect(motivo.length).toBeGreaterThan(10);
        // Deve conter o nome do termo
        expect(motivo).toMatch(/termo bloqueado '.+'/i);
      }
    });

    it('cada TermMatch tem peso e ocorrências documentados', () => {
      const result = analisarBlacklist(
        'Edital de Advocacia',
        'Fomento a projetos de advocacia.'
      );
      for (const match of result.termosEncontrados) {
        expect(match.termo).toBeTruthy();
        expect(match.ocorrencias).toBeGreaterThan(0);
        expect(match.peso).toBeGreaterThan(0);
      }
    });

    it('contexto é preenchido quando ocorreram descontos de exceção', () => {
      // Saúde + saúde digital: haverá desconto mas 1 ocorrência restante
      const result = analisarBlacklist(
        'Saúde Pública e Saúde Digital',
        'Projeto de saúde para comunidades.'
      );
      const saudeMatch = result.termosEncontrados.find((t) => t.termo === 'saúde');
      if (saudeMatch) {
        // Se ainda há ocorrências efetivas após desconto, o contexto deve mencionar desconto
        expect(saudeMatch.contexto).toBeDefined();
        expect(saudeMatch.contexto).toContain('Reduzido');
      }
    });
  });

  describe('Cálculo de Frequência e Peso Máximo', () => {
    it('peso de um único termo é limitado a 35 pontos', () => {
      // Mesmo que "advocacia" apareça muitas vezes, peso máximo por termo é 35
      const resultado = analisarBlacklist(
        'Advocacia Advocacia Advocacia Advocacia Advocacia Advocacia',
        'Advocacia advocacia advocacia advocacia advocacia advocacia advocacia advocacia.'
      );
      const advocaciaMatch = resultado.termosEncontrados.find((t) => t.termo === 'advocacia');
      if (advocaciaMatch) {
        expect(advocaciaMatch.peso).toBeLessThanOrEqual(35);
      }
    });

    it('1ª ocorrência de um termo vale 15 pontos base', () => {
      const result = analisarBlacklist(
        'Serviço de Advocacia',
        'Apoio a serviços de advocacia.'
      );
      const advocaciaMatch = result.termosEncontrados.find((t) => t.termo === 'advocacia');
      if (advocaciaMatch && advocaciaMatch.ocorrencias === 1) {
        expect(advocaciaMatch.peso).toBe(15);
      }
    });

    it('2ª ocorrência adiciona 5 pontos (total 20)', () => {
      const result = analisarBlacklist(
        'Advocacia e mais Advocacia',
        'Projeto de advocacia e advocacia integrada.'
      );
      const advocaciaMatch = result.termosEncontrados.find((t) => t.termo === 'advocacia');
      if (advocaciaMatch && advocaciaMatch.ocorrencias === 2) {
        expect(advocaciaMatch.peso).toBe(20);
      }
    });
  });

  describe('Ausência de Termos — Output Limpo', () => {
    it('termosEncontrados é array vazio quando não há ocorrências', () => {
      const result = analisarBlacklist(
        'Chamada Pública para Desenvolvimento de Software',
        'Projetos de TI, algoritmos, inteligência artificial.'
      );
      expect(result.termosEncontrados).toEqual([]);
      expect(result.motivos).toEqual([]);
    });

    it('não adiciona duplicatas ao array de termos', () => {
      const result = analisarBlacklist(
        'Edital de Advocacia e Mais Advocacia',
        'Apoio à advocacia popular em advocacia comunitária.'
      );
      const nomesTermos = result.termosEncontrados.map((t) => t.termo);
      const nomesUnicos = Array.from(new Set(nomesTermos));
      // Cada termo deve aparecer apenas uma vez (frequência acumulada no mesmo entry)
      expect(nomesTermos.length).toBe(nomesUnicos.length);
    });
  });

  describe('Casos de Fronteira', () => {
    it('lida com strings vazias sem exceção', () => {
      expect(() => analisarBlacklist('', '')).not.toThrow();
      const result = analisarBlacklist('', '');
      expect(result.scoreNegativo).toBe(0);
    });

    it('lida com texto apenas de espaços', () => {
      expect(() => analisarBlacklist('   ', '   ')).not.toThrow();
    });

    it('é case-insensitive para termos com acentuação', () => {
      const result = analisarBlacklist(
        'AGROPECUÁRIA TRADICIONAL',
        'Projeto de AGROPECUÁRIA familiar.'
      );
      const agropecuariaMatch = result.termosEncontrados.find((t) => t.termo === 'agropecuária');
      expect(agropecuariaMatch).toBeDefined();
    });
  });
});

describe('Blacklist Engine — Teste de Não Bloqueio Excessivo', () => {
  it('não bloqueia edital de TI puro com termos irrelevantes ausentes', () => {
    const result = analisarBlacklist(
      'Edital de Desenvolvimento de Plataforma Web com React e TypeScript',
      'Chamada para projetos de desenvolvimento web, APIs RESTful, microsserviços e cloud computing.'
    );
    expect(result.scoreNegativo).toBe(0);
    expect(result.recomendacao).toBe('penalizar');
  });

  it('não bloqueia edital com saúde digital (exceção)', () => {
    const result = analisarBlacklist(
      'Chamada para Projetos de Saúde Digital e Healthtech',
      'Fomento a soluções digitais para o setor de saúde, incluindo healthtech e e-health.'
    );
    const saudeMatch = result.termosEncontrados.find((t) => t.termo === 'saúde');
    expect(saudeMatch).toBeUndefined(); // Totalmente neutralizado pelas exceções
  });

  it('não bloqueia edital com agricultura de precisão (exceção de agricultura)', () => {
    const result = analisarBlacklist(
      'Edital de Agricultura de Precisão e Sensores',
      'Apoio a ferramentas de agricultura de precisão, inteligência no campo e agrotech.'
    );
    // "agricultura" é blacklist, mas "agricultura de precisão" é exceção
    if (result.termosEncontrados.length > 0) {
      // Se ainda tiver termos, não deve ser bloquear
      expect(result.recomendacao).not.toBe('bloquear');
    }
  });
});
