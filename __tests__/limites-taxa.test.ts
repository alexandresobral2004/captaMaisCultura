import { describe, it, expect, afterAll, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { IS_POSTGRES } from './setup';
import { limitesTaxa } from '../lib/database/schema';

// Cada teste carrega o módulo de novo (vi.resetModules): é uma "instância" nova, com conexão própria.
// No modo SQLite, todas apontam para o mesmo arquivo, como duas réplicas apontariam para o mesmo banco.
const arquivo = path.join(os.tmpdir(), `capta-limites-${process.pid}-${Date.now()}.db`);

afterAll(() => {
  for (const sufixo of ['', '-wal', '-shm']) fs.rmSync(arquivo + sufixo, { force: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function carregarRepositorio() {
  vi.resetModules();
  return await import('../lib/database/repositories/limites-taxa.repository');
}

function chaveUnica() {
  return `teste:${crypto.randomUUID()}`;
}

describe('limites de taxa compartilhados entre instâncias', () => {
  it('a sexta tentativa é bloqueada mesmo quando as tentativas vêm de duas instâncias', async () => {
    process.env.DATABASE_PATH = arquivo;
    const chave = chaveUnica();

    const instanciaA = await carregarRepositorio();
    for (let i = 0; i < 3; i++) {
      expect((await instanciaA.contarTentativa(chave, 60_000, 5)).permitido).toBe(true);
    }

    const instanciaB = await carregarRepositorio();
    expect((await instanciaB.contarTentativa(chave, 60_000, 5)).permitido).toBe(true);
    expect((await instanciaB.contarTentativa(chave, 60_000, 5)).permitido).toBe(true);

    const sexta = await instanciaB.contarTentativa(chave, 60_000, 5);
    expect(sexta.permitido).toBe(false);
    expect(sexta.tentativas).toBe(6);
  });

  it('depois que a janela expira, a contagem recomeça do zero', async () => {
    process.env.DATABASE_PATH = arquivo;
    const chave = chaveUnica();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-31T12:00:00.000Z'));

    const repositorio = await carregarRepositorio();
    expect((await repositorio.contarTentativa(chave, 1_000, 1)).permitido).toBe(true);
    expect((await repositorio.contarTentativa(chave, 1_000, 1)).permitido).toBe(false);

    vi.setSystemTime(new Date('2026-10-31T12:00:01.001Z'));
    const depois = await repositorio.contarTentativa(chave, 1_000, 1);
    expect(depois.permitido).toBe(true);
    expect(depois.tentativas).toBe(1);
  });
});

describe('limpeza de limites expirados', () => {
  it('remove as linhas expiradas e preserva as vigentes', async () => {
    process.env.DATABASE_PATH = arquivo;
    const expirada = chaveUnica();
    const vigente = chaveUnica();
    const inicio = new Date('2026-10-31T12:00:00.000Z').getTime();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(inicio);

    const repositorio = await carregarRepositorio();
    await repositorio.contarTentativa(expirada, 1_000, 5);
    await repositorio.contarTentativa(vigente, 60 * 60_000, 5);

    vi.setSystemTime(inicio + 2_000);
    await repositorio.limparLimitesExpirados();

    const { db } = await import('../lib/database/db');
    const linhas = await db.select({ chave: limitesTaxa.chave }).from(limitesTaxa);
    const chaves = linhas.map((linha: { chave: string }) => linha.chave);
    expect(chaves).not.toContain(expirada);
    expect(chaves).toContain(vigente);
  });
});

describe('limites de taxa: concorrência', () => {
  it('20 chamadas simultâneas com limite 5 deixam exatamente 5 permitidas', async () => {
    process.env.DATABASE_PATH = arquivo;
    const repositorio = await carregarRepositorio();
    const chave = chaveUnica();

    const resultados = await Promise.all(
      Array.from({ length: 20 }, () => repositorio.contarTentativa(chave, 60_000, 5)),
    );

    expect(resultados.filter((r) => r.permitido)).toHaveLength(5);
  });
});

describe.skipIf(IS_POSTGRES)('limites de taxa: falha de banco (SQLite)', () => {

  it('falha de banco permite a requisição (fail open) e registra o erro', async () => {
    process.env.DATABASE_PATH = arquivo;
    const repositorio = await carregarRepositorio();
    const { getRawDb } = await import('../lib/database/db');
    getRawDb().exec('DROP TABLE limites_taxa');
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

    const resultado = await repositorio.contarTentativa(chaveUnica(), 60_000, 1);

    expect(resultado.permitido).toBe(true);
    expect(erro).toHaveBeenCalled();
  });
});
