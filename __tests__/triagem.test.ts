import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { triarEdital } from '../lib/triagem';

// A OpenAI (reserva) nunca é chamada de verdade nos testes
vi.mock('../lib/filtros-ti/openai-classifier', async (orig) => ({
  ...(await orig<typeof import('../lib/filtros-ti/openai-classifier')>()),
  validarComOpenAI: vi.fn(async () => ({ ok: false, mensagem: 'sem chave' })),
}));

function respostaJev(p: {
  eixo: 'Cultura' | 'Pesquisa' | 'Fora';
  eixoProb?: number;
  chamada?: number;
  ti?: number;
  cultura?: number;
}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      model: 'jev-1.0.0',
      usage: { input_tokens: 10, output_tokens: 5 },
      answers: {
        eixo: {
          type: 'choice',
          choice: p.eixo,
          probabilities: { [p.eixo]: p.eixoProb ?? 0.95 },
          confidence: p.eixoProb ?? 0.95,
        },
        eh_chamada: { type: 'noul', noul: p.chamada ?? 0.97 },
        relevante_ti: { type: 'noul', noul: p.ti ?? 0.05 },
        relevante_cultura: { type: 'noul', noul: p.cultura ?? 0.05 },
        grau_relevancia: {
          type: 'score',
          score: 3,
          legend: { '0': 'a', '1': 'b', '2': 'c', '3': 'd', '4': 'e' },
          probabilities: {},
          confidence: 0.8,
        },
        tecnologia: { type: 'choice', choice: 'IA & Machine Learning', probabilities: {}, confidence: 0.9 },
        tipo: { type: 'choice', choice: 'Plataforma', probabilities: {}, confidence: 0.9 },
      },
    }),
  };
}

const jevComResposta = (r: ReturnType<typeof respostaJev>) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(r));

describe('triarEdital', () => {
  beforeEach(() => {
    process.env.TYPESAFE_API_KEY = 'tsk-teste';
  });
  afterEach(() => {
    process.env.TYPESAFE_API_KEY = '';
    vi.unstubAllGlobals();
  });

  describe('eixo automático com Jev', () => {
    it('edital de cultura vai para o eixo Cultura, sem passar pelos filtros de TI', async () => {
      jevComResposta(respostaJev({ eixo: 'Cultura', cultura: 0.94 }));
      const r = await triarEdital({ titulo: 'Edital de apoio a festas juninas', descricao: 'Lei Aldir Blanc' });
      expect(r).toMatchObject({ aceito: true, incerto: false, categoriaArea: 'Cultura', etapa: 'cultura' });
      expect(r.validacaoIA).toBeUndefined();
    });

    it('edital de TI vai para Pesquisa e traz a classificação de tecnologia', async () => {
      jevComResposta(respostaJev({ eixo: 'Pesquisa', ti: 0.93 }));
      const r = await triarEdital({
        titulo: 'Chamada FINEP de fomento a inteligência artificial',
        descricao: 'Subvenção para startups de IA e machine learning',
      });
      expect(r).toMatchObject({ aceito: true, categoriaArea: 'Pesquisa' });
      expect(r.validacaoIA && r.validacaoIA.ok && r.validacaoIA.tecnologia).toBeTruthy();
    });

    it('fora do escopo é rejeitado na etapa de eixo', async () => {
      jevComResposta(respostaJev({ eixo: 'Fora' }));
      const r = await triarEdital({ titulo: 'Campeonato municipal de futsal', descricao: 'Esporte amador' });
      expect(r).toMatchObject({ aceito: false, etapa: 'eixo', categoriaArea: null });
    });

    it('cultura que o Jev considera não-edital é rejeitada', async () => {
      jevComResposta(respostaJev({ eixo: 'Cultura', chamada: 0.02, cultura: 0.9 }));
      const r = await triarEdital({ titulo: 'Exposição de arte inaugurada', descricao: 'Reportagem sobre a mostra' });
      expect(r).toMatchObject({ aceito: false, etapa: 'eixo' });
    });
  });

  describe('eixo fixo no portal', () => {
    it('portal Cultura aplica só a regra cultural, mesmo se o texto citar tecnologia', async () => {
      jevComResposta(respostaJev({ eixo: 'Pesquisa', cultura: 0.9 }));
      const r = await triarEdital({
        titulo: 'Edital de audiovisual com inteligência artificial',
        descricao: 'Fomento ao cinema',
        eixoPortal: 'Cultura',
      });
      expect(r).toMatchObject({ aceito: true, categoriaArea: 'Cultura' });
    });

    it('portal Pesquisa sem Jev, sem OpenAI e sem termo de TI rejeita', async () => {
      process.env.TYPESAFE_API_KEY = '';
      const r = await triarEdital({ titulo: 'Festival de teatro', descricao: 'Apoio a grupos', eixoPortal: 'Pesquisa' });
      expect(r).toMatchObject({ aceito: false, etapa: 'pontuacao', categoriaArea: 'Pesquisa' });
    });
  });

  describe('sem Jev (alternativa por termos)', () => {
    beforeEach(() => {
      process.env.TYPESAFE_API_KEY = '';
    });

    it('texto cultural é aceito como Cultura, marcado incerto', async () => {
      const r = await triarEdital({
        titulo: 'Chamada pública para festival de teatro e dança',
        descricao: 'Apoio a grupos artísticos',
      });
      expect(r).toMatchObject({ aceito: true, incerto: true, categoriaArea: 'Cultura' });
    });

    it('texto sem termos de nenhum eixo é rejeitado', async () => {
      const r = await triarEdital({ titulo: 'Aviso de licitação de merenda', descricao: 'Compra de alimentos' });
      expect(r).toMatchObject({ aceito: false, etapa: 'eixo', categoriaArea: null });
    });

    it('notícia sobre cultura não vira edital', async () => {
      const r = await triarEdital({
        titulo: 'Notícia: museu reabre',
        descricao: 'Entrevista com a diretora do museu',
        eixoPortal: 'Cultura',
      });
      expect(r).toMatchObject({ aceito: false, etapa: 'pontuacao' });
    });
  });
  describe('dúvida em vez de rejeição', () => {
    it('Jev com pouca certeza de que é irrelevante manda para revisão', async () => {
      jevComResposta(respostaJev({ eixo: 'Cultura', chamada: 0.2, cultura: 0.9 })); // certeza 80%
      const r = await triarEdital({ titulo: 'Mostra de arte em debate', descricao: 'Texto ambíguo' });
      expect(r).toMatchObject({ aceito: true, incerto: true, etapa: 'eixo' });
    });

    it('fora do escopo com certeza média vai para revisão', async () => {
      jevComResposta(respostaJev({ eixo: 'Fora', eixoProb: 0.8 }));
      const r = await triarEdital({ titulo: 'Programa de apoio a coletivos', descricao: 'Sem detalhes' });
      expect(r).toMatchObject({ aceito: true, incerto: true, categoriaArea: null, etapa: 'eixo' });
    });

    it('Jev incerto no eixo e sem termos vai para revisão', async () => {
      jevComResposta(respostaJev({ eixo: 'Pesquisa', eixoProb: 0.5 }));
      const r = await triarEdital({ titulo: 'Aviso de licitação de merenda', descricao: 'Compra de alimentos' });
      expect(r).toMatchObject({ aceito: true, incerto: true, etapa: 'eixo' });
    });
  });
});

describe('triarEdital: Jev incerto nunca vira rejeição direta', () => {
  beforeEach(() => {
    process.env.TYPESAFE_API_KEY = 'tsk-teste';
  });
  afterEach(() => {
    process.env.TYPESAFE_API_KEY = '';
    vi.unstubAllGlobals();
  });

  it('Pesquisa: Jev incerto, OpenAI fora e sem termo de TI vai para revisão', async () => {
    jevComResposta(respostaJev({ eixo: 'Pesquisa', chamada: 0.97, ti: 0.6 }));
    const r = await triarEdital({ titulo: 'Seleção de propostas 2026', descricao: '', eixoPortal: 'Pesquisa' });
    expect(r).toMatchObject({ aceito: true, incerto: true });
  });

  it('Pesquisa: sem Jev, sem OpenAI e sem termo de TI continua rejeitado', async () => {
    process.env.TYPESAFE_API_KEY = '';
    const r = await triarEdital({ titulo: 'Seleção de propostas 2026', descricao: '', eixoPortal: 'Pesquisa' });
    expect(r).toMatchObject({ aceito: false, etapa: 'pontuacao' });
  });

  it('Cultura: Jev incerto e palavra de notícia vai para revisão, não para o lixo', async () => {
    jevComResposta(respostaJev({ eixo: 'Cultura', chamada: 0.97, cultura: 0.6 }));
    const r = await triarEdital({ titulo: 'Edital de teatro', descricao: 'Resultado final previsto para dezembro', eixoPortal: 'Cultura' });
    expect(r).toMatchObject({ aceito: true, incerto: true, etapa: 'cultura' });
  });
});
