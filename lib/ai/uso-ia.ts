import { db } from '../database/db';
import { usoIa } from '../database/schema';
import { avisarCustoMensalSeNecessario } from './aviso-custo-ia';

/** Quem gerou a chamada: o edital analisado e/ou o projeto em redação. Opcional em todo lugar. */
export interface RefUso {
  editalId?: string;
  projetoId?: string;
}

export interface UsoIA {
  origem: string;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  editalId?: string;
  projetoId?: string;
}

/**
 * Grava os tokens de uma chamada à IA. Nunca lança erro: o registro de custo
 * não pode derrubar a análise.
 */
export async function registrarUsoIA(uso: UsoIA): Promise<void> {
  try {
    await db.insert(usoIa).values({
      criadoEm: new Date().toISOString(),
      origem: uso.origem,
      modelo: uso.modelo,
      tokensEntrada: uso.tokensEntrada,
      tokensSaida: uso.tokensSaida,
      editalId: uso.editalId ?? null,
      projetoId: uso.projetoId ?? null,
    });
    await avisarCustoMensalSeNecessario();
  } catch (erro) {
    console.warn('[uso-ia] Falha ao registrar uso de IA:', erro instanceof Error ? erro.message : erro);
  }
}

/** Uso de uma resposta do SDK da OpenAI (chat.completions), como usage.prompt_tokens. */
export function usoDeRespostaOpenAI(
  resposta: unknown,
  modeloPedido: string
): { modelo: string; tokensEntrada: number; tokensSaida: number } | null {
  if (typeof resposta !== 'object' || resposta === null) return null;
  const { model, usage } = resposta as { model?: unknown; usage?: unknown };
  if (typeof usage !== 'object' || usage === null) return null;
  const { prompt_tokens, completion_tokens } = usage as { prompt_tokens?: unknown; completion_tokens?: unknown };
  if (typeof prompt_tokens !== 'number' || typeof completion_tokens !== 'number') return null;
  return {
    modelo: typeof model === 'string' && model ? model : modeloPedido,
    tokensEntrada: prompt_tokens,
    tokensSaida: completion_tokens,
  };
}

/**
 * Registra o uso de uma resposta da OpenAI. Sem await no caminho da chamada:
 * a Promise nunca rejeita, então quem chama pode ignorá-la com `void`.
 */
export async function registrarUsoDeResposta(
  ref: { origem: string; editalId?: string; projetoId?: string },
  resposta: unknown,
  modeloPedido: string
): Promise<void> {
  try {
    const uso = usoDeRespostaOpenAI(resposta, modeloPedido);
    if (uso) await registrarUsoIA({ ...ref, ...uso });
  } catch (erro) {
    console.warn('[uso-ia] Falha ao registrar uso de resposta:', erro instanceof Error ? erro.message : erro);
  }
}

/** Uso de uma resposta do Jev (usage.input_tokens / output_tokens). */
export function usoDeRespostaJev(usage: unknown): { tokensEntrada: number; tokensSaida: number } | null {
  if (typeof usage !== 'object' || usage === null) return null;
  const { input_tokens, output_tokens } = usage as { input_tokens?: unknown; output_tokens?: unknown };
  if (typeof input_tokens !== 'number' || typeof output_tokens !== 'number') return null;
  return { tokensEntrada: input_tokens, tokensSaida: output_tokens };
}

/** Registra o uso de uma chamada ao Jev. Nunca rejeita: quem chama pode ignorar com `void`. */
export async function registrarUsoJev(
  ref: { origem: string; editalId?: string; projetoId?: string },
  modelo: string,
  usage: unknown
): Promise<void> {
  try {
    const uso = usoDeRespostaJev(usage);
    if (uso) await registrarUsoIA({ ...ref, modelo, ...uso });
  } catch (erro) {
    console.warn('[uso-ia] Falha ao registrar uso do Jev:', erro instanceof Error ? erro.message : erro);
  }
}

/** Lê os tokens da saída do LangChain. Devolve null quando a saída não traz uso. */
export function extrairTokens(
  output: unknown
): { tokensEntrada: number; tokensSaida: number } | null {
  const uso = (output as { llmOutput?: { tokenUsage?: { promptTokens?: unknown; completionTokens?: unknown } } } | undefined)
    ?.llmOutput?.tokenUsage;
  if (!uso || typeof uso.promptTokens !== 'number' || typeof uso.completionTokens !== 'number') return null;
  return { tokensEntrada: uso.promptTokens, tokensSaida: uso.completionTokens };
}

/** Callback do LangChain: grava o uso da chamada quando ela termina. */
export function callbackUsoIA(origem: string, modelo: string, editalId?: string) {
  return {
    handleLLMEnd(output: unknown): void {
      const tokens = extrairTokens(output);
      if (tokens) void registrarUsoIA({ origem, modelo, editalId, ...tokens });
    },
  };
}
