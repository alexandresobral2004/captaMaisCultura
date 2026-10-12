import { NextRequest, NextResponse } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const cache = new Map<string, RateLimitRecord>();

// Limpar registros expirados a cada 10 minutos para evitar vazamento de memória
if (typeof global !== 'undefined') {
  const globalRef = global as any;
  if (!globalRef.__rateLimitInterval) {
    globalRef.__rateLimitInterval = setInterval(() => {
      const now = Date.now();
      cache.forEach((value, key) => {
        if (now > value.resetTime) {
          cache.delete(key);
        }
      });
    }, 1000 * 60 * 10);
  }
}

export interface RateLimitOptions {
  limit: number;      // Número máximo de requisições permitidas
  windowMs: number;   // Janela de tempo em milissegundos
}

/**
 * Controle de taxa por chave arbitrária (ex.: e-mail). Não depende de headers do cliente.
 */
export function rateLimitPorChave(chave: string, keyPrefix: string, options: RateLimitOptions) {
  return contar(`${keyPrefix}:${chave.toLowerCase()}`, options);
}

/**
 * Executa o controle de taxa (Rate Limit) baseado no IP do cliente.
 * Atenção: x-forwarded-for é controlado pelo cliente; só é confiável atrás de um proxy
 * que o reescreva. Combine com rateLimitPorChave em rotas sensíveis (ex.: login).
 */
export function rateLimit(request: NextRequest, keyPrefix: string, options: RateLimitOptions) {
  const ipHeader = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   '127.0.0.1';

  // Pegar apenas o primeiro IP caso venha uma lista (proxies)
  const clientIp = ipHeader.split(',')[0].trim();
  return contar(`${keyPrefix}:${clientIp}`, options);
}

function contar(key: string, options: RateLimitOptions) {
  const now = Date.now();

  let record = cache.get(key);
  
  if (!record) {
    record = {
      count: 1,
      resetTime: now + options.windowMs,
    };
    cache.set(key, record);
    return {
      success: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetTime: record.resetTime,
    };
  }
  
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + options.windowMs;
    return {
      success: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetTime: record.resetTime,
    };
  }
  
  record.count += 1;
  
  if (record.count > options.limit) {
    return {
      success: false,
      limit: options.limit,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }
  
  return {
    success: true,
    limit: options.limit,
    remaining: options.limit - record.count,
    resetTime: record.resetTime,
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
