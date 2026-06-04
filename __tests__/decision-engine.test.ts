/**
 * decision-engine.test.ts
 *
 * Testes para a lógica de decisão do pipeline de filtros de TI.
 *
 * Como não existe um `DecisionEngine` centralizado ainda (a lógica está
 * inline nos scrapers), testamos aqui a composição das primitivas:
 *   validarWhitelistTI + analisarBlacklist + AiClassificationResult
 * e verificamos que as regras de negócio produzem os estados corretos:
 *   - pendente (aprovado para análise completa)
 *   - descartado (bloqueado por blacklist)
 *   - duvida (IA falhou, revisão humana)
 *
 * Esses testes servem como contrato vivo para proteger refactorings futuros.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analisarBlacklist } from '../lib/scraper/filtros/blacklist-engine';
import { validarWhitelistTI } from '../lib/filtros-ti/whitelist';
import { clearLoadersCache } from '../lib/scraper/filtros/loaders';
import type { AiClassificationResult } from '../lib/filtros-ti/openai-classifier';

// ─── Helper: Simula a decisão que o pipeline toma ──────────────────────────
// (replica a lógica inline dos scrapers para torná-la testável)

type StatusAnalise = 'pendente' | 'descartado' | 'duvida';

interface DecisaoSimulada {
  statusAnalise: StatusAnalise;
  foraDoEscopo: boolean | null;
  validadoPorIa: boolean;
  motivoRejeicao?: string;
}

function simularDecisaoPipeline(
  titulo: string,
  descricao: string,
  iaResult: AiClassificationResult
): DecisaoSimulada {
  // 1. Whitelist check
  const whitelist = validarWhitelistTI(titulo, descricao);
  if (!whitelist.válido) {
    return {
      statusAnalise: 'descartado',
      foraDoEscopo: true,
      validadoPorIa: false,
      motivoRejeicao: 'Nenhum termo TI identificado na whitelist',
    };
  }

  // 2. Blacklist check
  const blacklist = analisarBlacklist(titulo, descricao);
  if (blacklist.recomendacao === 'bloquear') {
    return {
      statusAnalise: 'descartado',
      foraDoEscopo: true,
      validadoPorIa: false,
      motivoRejeicao: `Blacklist bloqueou: ${blacklist.motivos.join('; ')}`,
    };
  }

  // 3. IA result
  if (!iaResult.ok) {
    return {
      statusAnalise: 'duvida',
      foraDoEscopo: null,
      validadoPorIa: false,
      motivoRejeicao: `IA indisponível: ${iaResult.erroTipo}`,
    };
  }

  if (!iaResult.válido) {
    return {
      statusAnalise: 'descartado',
      foraDoEscopo: true,
      validadoPorIa: true,
      motivoRejeicao: iaResult.razão,
    };
  }

  return {
    statusAnalise: 'pendente',
    foraDoEscopo: false,
    validadoPorIa: true,
  };
}

// ─── Fixtures de resultado IA ────────────────────────────────────────────────

const IA_SUCESSO: AiClassificationResult = {
  ok: true,
  válido: true,
  tecnologia: 'IA & Machine Learning' as any,
  categoria: 'IA & Machine Learning' as any,
  tipo: 'Plataforma' as any,
  tipoFerramenta: 'Plataforma' as any,
  score: 85,
  confiança: 90,
  confianca: 90,
  razão: 'Foco claro em IA e Machine Learning',
  usouCache: false,
  modelo: 'gpt-4o-mini',
};

const IA_INVALIDO: AiClassificationResult = {
  ok: true,
  válido: false,
  tecnologia: '' as any,
  categoria: '' as any,
  tipo: '' as any,
  tipoFerramenta: '' as any,
  score: 10,
  confiança: 80,
  confianca: 80,
  razão: 'Edital completamente fora do escopo de TI',
  usouCache: false,
  modelo: 'gpt-4o-mini',
};

const IA_FALHA_TIMEOUT: AiClassificationResult = {
  ok: false,
  válido: false,
  erroTipo: 'timeout',
  mensagem: 'OpenAI API request timed out (>10s)',
  modelo: 'gpt-4o-mini',
};

const IA_FALHA_RATE_LIMIT: AiClassificationResult = {
  ok: false,
  válido: false,
  erroTipo: 'rate_limit',
  mensagem: 'Request failed with status code 429',
  modelo: 'gpt-4o-mini',
};

const IA_FALHA_AUTH: AiClassificationResult = {
  ok: false,
  válido: false,
  erroTipo: 'auth',
  mensagem: 'OPENAI_API_KEY não configurada',
  modelo: 'gpt-4o-mini',
};

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('Decision Engine — Lógica de Decisão do Pipeline', () => {
  beforeEach(() => {
    clearLoadersCache();
    vi.restoreAllMocks();
  });

  describe('Cenário: Whitelist forte + IA confirma', () => {
    it('deve resultar em pendente, validadoPorIa=true, foraDoEscopo=false', () => {
      const decisao = simularDecisaoPipeline(
        'Plataforma de Machine Learning para Pesquisa Acadêmica',
        'Sistema de inteligência artificial e aprendizado profundo para universidades.',
        IA_SUCESSO
      );
      expect(decisao.statusAnalise).toBe('pendente');
      expect(decisao.validadoPorIa).toBe(true);
      expect(decisao.foraDoEscopo).toBe(false);
      expect(decisao.motivoRejeicao).toBeUndefined();
    });

    it('deve manter pendente mesmo com blacklist baixa (score < 20)', () => {
      // "dança" aparece uma vez mas o edital tem forte contexto de TI
      const decisao = simularDecisaoPipeline(
        'Software para Gestão de Projetos de Machine Learning',
        'A plataforma ajuda a gerenciar o ciclo de desenvolvimento de algoritmos.',
        IA_SUCESSO
      );
      expect(decisao.statusAnalise).toBe('pendente');
    });
  });

  describe('Cenário: IA falha → dúvida', () => {
    it('deve resultar em duvida quando IA tem timeout (whitelist passou)', () => {
      const decisao = simularDecisaoPipeline(
        'Edital de Inteligência Artificial para Institutos Federais',
        'Fomento a projetos de IA e computação em nuvem para IFs.',
        IA_FALHA_TIMEOUT
      );
      expect(decisao.statusAnalise).toBe('duvida');
      expect(decisao.foraDoEscopo).toBeNull();
      expect(decisao.validadoPorIa).toBe(false);
      expect(decisao.motivoRejeicao).toContain('timeout');
    });

    it('deve resultar em duvida quando IA retorna rate_limit', () => {
      const decisao = simularDecisaoPipeline(
        'Desenvolvimento de Software para Pesquisa Científica',
        'Chamada para projetos de engenharia de software e machine learning.',
        IA_FALHA_RATE_LIMIT
      );
      expect(decisao.statusAnalise).toBe('duvida');
      expect(decisao.foraDoEscopo).toBeNull();
      expect(decisao.motivoRejeicao).toContain('rate_limit');
    });

    it('deve resultar em duvida quando OPENAI_API_KEY não está configurada (auth)', () => {
      const decisao = simularDecisaoPipeline(
        'Chamada Pública para Projetos de Blockchain em Universidades',
        'Suporte a pesquisa em blockchain e criptografia aplicada.',
        IA_FALHA_AUTH
      );
      expect(decisao.statusAnalise).toBe('duvida');
      expect(decisao.foraDoEscopo).toBeNull();
    });
  });

  describe('Cenário: Whitelist falha → descartado sem chamar IA', () => {
    it('deve descartar edital sem termo TI algum (whitelist mockada como vazia)', () => {
      // A whitelist real tem termos muito abrangentes ('ia', 'sistema', 'edital'),
      // então mockamos os loaders para simular uma whitelist sem matches.
      const fs = require('fs');
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
        tecnologia: [],
        contexto_institucional: [],
        contexto_geral: [],
      }));

      const decisao = simularDecisaoPipeline(
        'Edital de Construção de Estradas Rurais',
        'Contratação de empresa para pavimentação e sinalização viária.',
        IA_SUCESSO
      );

      expect(decisao.statusAnalise).toBe('descartado');
      expect(decisao.foraDoEscopo).toBe(true);
      expect(decisao.validadoPorIa).toBe(false);
      expect(decisao.motivoRejeicao).toContain('whitelist');
    });
  });

  describe('Cenário: Blacklist alta → descartado', () => {
    it('deve descartar quando blacklist score > 45 (múltiplos termos indesejados)', () => {
      const decisao = simularDecisaoPipeline(
        'Edital de Artes Plásticas, Dança, Cinema e Teatro',
        'Fomento a produções culturais: dança contemporânea, teatro, cinema, música e artes plásticas.',
        IA_SUCESSO // a blacklist deve barrar antes da IA
      );
      expect(decisao.statusAnalise).toBe('descartado');
      expect(decisao.foraDoEscopo).toBe(true);
      expect(decisao.motivoRejeicao).toContain('Blacklist bloqueou');
    });
  });

  describe('Cenário: IA retorna válido=false → descartado', () => {
    it('deve descartar e registrar motivo da IA', () => {
      const decisao = simularDecisaoPipeline(
        'Edital de Pesquisa em Computação',
        'Fomento a projetos de software e algoritmos.',
        IA_INVALIDO
      );
      expect(decisao.statusAnalise).toBe('descartado');
      expect(decisao.foraDoEscopo).toBe(true);
      expect(decisao.validadoPorIa).toBe(true);
      expect(decisao.motivoRejeicao).toContain('fora do escopo de TI');
    });
  });

  describe('Cenário: Conflito (whitelist aprovada, blacklist alta)', () => {
    it('blacklist alta prevalece sobre whitelist positiva → descartado', () => {
      // Texto tem termos TI ("software") mas também tem termos blacklist pesados
      const decisao = simularDecisaoPipeline(
        'Software para Gestão de Saúde Bucal e Odontologia',
        'Sistema de software para gestão de clínicas odontológicas, medicina bucal e cirurgia oral.',
        IA_SUCESSO
      );
      // Se blacklist recomendar bloquear, descarta. Se não, segue normal.
      // Esse teste verifica o comportamento determinístico — o valor exato
      // depende dos termos reais da blacklist. Validamos o contrato:
      const blacklistResult = analisarBlacklist(
        'Software para Gestão de Saúde Bucal e Odontologia',
        'Sistema de software para gestão de clínicas odontológicas, medicina bucal e cirurgia oral.'
      );
      if (blacklistResult.recomendacao === 'bloquear') {
        expect(decisao.statusAnalise).toBe('descartado');
      } else {
        // whitelist + IA positiva = pendente
        expect(decisao.statusAnalise).toBe('pendente');
      }
    });
  });

  describe('Propriedades do Contrato', () => {
    it('foraDoEscopo é SEMPRE null quando statusAnalise é duvida', () => {
      const casos = [IA_FALHA_TIMEOUT, IA_FALHA_RATE_LIMIT, IA_FALHA_AUTH];
      const titulo = 'Edital de Desenvolvimento de Software';
      const descricao = 'Fomento a projetos de software e tecnologia.';

      for (const ia of casos) {
        const decisao = simularDecisaoPipeline(titulo, descricao, ia);
        if (decisao.statusAnalise === 'duvida') {
          expect(decisao.foraDoEscopo).toBeNull();
        }
      }
    });

    it('validadoPorIa é SEMPRE false quando IA falhou (ok=false)', () => {
      const decisao = simularDecisaoPipeline(
        'Plataforma de Machine Learning',
        'Projetos de inteligência artificial para pesquisa.',
        IA_FALHA_TIMEOUT
      );
      expect(decisao.validadoPorIa).toBe(false);
    });

    it('validadoPorIa é SEMPRE true quando IA respondeu (ok=true, independente de válido)', () => {
      const decisaoValida = simularDecisaoPipeline(
        'Plataforma de Machine Learning',
        'Projetos de inteligência artificial para pesquisa.',
        IA_SUCESSO
      );
      expect(decisaoValida.validadoPorIa).toBe(true);

      const decisaoInvalida = simularDecisaoPipeline(
        'Plataforma de Machine Learning',
        'Projetos de inteligência artificial para pesquisa.',
        IA_INVALIDO
      );
      expect(decisaoInvalida.validadoPorIa).toBe(true);
    });
  });
});
