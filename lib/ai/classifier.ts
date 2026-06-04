import OpenAI from 'openai';

export interface ResultadoClassificacao {
  isEdital: boolean;
  confianca: number;           // 0-100
  motivo: string;
  palavrasChave: string[];
  scoreEstrutura: number;
  scoreContexto: number;
  scoreConteudo: number;
}

/**
 * Classifica se um item encontrado é um edital ou não usando IA
 * Retorna um objeto com a decisão e score de confiança
 */
export async function classificarSeEhEdital(
  titulo: string,
  descricao: string,
  url: string,
  orgao?: string
): Promise<ResultadoClassificacao> {
  const apiKey = process.env.OPENAI_API_KEY;

  // Se não tiver API key, usa heurística simples
  if (!apiKey) {
    return classificacaoHeuristica(titulo, descricao, url, orgao);
  }

  try {
    const openai = new OpenAI({ apiKey });

    const systemPrompt = `Você é um especialista em identificar editais, chamadas públicas, editais de fomento e seleções públicas.
Analise o título, descrição e URL fornecidos e determine se se trata de um edital válido.

Um EDITAL VÁLIDO deve ter:
- Datas de abertura e fechamento
- Valores ou benefícios envolvidos
- Requisitos ou elegibilidade
- Processo seletivo ou competição
- Instituição ou órgão responsável

Responda APENAS com JSON válido, sem markdown:
{
  "isEdital": boolean,
  "confianca": number (0-100),
  "motivo": "string explicando a decisão",
  "palavrasChave": ["string"],
  "scoreEstrutura": number (0-100),
  "scoreContexto": number (0-100),
  "scoreConteudo": number (0-100)
}`;

    const userContent = `
Título: ${titulo}
Descrição: ${descricao.substring(0, 500)}
URL: ${url}
${orgao ? `Órgão: ${orgao}` : ''}

É um edital válido? Analise e responda em JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.3 // Baixa temperatura para respostas mais consistentes
    });

    const content = response.choices[0].message.content || '{}';
    const resultado = JSON.parse(content) as ResultadoClassificacao;

    // Validar resultado
    if (typeof resultado.confianca !== 'number') resultado.confianca = 0;
    if (typeof resultado.isEdital !== 'boolean') resultado.isEdital = false;
    if (!resultado.motivo) resultado.motivo = 'Erro ao processar classificação';
    if (!Array.isArray(resultado.palavrasChave)) resultado.palavrasChave = [];

    console.log(`✅ Classificação: "${titulo.substring(0, 50)}" → ${resultado.isEdital ? 'EDITAL' : 'NÃO-EDITAL'} (${resultado.confianca}%)`);

    return resultado;
  } catch (erro) {
    console.error('❌ Erro na classificação com IA:', erro);
    // Fallback para heurística
    return classificacaoHeuristica(titulo, descricao, url, orgao);
  }
}

/**
 * Classificação heurística (fallback quando IA não está disponível)
 */
function classificacaoHeuristica(
  titulo: string,
  descricao: string,
  url: string,
  orgao?: string
): ResultadoClassificacao {
  const textoCompleto = `${titulo} ${descricao} ${orgao || ''}`.toLowerCase();

  // Palavras-chave positivas (indicam que é edital)
  const palavrasPositivas = [
    'edital', 'chamada', 'seleção', 'bolsa', 'financiamento', 'fomento',
    'editais', 'chamadas', 'inscrição', 'inscrições', 'candidatura',
    'concurso', 'licitação', 'proposta', 'projetos', 'submissão',
    'prazos', 'requisitos', 'elegibilidade', 'aprovação', 'resultado',
    'aviso', 'publicação', 'resultado', 'julgamento', 'homologação'
  ];

  // Palavras-chave negativas (indicam que NÃO é edital)
  const palavrasNegativas = [
    'notícia', 'blog', 'artigo', 'entrevista', 'depoimento', 'evento',
    'workshop', 'webinar', 'palestra', 'café', 'encontro', 'reunião',
    'curso', 'aula', 'tutorial', 'dica', 'guia', 'manual', 'faq'
  ];

  // Contar palavras positivas
  const countPositivas = palavrasPositivas.filter(p => textoCompleto.includes(p)).length;

  // Contar palavras negativas
  const countNegativas = palavrasNegativas.filter(p => textoCompleto.includes(p)).length;

  // Verificar presença de datas (indica edital)
  const temData = /(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{2}-\d{2})|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/.test(
    textoCompleto
  );

  // Verificar presença de valores (indica edital)
  const temValor = /r\$|reais|mil|milhão|valores?|orçamento|financiamento/.test(textoCompleto);

  // Verificar presença de URL de portal oficial
  const ePortalOficial =
    url.includes('prosas.com.br') ||
    url.includes('finep.gov.br') ||
    url.includes('cnpq.gov.br') ||
    url.includes('capes.gov.br') ||
    url.includes('fapeal') ||
    url.includes('fapesp') ||
    url.includes('governo.br');

  // Calcular scores
  const scoreEstrutura = (temData ? 40 : 0) + (temValor ? 30 : 0) + (countPositivas > 0 ? 30 : 0);
  const scoreContexto = ePortalOficial ? 100 : countPositivas > countNegativas ? 70 : 30;
  const scoreConteudo = Math.min(100, countPositivas * 15);

  // Score final (média ponderada)
  const confianca = Math.round(scoreEstrutura * 0.3 + scoreContexto * 0.4 + scoreConteudo * 0.3);

  return {
    isEdital: confianca >= 60,
    confianca,
    motivo:
      confianca >= 80
        ? 'Alto score de edital detectado'
        : confianca >= 60
          ? 'Score moderado de edital'
          : 'Score baixo - provavelmente não é edital',
    palavrasChave: palavrasPositivas.filter(p => textoCompleto.includes(p)),
    scoreEstrutura,
    scoreContexto,
    scoreConteudo
  };
}

/**
 * Batch classification - classifica múltiplos itens em uma chamada
 * Útil para processar muitos itens de uma vez
 */
export async function classificarEmLote(
  itens: Array<{ titulo: string; descricao: string; url: string; orgao?: string }>
): Promise<Map<number, ResultadoClassificacao>> {
  const resultados = new Map<number, ResultadoClassificacao>();

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    try {
      const resultado = await classificarSeEhEdital(
        item.titulo,
        item.descricao,
        item.url,
        item.orgao
      );
      resultados.set(i, resultado);
    } catch (erro) {
      console.error(`Erro ao classificar item ${i}:`, erro);
      resultados.set(i, {
        isEdital: false,
        confianca: 0,
        motivo: 'Erro na classificação',
        palavrasChave: [],
        scoreEstrutura: 0,
        scoreContexto: 0,
        scoreConteudo: 0
      });
    }
  }

  return resultados;
}
