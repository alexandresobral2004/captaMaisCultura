import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validarComJev,
  julgarEditalComJev,
  eixoDasRespostas,
  julgamentoCulturaDasRespostas,
} from '../lib/filtros-ti/jev-classifier';

function respostaJev(p: {
  chamada: number;
  relevante: number;
  cultura?: number;
  eixo?: string;
  eixoProb?: number;
  score?: number;
  tecnologia?: string;
  tipo?: string;
}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      model: 'jev-1.0.0',
      usage: { input_tokens: 10, output_tokens: 5 },
      answers: {
        eh_chamada: { type: 'noul', noul: p.chamada },
        relevante_ti: { type: 'noul', noul: p.relevante },
        relevante_cultura: { type: 'noul', noul: p.cultura ?? 0.05 },
        eixo: {
          type: 'choice',
          choice: p.eixo ?? 'Pesquisa',
          probabilities: { [p.eixo ?? 'Pesquisa']: p.eixoProb ?? 0.95 },
          confidence: p.eixoProb ?? 0.95,
        },
        grau_relevancia: {
          type: 'score',
          score: p.score ?? 3,
          legend: { '0': 'a', '1': 'b', '2': 'c', '3': 'd', '4': 'e' },
          probabilities: {},
          confidence: 0.8,
        },
        tecnologia: { type: 'choice', choice: p.tecnologia ?? 'IA & Machine Learning', probabilities: {}, confidence: 0.9 },
        tipo: { type: 'choice', choice: p.tipo ?? 'Plataforma', probabilities: {}, confidence: 0.9 },
      },
    }),
  };
}

describe('validarComJev', () => {
  beforeEach(() => {
    process.env.TYPESAFE_API_KEY = 'tsk-teste';
  });

  afterEach(() => {
    process.env.TYPESAFE_API_KEY = '';
    vi.unstubAllGlobals();
  });

  it('sem chave retorna null e não faz requisição', async () => {
    process.env.TYPESAFE_API_KEY = '';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await validarComJev('Edital', 'Descrição')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('edital relevante e confiante vira resultado válido no formato do classificador', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaJev({ chamada: 0.96, relevante: 0.92, score: 3 }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await validarComJev('Chamada de IA', 'Fomento a pesquisa em IA', 'R$ 100 mil', 'FINEP', ['ia']);

    expect(r).toMatchObject({ ok: true, válido: true, score: 75, confianca: 92 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(init.headers.Authorization).toBe('Bearer tsk-teste');
    expect(Object.keys(JSON.parse(init.body).questions)).toEqual(
      expect.arrayContaining(['eixo', 'eh_chamada', 'relevante_ti', 'relevante_cultura', 'grau_relevancia', 'tecnologia', 'tipo'])
    );
  });

  it('não-edital confiante vira inválido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJev({ chamada: 0.03, relevante: 0.9 })));
    const r = await validarComJev('Notícia', 'Blog sobre evento');
    expect(r).toMatchObject({ ok: true, válido: false });
  });

  it('resultado incerto escala (null), mas é aceito quando não há alternativa', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJev({ chamada: 0.6, relevante: 0.9 })));
    expect(await validarComJev('Talvez', 'Descrição')).toBeNull();

    const aceito = await validarComJev('Talvez', 'Descrição', undefined, undefined, undefined, undefined, {
      aceitarIncerto: true,
    });
    expect(aceito).toMatchObject({ ok: true, válido: true, confianca: 60 });
  });

  it('falha de rede ou HTTP não propaga: retorna null para usar o fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    expect(await validarComJev('Edital', 'Descrição')).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rede')));
    expect(await validarComJev('Edital', 'Descrição')).toBeNull();
  });
});

describe('julgamento por eixo (uma única consulta)', () => {
  beforeEach(() => {
    process.env.TYPESAFE_API_KEY = 'tsk-teste';
  });
  afterEach(() => {
    process.env.TYPESAFE_API_KEY = '';
    vi.unstubAllGlobals();
  });

  it('edital de cultura: eixo Cultura e julgamento cultural válido, com uma só requisição', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respostaJev({ chamada: 0.97, relevante: 0.04, cultura: 0.93, eixo: 'Cultura', eixoProb: 0.9 }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await julgarEditalComJev({ titulo: 'Edital de apoio a festas juninas', descricao: 'Lei Aldir Blanc' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(eixoDasRespostas(r!)).toEqual({ eixo: 'Cultura', certeza: 90 });
    expect(julgamentoCulturaDasRespostas(r!)).toMatchObject({ valido: true, confianca: 93 });
  });

  it('fora do escopo e Jev indisponível', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJev({ chamada: 0.9, relevante: 0.1, eixo: 'Fora' })));
    expect(eixoDasRespostas((await julgarEditalComJev({ titulo: 'Campeonato', descricao: 'Esporte' }))!).eixo).toBe('Fora');

    process.env.TYPESAFE_API_KEY = '';
    expect(await julgarEditalComJev({ titulo: 'x', descricao: 'y' })).toBeNull();
  });
});

describe('chave do Jev', () => {
  afterEach(() => {
    process.env.TYPESAFE_API_KEY = '';
    process.env.JEV_API_KEY = '';
  });

  it('aceita JEV_API_KEY quando TYPESAFE_API_KEY não existe', async () => {
    const { jevDisponivel } = await import('../lib/ai/jev');
    expect(jevDisponivel()).toBe(false);
    process.env.JEV_API_KEY = 'jev-teste';
    expect(jevDisponivel()).toBe(true);
  });
});
