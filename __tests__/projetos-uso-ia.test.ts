import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../lib/database/db';
import type { RefUso } from '../lib/ai/uso-ia';
import { usoIa } from '../lib/database/schema';
import { extrairMetricas } from '../lib/projetos/contexto-geracao';
import { chamarOpenAI } from '../lib/projetos/gerador-projeto';
import { julgarComOpenAI } from '../lib/projetos/julgar-ia';
import { conferirProjeto } from '../lib/projetos/conferencia';

const cliente = vi.hoisted(() => ({
  create: async () => ({
    model: 'modelo-real-2026',
    usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
    choices: [{ message: { content: '{}' } }],
  }),
}));

vi.mock('../lib/ai/client', async (orig) => ({
  ...(await orig<typeof import('../lib/ai/client')>()),
  apiKeyConfigurada: () => true,
  obterClienteOpenAI: () => ({ chat: { completions: cliente } }),
}));

describe('projeto e edital nos registros de uso da IA', () => {
  beforeEach(async () => {
    await db.delete(usoIa);
  });

  it('extrairMetricas grava o editalId e o projetoId recebidos', async () => {
    await extrairMetricas('Título', 'Descrição do projeto', 12, { editalId: 'e1', projetoId: 'p1' });

    await vi.waitFor(async () => {
      const linhas = await db.select().from(usoIa);
      expect(linhas).toHaveLength(1);
      expect(linhas[0]).toMatchObject({ origem: 'geracao_projeto', editalId: 'e1', projetoId: 'p1' });
    });
  });

  it('chamarOpenAI grava o projetoId da geração', async () => {
    await chamarOpenAI('sistema', 'usuário', 0.4, { projetoId: 'p2' });

    await vi.waitFor(async () => {
      const linhas = await db.select().from(usoIa);
      expect(linhas).toHaveLength(1);
      expect(linhas[0]).toMatchObject({ origem: 'geracao_projeto', projetoId: 'p2', editalId: null });
    });
  });

  it('julgarComOpenAI grava o editalId e o projetoId da conferência', async () => {
    await julgarComOpenAI('prompt', { editalId: 'e3', projetoId: 'p3' });

    await vi.waitFor(async () => {
      const linhas = await db.select().from(usoIa);
      expect(linhas).toHaveLength(1);
      expect(linhas[0]).toMatchObject({ origem: 'julgamento_projeto', editalId: 'e3', projetoId: 'p3', modelo: 'modelo-real-2026' });
    });
  });

  it('conferirProjeto passa a referência do projeto ao julgamento', async () => {
    const projeto = {
      id: 'p4',
      editalId: 'e4',
      valorSolicitado: 10,
      edital: { valorMax: 100, analiseIA: { secoesRequeridas: [], criteriosAvaliacao: ['Mérito'] } },
      secoesDinamicas: [{ titulo: 'Justificativa', conteudo: '<p>' + 'texto '.repeat(20) + '</p>' }],
    };
    const julgar = vi.fn(async (_prompt: string, _ref?: RefUso) => JSON.stringify({ criterios: [{ situacao: 'atendido', observacao: 'ok' }] }));
    await conferirProjeto(projeto, julgar);
    expect(julgar.mock.calls[0][1]).toEqual({ editalId: 'e4', projetoId: 'p4' });
  });
});
