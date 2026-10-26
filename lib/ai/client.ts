import OpenAI from 'openai';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Ponto único de acesso à OpenAI: chave, modelos e clientes.
 * A leitura do ambiente é feita sob demanda (não na importação), para respeitar
 * variáveis carregadas depois (ex.: .env.local) e facilitar testes.
 */

export type NivelModelo = 'mini' | 'full';

export const MENSAGEM_CHAVE_AUSENTE =
  'OPENAI_API_KEY não está definida. Configure a variável de ambiente.';

export class OpenAIKeyMissingError extends Error {
  constructor() {
    super(MENSAGEM_CHAVE_AUSENTE);
    this.name = 'OpenAIKeyMissingError';
  }
}

/** Retorna a chave configurada ou undefined (para fluxos com fallback sem IA). */
export function lerApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || undefined;
}

export function apiKeyConfigurada(): boolean {
  return lerApiKey() !== undefined;
}

/** Retorna a chave ou lança OpenAIKeyMissingError. */
export function obterApiKey(): string {
  const chave = lerApiKey();
  if (!chave) throw new OpenAIKeyMissingError();
  return chave;
}

/**
 * Modelo por nível. `mini` respeita OPENAI_MODEL (padrão gpt-4o-mini);
 * `full` respeita OPENAI_MODEL_FULL (padrão gpt-4o).
 */
export function obterModelo(nivel: NivelModelo = 'mini'): string {
  return nivel === 'full'
    ? process.env.OPENAI_MODEL_FULL || 'gpt-4o'
    : process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

/** Modelo que redige o texto dos projetos. Respeita OPENAI_MODEL_REDACAO (padrão gpt-5.6-luna). */
export function obterModeloRedacao(): string {
  return process.env.OPENAI_MODEL_REDACAO || 'gpt-5.6-luna';
}

/** Modelos de raciocínio (gpt-5*, o1/o3/o4) só aceitam a temperatura padrão. */
export function aceitaTemperatura(modelo: string): boolean {
  return !/^(gpt-5|gpt-6|o\d)/.test(modelo);
}

let clienteEmCache: { chave: string; cliente: OpenAI } | null = null;

/** Cliente do SDK `openai`, reaproveitado enquanto a chave não mudar. */
export function obterClienteOpenAI(): OpenAI {
  const chave = obterApiKey();
  if (!clienteEmCache || clienteEmCache.chave !== chave) {
    clienteEmCache = { chave, cliente: new OpenAI({ apiKey: chave }) };
  }
  return clienteEmCache.cliente;
}

/** Modelo de chat do LangChain (saída estruturada). */
export function criarChatModel(opcoes: { nivel?: NivelModelo; temperature?: number } = {}): ChatOpenAI {
  return new ChatOpenAI({
    model: obterModelo(opcoes.nivel ?? 'mini'),
    temperature: opcoes.temperature,
    apiKey: obterApiKey(),
  });
}
