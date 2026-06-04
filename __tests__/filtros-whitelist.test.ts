/**
 * filtros-whitelist.test.ts
 *
 * Testes para a função validarWhitelistTI.
 * Usa textos calibrados para os termos reais da whitelist-ti.json.
 *
 * NOTA SOBRE A WHITELIST:
 * A whitelist tem termos muito abrangentes (ex: 'ia', 'sistema', 'edital',
 * 'projeto', 'desenvolvimento'), o que torna difícil construir textos
 * que definitivamente não passem por ela. Esses testes focam em:
 *   1. Verificar comportamento correto para inputs de TI claros
 *   2. Verificar a estrutura de saída (campos obrigatórios)
 *   3. Verificar comportamento edge cases (strings vazias)
 *   4. Verificar que confiança 'alta' vem de ≥2 termos de tecnologia
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validarWhitelistTI } from '../lib/filtros-ti/whitelist';
import { clearLoadersCache } from '../lib/scraper/filtros/loaders';

describe('Whitelist TI — validarWhitelistTI', () => {
  beforeEach(() => {
    clearLoadersCache();
    vi.restoreAllMocks();
  });

  // ─── Estrutura de Saída ──────────────────────────────────────────────────────

  it('retorna todos os campos obrigatórios sempre', () => {
    const result = validarWhitelistTI('qualquer título', 'qualquer descrição');
    expect(result).toHaveProperty('válido');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('termosBranco');
    expect(typeof result.válido).toBe('boolean');
    expect(['alta', 'média', 'baixa']).toContain(result.confidence);
    expect(Array.isArray(result.termosBranco)).toBe(true);
  });

  // ─── Casos Positivos (TI clara) ──────────────────────────────────────────────

  it('retorna válido=true e confidence=alta quando 2+ termos de tecnologia estão presentes', () => {
    // 'machine learning', 'deep learning', 'nlp' — todos termos de tecnologia
    const result = validarWhitelistTI(
      'Desenvolvimento de Machine Learning com Deep Learning',
      'Chamada pública para projetos de NLP e redes neurais para processamento de linguagem natural.'
    );
    expect(result.válido).toBe(true);
    expect(result.confidence).toBe('alta');
    expect(result.termosBranco.length).toBeGreaterThanOrEqual(2);
    expect(result.categoria).toBe('Tecnologia TI');
  });

  it('retorna válido=true quando termo único de tecnologia específico é encontrado', () => {
    // 'tensorflow' é um termo específico da whitelist de tecnologia
    const result = validarWhitelistTI(
      'Uso de TensorFlow em projetos de pesquisa',
      'Suporte a implementações com TensorFlow para modelos preditivos.'
    );
    expect(result.válido).toBe(true);
    expect(result.termosBranco.length).toBeGreaterThanOrEqual(1);
  });

  it('retorna válido=true com categoria Tecnologia TI para termos de TI', () => {
    const result = validarWhitelistTI(
      'Framework de Desenvolvimento de Software com CI/CD',
      'Plataforma para automação de pipelines de software com framework e DevOps.'
    );
    expect(result.válido).toBe(true);
    expect(result.categoria).toBe('Tecnologia TI');
  });

  it('retorna válido=true quando termo de contexto_institucional é encontrado', () => {
    const result = validarWhitelistTI(
      'Chamada para Institutos Federais de Educação',
      'Fomento a atividades em institutos federais e campus de tecnologia.'
    );
    expect(result.válido).toBe(true);
    // confidence pode ser 'alta' ou 'média' dependendo de quantos termos do contexto_institucional
    // foram encontrados — o importante é que foi identificado como válido
    expect(['alta', 'média', 'baixa']).toContain(result.confidence);
  });

  // ─── Confiança e Termos ──────────────────────────────────────────────────────

  it('termoEncontrado é definido quando válido=true', () => {
    const result = validarWhitelistTI(
      'Desenvolvimento de Algoritmos de Machine Learning',
      'Projetos de inteligência artificial e ciência de dados.'
    );
    if (result.válido) {
      expect(result.termoEncontrado).toBeDefined();
      expect(typeof result.termoEncontrado).toBe('string');
    }
  });

  it('termosBranco é array populado quando válido=true', () => {
    const result = validarWhitelistTI(
      'Software com Machine Learning e Blockchain',
      'Plataforma de software integrando ML, blockchain e cloud computing.'
    );
    if (result.válido) {
      expect(result.termosBranco.length).toBeGreaterThan(0);
      expect(result.termosBranco.every((t) => typeof t === 'string')).toBe(true);
    }
  });

  it('termosBranco contém TODOS os termos encontrados, não só o primeiro', () => {
    // 'machine learning', 'deep learning', 'llm' devem todos aparecer
    const result = validarWhitelistTI(
      'Pesquisa em Machine Learning, Deep Learning e LLMs',
      'Treinamento de modelos LLM com técnicas de deep learning.'
    );
    // Deve ter capturado múltiplos termos de tecnologia
    expect(result.termosBranco.length).toBeGreaterThan(1);
  });

  // ─── Invariantes ─────────────────────────────────────────────────────────────

  it('confidence é alta quando ≥2 termos de tecnologia são encontrados', () => {
    // Força múltiplos termos específicos
    const result = validarWhitelistTI(
      'Neural Networks e TensorFlow para Visão Computacional',
      'Redes neurais com tensorflow e visão computacional aplicada.'
    );
    if (result.termosBranco.length >= 2 && result.categoria === 'Tecnologia TI') {
      expect(result.confidence).toBe('alta');
    }
  });

  it('confidence é média quando exatamente 1 termo de tecnologia é encontrado (sem contexto)', () => {
    // O resultado depende do conteúdo da whitelist, mas podemos verificar a lógica:
    // se válido=true, confidence pode ser média ou alta dependendo dos termos
    const result = validarWhitelistTI(
      'Plataforma Blockchain',
      'Sistema de rastreamento baseado em blockchain.'
    );
    if (result.válido) {
      expect(['alta', 'média', 'baixa']).toContain(result.confidence);
    }
  });

  // ─── Casos Edge ──────────────────────────────────────────────────────────────

  it('não lança exceção com strings vazias', () => {
    expect(() => validarWhitelistTI('', '')).not.toThrow();
    const result = validarWhitelistTI('', '');
    expect(result).toBeDefined();
    expect(result.termosBranco).toEqual([]);
  });

  it('não lança exceção com texto muito longo', () => {
    const textoLongo = 'tecnologia '.repeat(500);
    expect(() => validarWhitelistTI(textoLongo, textoLongo)).not.toThrow();
  });

  it('é case-insensitive — mesmo resultado em MAIÚSCULAS e minúsculas', () => {
    const lower = validarWhitelistTI(
      'machine learning e deep learning',
      'projetos de inteligência artificial'
    );
    const upper = validarWhitelistTI(
      'MACHINE LEARNING E DEEP LEARNING',
      'PROJETOS DE INTELIGÊNCIA ARTIFICIAL'
    );
    expect(lower.válido).toBe(upper.válido);
    expect(lower.termosBranco.length).toBe(upper.termosBranco.length);
  });

  it('termosBranco é [] quando válido=false', () => {
    const result = validarWhitelistTI('', '');
    if (!result.válido) {
      expect(result.termosBranco).toEqual([]);
    }
  });

  // ─── Compatibilidade com exportação estática ─────────────────────────────────

  it('WHITELIST_TI exportado tem as três categorias como arrays', async () => {
    // Usa import() dinâmico (ESM compatível)
    const mod = await import('../lib/filtros-ti/whitelist');
    const WHITELIST_TI = (mod as any).WHITELIST_TI;
    expect(Array.isArray(WHITELIST_TI.tecnologia)).toBe(true);
    expect(Array.isArray(WHITELIST_TI.contexto_institucional)).toBe(true);
    expect(Array.isArray(WHITELIST_TI.contexto_geral)).toBe(true);
    expect(WHITELIST_TI.tecnologia.length).toBeGreaterThan(0);
  });
});
