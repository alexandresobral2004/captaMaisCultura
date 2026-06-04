import axios from 'axios';
import { z } from 'zod';

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
}

const TavilySearchSchema = z.object({
  results: z.array(z.object({
    title: z.string(),
    url: z.string(),
    content: z.string(),
    score: z.number().optional(),
    published_date: z.string().nullable().optional(),
  })),
  answer: z.string().nullable().optional(),
});

export async function buscarDadosProjetoMCP(
  tema: string,
  areaAtuacao?: string
): Promise<SearchResponse> {
  const query = buildQuery(tema, areaAtuacao);

  try {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.warn('TAVILY_API_KEY nao configurada');
      return { results: [], query };
    }

    const response = await axios.post(
      'https://api.tavily.com/search',
      {
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
        include_raw_content: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 15000,
      }
    );

    const validated = TavilySearchSchema.parse(response.data);

    const results: SearchResult[] = validated.results.map(r => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || '',
    }));

    console.log(`✅ Tavily: ${results.length} resultados para "${query}"`);
    return { results, query };
  } catch (error) {
    console.error('Erro ao buscar dados via Tavily:', error);
    return { results: [], query };
  }
}

function buildQuery(tema: string, areaAtuacao?: string): string {
  const partes = [tema];

  if (areaAtuacao) {
    partes.push(areaAtuacao);
  }

  partes.push('dados', 'estatisticas', '2024', '2025', 'Brasil');

  return partes.join(' ');
}