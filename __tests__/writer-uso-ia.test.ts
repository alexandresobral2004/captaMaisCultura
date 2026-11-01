import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../lib/database/db';
import { usoIa } from '../lib/database/schema';
import { ProposalWriterCientifico } from '../lib/analise-cientifica/writer';

const cliente = vi.hoisted(() => ({
  create: async () => ({
    model: 'gpt-5.6-luna',
    usage: { prompt_tokens: 40, completion_tokens: 8, total_tokens: 48 },
    choices: [{ message: { content: JSON.stringify({ adequado: true, scoreAdequacao: 80, recomendacao: 'ok' }) } }],
  }),
}));

vi.mock('../lib/ai/client', async (orig) => ({
  ...(await orig<typeof import('../lib/ai/client')>()),
  obterClienteOpenAI: () => ({ chat: { completions: cliente } }),
}));

const edital = {
  id: 'edital-w1',
  titulo: 'Chamada de pesquisa',
  orgao: 'FINEP',
  objetivo: 'Pesquisa aplicada',
  criteriosAvaliacao: ['Mérito'],
  itensFinanciaveis: [],
  elegibilidade: [],
};

describe('projeto e edital nos registros de uso da redação', () => {
  beforeEach(async () => {
    await db.delete(usoIa);
  });

  it('analisarAdequacao grava o editalId do contexto e o projetoId recebido', async () => {
    await new ProposalWriterCientifico().analisarAdequacao('Título', 'Saúde', edital, 'projeto-w1');

    await vi.waitFor(async () => {
      const linhas = await db.select().from(usoIa);
      expect(linhas).toHaveLength(1);
      expect(linhas[0]).toMatchObject({ origem: 'redacao_projeto', editalId: 'edital-w1', projetoId: 'projeto-w1' });
    });
  });

  it('gerarPropostaCompleta grava o editalId do contexto e o id da proposta', async () => {
    // Só interessa o registro de uso: a resposta não precisa ser uma proposta completa
    await new ProposalWriterCientifico()
      .gerarPropostaCompleta(edital, { id: 'projeto-w3', titulo: 'Título', descricao: 'Descrição', propostaUsuario: 'Texto' })
      .catch(() => undefined);

    await vi.waitFor(async () => {
      const linhas = await db.select().from(usoIa);
      expect(linhas).toHaveLength(1);
      expect(linhas[0]).toMatchObject({ origem: 'redacao_projeto', editalId: 'edital-w1', projetoId: 'projeto-w3' });
    });
  });
});
