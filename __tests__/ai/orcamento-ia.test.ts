import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  motivoParada,
  iniciarOrcamentoVarredura,
  reservarChamadaIA,
  orcamentoVarreduraEsgotado,
  encerrarOrcamentoVarredura,
  PRAZO_VARREDURA_MS,
  MAX_CHAMADAS_IA_VARREDURA,
} from '../../lib/ai/orcamento-ia';

describe('motivoParada (pura)', () => {
  const base = { inicio: 0, prazoMs: PRAZO_VARREDURA_MS, maxChamadas: 10 };

  it('não para enquanto estiver dentro do prazo e do limite', () => {
    expect(motivoParada({ ...base, agora: 60_000, chamadas: 3 })).toBeNull();
  });

  it('para por prazo ao completar 20 minutos', () => {
    expect(motivoParada({ ...base, agora: PRAZO_VARREDURA_MS, chamadas: 0 })).toBe('prazo');
  });

  it('para por limite de chamadas ao atingir o teto', () => {
    expect(motivoParada({ ...base, agora: 1_000, chamadas: 10 })).toBe('limite_ia');
  });
});

describe('orçamento da varredura', () => {
  beforeEach(() => {
    encerrarOrcamentoVarredura();
  });

  it('o padrão é 20 minutos e 300 chamadas', () => {
    expect(PRAZO_VARREDURA_MS).toBe(20 * 60 * 1000);
    expect(MAX_CHAMADAS_IA_VARREDURA).toBe(300);
  });

  it('libera chamadas até o teto e depois recusa', () => {
    iniciarOrcamentoVarredura(0, { prazoMs: PRAZO_VARREDURA_MS, maxChamadas: 2 }, () => 1_000);
    expect(reservarChamadaIA()).toBe(true);
    expect(reservarChamadaIA()).toBe(true);
    expect(reservarChamadaIA()).toBe(false);
    expect(orcamentoVarreduraEsgotado()).toBe('limite_ia');
  });

  it('recusa chamadas depois do prazo, mesmo com teto livre', () => {
    let agora = 0;
    iniciarOrcamentoVarredura(0, { prazoMs: PRAZO_VARREDURA_MS, maxChamadas: 100 }, () => agora);
    agora = PRAZO_VARREDURA_MS + 1;
    expect(reservarChamadaIA()).toBe(false);
    expect(orcamentoVarreduraEsgotado()).toBe('prazo');
  });

  it('fora de uma varredura, não limita (busca manual e upload seguem como antes)', () => {
    expect(reservarChamadaIA()).toBe(true);
    expect(orcamentoVarreduraEsgotado()).toBeNull();
  });
});

describe('Jev respeita o orçamento da varredura', () => {
  it('com teto zerado, consultarJev recusa e não chega à rede', async () => {
    const { consultarJev } = await import('../../lib/ai/jev');
    const fetchEspiao = vi.fn();
    vi.stubGlobal('fetch', fetchEspiao);
    process.env.JEV_API_KEY = 'chave-de-teste';
    iniciarOrcamentoVarredura(0, { prazoMs: PRAZO_VARREDURA_MS, maxChamadas: 0 }, () => 1);

    await expect(consultarJev({ titulo: 'x' }, {})).rejects.toThrow(/Limite de chamadas/);
    expect(fetchEspiao).not.toHaveBeenCalled();

    encerrarOrcamentoVarredura();
    vi.unstubAllGlobals();
    delete process.env.JEV_API_KEY;
  });
});

describe('OpenAI do desempate respeita o orçamento da varredura', () => {
  it('com teto zerado, validarComOpenAI não envia a requisição e devolve falha', async () => {
    const axios = (await import('axios')).default;
    const postEspiao = vi.spyOn(axios, 'post');
    const { validarComOpenAI } = await import('../../lib/filtros-ti/openai-classifier');
    process.env.OPENAI_API_KEY = 'chave-de-teste';
    iniciarOrcamentoVarredura(0, { prazoMs: PRAZO_VARREDURA_MS, maxChamadas: 0 }, () => 1);

    const resultado = await validarComOpenAI('Edital de teste sem cache', 'descrição', undefined, undefined, [], undefined, { pularJev: true });

    expect(resultado.ok).toBe(false);
    expect(postEspiao).not.toHaveBeenCalled();

    encerrarOrcamentoVarredura();
    postEspiao.mockRestore();
    delete process.env.OPENAI_API_KEY;
  });
});

describe('candidatos deixados para a próxima varredura', () => {
  it('conta os pendentes da varredura atual e zera numa nova', async () => {
    const { registrarPendente, pendentesDoOrcamento } = await import('../../lib/ai/orcamento-ia');
    iniciarOrcamentoVarredura(0, { prazoMs: PRAZO_VARREDURA_MS, maxChamadas: 0 }, () => 1);
    registrarPendente();
    registrarPendente();
    expect(pendentesDoOrcamento()).toBe(2);

    iniciarOrcamentoVarredura(0, { prazoMs: PRAZO_VARREDURA_MS, maxChamadas: 0 }, () => 1);
    expect(pendentesDoOrcamento()).toBe(0);
    encerrarOrcamentoVarredura();
  });
});
