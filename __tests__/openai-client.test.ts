import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  lerApiKey,
  apiKeyConfigurada,
  obterApiKey,
  obterModelo,
  obterModeloRedacao,
  aceitaTemperatura,
  obterClienteOpenAI,
  OpenAIKeyMissingError,
} from '../lib/ai/client';

describe('lib/ai/client', () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_MODEL_FULL;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it('sem chave: lerApiKey é undefined e obterApiKey lança erro tipado', () => {
    expect(lerApiKey()).toBeUndefined();
    expect(apiKeyConfigurada()).toBe(false);
    expect(() => obterApiKey()).toThrow(OpenAIKeyMissingError);
    expect(() => obterClienteOpenAI()).toThrow('OPENAI_API_KEY não está definida');
  });

  it('lê a chave sob demanda, depois da importação do módulo', () => {
    process.env.OPENAI_API_KEY = 'sk-teste';
    expect(apiKeyConfigurada()).toBe(true);
    expect(obterApiKey()).toBe('sk-teste');
  });

  it('modelos: padrões e sobrescrita por variável de ambiente', () => {
    expect(obterModelo()).toBe('gpt-4o-mini');
    expect(obterModelo('mini')).toBe('gpt-4o-mini');
    expect(obterModelo('full')).toBe('gpt-4o');

    process.env.OPENAI_MODEL = 'modelo-mini-x';
    process.env.OPENAI_MODEL_FULL = 'modelo-full-y';
    expect(obterModelo('mini')).toBe('modelo-mini-x');
    expect(obterModelo('full')).toBe('modelo-full-y');
  });

  it('reaproveita o cliente enquanto a chave não muda e recria quando muda', () => {
    process.env.OPENAI_API_KEY = 'sk-a';
    const a1 = obterClienteOpenAI();
    expect(obterClienteOpenAI()).toBe(a1);

    process.env.OPENAI_API_KEY = 'sk-b';
    expect(obterClienteOpenAI()).not.toBe(a1);
  });

  it('modelo de redação: gpt-5.6-luna por padrão, respeitando OPENAI_MODEL_REDACAO', () => {
    delete process.env.OPENAI_MODEL_REDACAO;
    expect(obterModeloRedacao()).toBe('gpt-5.6-luna');
    process.env.OPENAI_MODEL_REDACAO = 'gpt-4o';
    expect(obterModeloRedacao()).toBe('gpt-4o');
  });

  it('modelos de raciocínio não recebem temperatura', () => {
    expect(aceitaTemperatura('gpt-5.6-luna')).toBe(false);
    expect(aceitaTemperatura('o3-mini')).toBe(false);
    expect(aceitaTemperatura('gpt-4o-mini')).toBe(true);
  });
});
