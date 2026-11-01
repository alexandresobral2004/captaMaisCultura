import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { rateLimit } from '../lib/api/middleware/rate-limit';

// Cada teste usa um prefixo próprio, então os contadores não se misturam entre testes.
const OPCOES = { limit: 5, windowMs: 60_000 };

function pedir(cabecalhos: Record<string, string>) {
  return new NextRequest('http://localhost/api/v1/usuarios/login', {
    method: 'POST',
    headers: cabecalhos,
  });
}

function prefixoUnico() {
  return `teste-ip-${crypto.randomUUID()}`;
}

afterEach(() => {
  delete process.env.TRUSTED_PROXY_HOPS;
  vi.restoreAllMocks();
});

describe('rate limit por IP: o cliente é o valor a partir da direita', () => {
  it('(a) com um proxy (padrão), conta pelo último IP; o IP forjado à esquerda não muda o balde', async () => {
    const prefixo = prefixoUnico();
    const real = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;

    for (let i = 0; i < 5; i++) {
      const r = await rateLimit(pedir({ 'x-forwarded-for': `203.0.113.${i + 1}, ${real}` }), prefixo, OPCOES);
      expect(r.success).toBe(true);
    }
    // Cabeçalho forjado diferente a cada vez: o IP real continua sendo o mesmo, então é bloqueado
    const sexta = await rateLimit(pedir({ 'x-forwarded-for': `192.0.2.99, ${real}` }), prefixo, OPCOES);
    expect(sexta.success).toBe(false);
  });

  it('(b) valor inválido cai no balde fixo "desconhecido": valores diferentes não escapam do limite', async () => {
    const prefixo = prefixoUnico();

    for (let i = 0; i < 5; i++) {
      const r = await rateLimit(pedir({ 'x-forwarded-for': `lixo-${i}` }), prefixo, OPCOES);
      expect(r.success).toBe(true);
    }
    const sexta = await rateLimit(pedir({ 'x-forwarded-for': 'outro-lixo' }), prefixo, OPCOES);
    expect(sexta.success).toBe(false);
  });

  it('(c) TRUSTED_PROXY_HOPS=2 usa a segunda posição a partir da direita', async () => {
    process.env.TRUSTED_PROXY_HOPS = '2';
    const prefixo = prefixoUnico();
    const real = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;

    for (let i = 0; i < 5; i++) {
      const r = await rateLimit(
        pedir({ 'x-forwarded-for': `203.0.113.${i + 1}, ${real}, 10.0.0.1` }),
        prefixo,
        OPCOES,
      );
      expect(r.success).toBe(true);
    }
    const sexta = await rateLimit(
      pedir({ 'x-forwarded-for': `192.0.2.99, ${real}, 10.0.0.1` }),
      prefixo,
      OPCOES,
    );
    expect(sexta.success).toBe(false);
  });
});
