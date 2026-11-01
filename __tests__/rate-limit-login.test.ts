import { describe, it, expect, afterAll, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Cada carga do módulo da rota simula uma réplica (vi.resetModules): o contador tem de ser compartilhado.
const arquivo = path.join(os.tmpdir(), `capta-login-rl-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = arquivo;

afterAll(() => {
  for (const sufixo of ['', '-wal', '-shm']) fs.rmSync(arquivo + sufixo, { force: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function pedirLogin(ip: string, email: string) {
  return new NextRequest('http://localhost/api/v1/usuarios/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ email, password: 'senha-errada' }),
  });
}

async function carregarRota() {
  vi.resetModules();
  return await import('../app/api/v1/usuarios/login/route');
}

describe('login: limite de tentativas compartilhado entre réplicas', () => {
  it('o sexto login com senha errada recebe 429 com Retry-After, também em outra réplica', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.1`;
    const email = `${crypto.randomUUID()}@teste.com`;

    const replicaA = await carregarRota();
    for (let i = 0; i < 5; i++) {
      const resposta = await replicaA.POST(pedirLogin(ip, email));
      expect(resposta.status).toBe(401);
    }

    const sexta = await replicaA.POST(pedirLogin(ip, email));
    expect(sexta.status).toBe(429);
    expect(Number(sexta.headers.get('Retry-After'))).toBeGreaterThan(0);

    const replicaB = await carregarRota();
    const setima = await replicaB.POST(pedirLogin(ip, email));
    expect(setima.status).toBe(429);
    expect(Number(setima.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});
