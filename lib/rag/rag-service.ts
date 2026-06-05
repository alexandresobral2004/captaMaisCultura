/**
 * RAG - Serviço de Integração com ProposalWriter
 * Fornece chunks RAG para os prompts de geração de propostas
 */

import { retrieveChunks, type RetrievalQuery, type RetrievedChunk } from './retriever';

export interface RagContext {
  chunks: RetrievedChunk[];
  query: string;
}

/**
 * Formata chunks RAG para injeção no prompt
 */
export function formatarContextoRAG(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return 'Nenhuma referência interna encontrada.';
  }

  return chunks.map((c, i) =>
    `[REF-${i + 1}] ${c.metadata.titulo} (${c.metadata.documentoNome}):\n${c.conteudo.slice(0, 800)}...`
  ).join('\n\n');
}

/**
 * Busca chunks RAG relevantes para um edital
 */
export async function buscarContextoRAG(
  tituloEdital: string,
  objetivoEdital: string,
  areasTematicas: string[],
  maxChunks: number = 5
): Promise<RagContext> {
  // Construir query de busca baseada no edital
  const queryTexto = [tituloEdital, objetivoEdital, ...areasTematicas].join(' ').trim();

  const query: RetrievalQuery = {
    texto: queryTexto,
    maxChunks,
  };

  const chunks = await retrieveChunks(query);

  return {
    chunks,
    query: queryTexto,
  };
}

/**
 * Busca chunks RAG por categoria específica
 */
export async function buscarContextoRAGPorCategoria(
  categoria: string,
  maxChunks: number = 5
): Promise<RagContext> {
  const { buscarPorCategoria } = await import('./retriever');
  const chunks = await buscarPorCategoria(categoria, maxChunks);

  return {
    chunks,
    query: `categoria:${categoria}`,
  };
}

/**
 * Gera seção de contexto RAG para injetar no prompt
 */
export function gerarSecaoRAG(contexto: RagContext): string {
  return `
REFERÊNCIAS INTERNAS (Manuais e Modelos da Instituição):
${formatarContextoRAG(contexto.chunks)}
`.trim();
}
