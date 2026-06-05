/**
 * RAG - Indexador
 * Indexa chunks de PDFs no banco de dados SQLite
 */

import * as fs from 'fs';
import * as path from 'path';
import { db } from '../database/db';
import { ragChunks } from '../database/schema';
import { eq } from 'drizzle-orm';
import { extrairTextoPdf, listarPdfs, detectarTipoDocumento } from './pdf-extractor';
import { chunkTexto, type ExtractedChunk } from './chunker';

export interface IndexerStats {
  documentosProcessados: number;
  chunksCriados: number;
  chunksDuplicados: number;
  erros: number;
}

/**
 * Indexa um único documento PDF
 */
async function indexarDocumento(caminhoPdf: string): Promise<{ chunks: ExtractedChunk[]; duplicados: number }> {
  const nomeArquivo = path.basename(caminhoPdf);
  const tipoDocumento = detectarTipoDocumento(nomeArquivo);

  console.log(`📄 Processando: ${nomeArquivo} (${tipoDocumento})`);

  // Extrair texto do PDF
  const { texto, paginas } = await extrairTextoPdf(caminhoPdf);

  if (!texto || texto.length < 100) {
    console.warn(`⚠️ Texto muito curto ou vazio: ${nomeArquivo}`);
    return { chunks: [], duplicados: 0 };
  }

  console.log(`   → ${paginas} páginas, ${texto.length} caracteres`);

  // Chunking do texto
  const chunks = chunkTexto(texto, nomeArquivo, tipoDocumento);

  console.log(`   → ${chunks.length} chunks gerados`);

  // Verificar duplicatas e inserir
  let duplicados = 0;

  for (const chunk of chunks) {
    // Verificar se chunk já existe pelo hash
    const existente = await db
      .select()
      .from(ragChunks)
      .where(eq(ragChunks.hashConteudo, chunk.hash))
      .limit(1);

    if (existente.length > 0) {
      duplicados++;
      continue;
    }

    // Inserir novo chunk
    await db.insert(ragChunks).values({
      documentoNome: chunk.metadata.documentoNome,
      documentoTipo: chunk.metadata.documentoTipo,
      titulo: chunk.metadata.titulo,
      conteudo: chunk.conteudo,
      paginaInicio: chunk.metadata.paginaInicio,
      paginaFim: chunk.metadata.paginaFim,
      tags: JSON.stringify(chunk.metadata.tags),
      categoria: chunk.metadata.categoria,
      hashConteudo: chunk.hash,
    });
  }

  return { chunks, duplicados };
}

/**
 * Reconstrói o índice FTS5
 */
async function rebuildFTS5Index(): Promise<void> {
  try {
    await db.run(`
      INSERT INTO rag_chunks_fts(rag_chunks_fts) VALUES('rebuild')
    `);
    console.log('✅ Índice FTS5 reconstruído');
  } catch (error) {
    console.warn('⚠️ Erro ao reconstruir índice FTS5:', error);
  }
}

/**
 * Função principal de indexação
 */
export async function indexarBaseConhecimento(basePath: string = 'base'): Promise<IndexerStats> {
  const stats: IndexerStats = {
    documentosProcessados: 0,
    chunksCriados: 0,
    chunksDuplicados: 0,
    erros: 0,
  };

  console.log('🔍 Buscando PDFs na pasta base/...\n');

  const pdfs = listarPdfs(basePath);

  if (pdfs.length === 0) {
    console.warn('⚠️ Nenhum PDF encontrado na pasta base/');
    return stats;
  }

  console.log(`📚 ${pdfs.length} PDFs encontrados\n`);

  for (const pdf of pdfs) {
    try {
      const resultado = await indexarDocumento(pdf);

      stats.documentosProcessados++;
      stats.chunksCriados += resultado.chunks.length - resultado.duplicados;
      stats.chunksDuplicados += resultado.duplicados;

      console.log(`   ✅ ${resultado.chunks.length - resultado.duplicados} chunks inseridos, ${resultado.duplicados} duplicados\n`);
    } catch (error) {
      stats.erros++;
      console.error(`   ❌ Erro ao processar ${pdf}:`, error);
    }
  }

  // Reconstruir índice FTS5
  await rebuildFTS5Index();

  console.log('\n📊 Resumo da indexação:');
  console.log(`   Documentos: ${stats.documentosProcessados}`);
  console.log(`   Chunks criados: ${stats.chunksCriados}`);
  console.log(`   Chunks duplicados: ${stats.chunksDuplicados}`);
  console.log(`   Erros: ${stats.erros}`);

  return stats;
}

/**
 * Verifica se a base já está indexada
 */
export async function verificarIndexacao(): Promise<{ totalChunks: number; documentos: string[] }> {
  const resultado = await db
    .select({
      documentoNome: ragChunks.documentoNome,
    })
    .from(ragChunks)
    .groupBy(ragChunks.documentoNome);

  const documentos = resultado.map(r => r.documentoNome);
  const totalChunks = await db.$count(ragChunks);

  return {
    totalChunks,
    documentos,
  };
}
