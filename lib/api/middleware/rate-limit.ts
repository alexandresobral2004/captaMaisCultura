import { NextRequest, NextResponse } from 'next/server';
import { isIP } from 'node:net';
import { contarTentativa } from '../../database/repositories/limites-taxa.repository';

export interface RateLimitOptions {
  limit: number;      // Número máximo de requisições permitidas
  windowMs: number;   // Janela de tempo em milissegundos
}

/**
 * Controle de taxa por chave arbitrária (ex.: e-mail). Não depende de headers do cliente.
 * Contagem no banco: vale para todas as réplicas.
 */
export function rateLimitPorChave(chave: string, keyPrefix: string, options: RateLimitOptions) {
  return contar(`${keyPrefix}:${chave.toLowerCase()}`, options);
}

const CHAVE_DESCONHECIDO = 'desconhecido';

/**
 * Quantos proxies confiáveis ficam na frente da app (TRUSTED_PROXY_HOPS, padrão 1).
 * Cada proxy acrescenta um IP à direita do x-forwarded-for; o cliente real é o que sobra nessa posição.
 */
function proxiesConfiaveis(): number {
  const valor = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '1', 10);
  return Number.isInteger(valor) && valor >= 1 ? valor : 1;
}

function ipDoCliente(request: NextRequest): string {
  const encadeado = request.headers.get('x-forwarded-for');
  let candidato: string | undefined;
  if (encadeado) {
    const partes = encadeado.split(',').map((parte) => parte.trim());
    candidato = partes[partes.length - proxiesConfiaveis()];
  } else {
    candidato = request.headers.get('x-real-ip') ?? undefined;
  }
  const ip = candidato ?? '';
  return isIP(ip) !== 0 ? ip : CHAVE_DESCONHECIDO;
}

/**
 * Executa o controle de taxa (Rate Limit) baseado no IP do cliente.
 * O IP vem do proxy confiável (ver TRUSTED_PROXY_HOPS): o primeiro valor do x-forwarded-for é forjável.
 * Sem IP válido, todos caem no mesmo balde ("desconhecido"). Combine com rateLimitPorChave em rotas sensíveis.
 */
export function rateLimit(request: NextRequest, keyPrefix: string, options: RateLimitOptions) {
  return contar(`${keyPrefix}:${ipDoCliente(request)}`, options);
}

async function contar(key: string, options: RateLimitOptions) {
  const resultado = await contarTentativa(key, options.windowMs, options.limit);
  return {
    success: resultado.permitido,
    limit: options.limit,
    remaining: Math.max(0, options.limit - resultado.tentativas),
    resetTime: resultado.expiraEm,
  };
}

/**
 * Cria uma resposta HTTP 429 (Too Many Requests) padronizada
 */
export function handleRateLimitResponse(resetTime: number) {
  const secondsLeft = Math.ceil((resetTime - Date.now()) / 1000);
  const response = NextResponse.json(
    { error: `Muitas requisições. Por favor, tente novamente em ${secondsLeft} segundos.` },
    { status: 429 }
  );

  response.headers.set('Retry-After', String(secondsLeft));
  return response;
}
