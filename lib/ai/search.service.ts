import { tavily } from '@tavily/core';

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
}

export async function buscarDadosProjeto(
  tema: string,
  areaAtuacao?: string
): Promise<SearchResponse> {
  const query = buildQuery(tema, areaAtuacao);

  try {
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY });

    const response = await client.search(query, {
      max_results: 5,
      include_answer: true,
    });

    const results: SearchResult[] = (response.results || []).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || '',
    }));

    return { results, query };
  } catch (error) {
    console.error('Erro ao buscar dados Tavily:', error);
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

export function formatarFontesParaPrompt(searchResults: SearchResult[]): string {
  if (!searchResults.length) {
    return 'Nenhuma fonte encontrada. Utilize apenas as informacoes do edital.';
  }

  const fontes = searchResults.map((r, i) => {
    return `[${i + 1}] ${r.title}\n   URL: ${r.url}\n   Conteudo relevante: ${r.content.slice(0, 300)}...`;
  });

  return fontes.join('\n\n');
}