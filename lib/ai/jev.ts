/**
 * Cliente mínimo do Jev (TypeSafe System One): julgamentos tipados e rápidos.
 * Docs: https://docs.typesafe.ai/api.md
 *
 * - Chave em TYPESAFE_API_KEY (somente servidor). Sem chave, o Jev fica indisponível
 *   e os chamadores devem seguir com o fluxo alternativo.
 * - Perguntas independentes sobre o mesmo `state` vão na mesma requisição (rodam em paralelo).
 */

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const TIMEOUT_MS = 8000;

export type PerguntaNoul = {
  type: 'noul';
  instructions: string;
  criteria?: { true?: string; false?: string };
};

export type PerguntaChoice = {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string | null>;
};

export type PerguntaScore = {
  type: 'score';
  instructions: string;
  criteria: string[];
};

export type PerguntaJev = PerguntaNoul | PerguntaChoice | PerguntaScore;

export type RespostaJev =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | {
      type: 'score';
      score: number;
      legend: Record<string, string>;
      probabilities: Record<string, number>;
      confidence: number;
    };

export interface ResultadoJev<Q extends Record<string, PerguntaJev>> {
  model: string;
  answers: { [K in keyof Q]: Extract<RespostaJev, { type: Q[K]['type'] }> };
  usage: { input_tokens: number; output_tokens: number };
}

export class JevError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'JevError';
  }
}

export function jevDisponivel(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

export function obterModeloJev(): string {
  return process.env.JEV_MODEL || 'jev-latest';
}

async function chamar(corpo: unknown, chave: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Faz uma consulta ao Jev. Tenta de novo uma vez em 429/529 (limite/sobrecarga).
 * Lança JevError em qualquer falha; quem chama decide o fallback.
 */
export async function consultarJev<Q extends Record<string, PerguntaJev>>(
  state: string | Record<string, unknown> | unknown[],
  questions: Q
): Promise<ResultadoJev<Q>> {
  const chave = process.env.TYPESAFE_API_KEY;
  if (!chave) throw new JevError('TYPESAFE_API_KEY não está definida.');

  const corpo = { state, model: obterModeloJev(), questions };

  try {
    let resposta = await chamar(corpo, chave);
    if (resposta.status === 429 || resposta.status === 529) {
      await new Promise((r) => setTimeout(r, 600));
      resposta = await chamar(corpo, chave);
    }

    if (!resposta.ok) {
      throw new JevError(`Jev respondeu HTTP ${resposta.status}`, resposta.status);
    }
    return (await resposta.json()) as ResultadoJev<Q>;
  } catch (erro: any) {
    if (erro instanceof JevError) throw erro;
    if (erro?.name === 'AbortError') throw new JevError(`Jev excedeu ${TIMEOUT_MS / 1000}s`);
    throw new JevError(erro?.message || 'Falha ao consultar o Jev');
  }
}
