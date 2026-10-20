/**
 * RAG - Retrieval
 * Busca chunks relevantes no banco de dados usando FTS5
 */

import { db, getRawDb } from '../database/db';
import { ragChunks } from '../database/schema';
import { sql } from 'drizzle-orm';

export interface RetrievalQuery {
  texto: string;                    // query de busca
  categorias?: string[];            // filtrar por categorias
  documentos?: string[];            // filtrar por documento fonte
  maxChunks?: number;               // default: 5
  minScore?: number;                // threshold mínimo de relevância
}

export interface RetrievedChunk {
  id: number;
  conteudo: string;
  metadata: {
    documentoNome: string;
    documentoTipo: string;
    titulo: string;
    categoria: string;
    tags: string[];
  };
  score: number;                    // score de relevância (0-1)
}

/**
 * Escapa caracteres especiais para busca FTS5
 */
function escapeFTS5Query(query: string): string {
  const stopwords = [
    'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'uma', 'para', 'com', 'no', 'na', 'os', 'as', 'dos', 'das', 'como', 'ao', 'à', 'presente', 'edital', 'objetivo', 'selecionar', 'projetos', 'receberem',
    'por', 'mais', 'se', 'ou', 'quando', 'muito', 'nos', 'ja', 'eu', 'tambem', 'so', 'ate', 'isso', 'ela', 'entre', 'depois', 'sem', 'mesmo', 'aos', 'seus', 'quem', 'nas', 'me', 'esse', 'eles', 'voce', 'essa', 'num', 'nem', 'suas', 'meu', 'minha', 'numa', 'pelos', 'elas', 'qual', 'nós', 'lhe', 'deles', 'essas', 'esses', 'este', 'dele', 'tu', 'te', 'voces', 'vos', 'lhes', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas', 'nosso', 'nossa', 'nossos', 'nossas', 'dela', 'delas', 'este', 'estes', 'esta', 'estas', 'aquele', 'aqueles', 'aquela', 'aquelas', 'isto', 'aquilo'
  ];

  // Remove caracteres especiais do FTS5
  const cleanQuery = query
    .replace(/[!"#$%&'()*+,-./:;<=>?@[\]^`{|}~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanQuery) return '';

  const words = cleanQuery
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !stopwords.includes(w.toLowerCase()));

  // Evitar queries gigantescas no SQLite (max 20 termos para busca assertiva e performática)
  const topWords = words.slice(0, 20);

  if (topWords.length === 0) {
    // Se após filtrar tudo sobrou nada, tenta usar a query limpa original
    return cleanQuery.split(/\s+/).slice(0, 10).join(' OR ');
  }

  return topWords.join(' OR ');
}

/**
 * Busca chunks relevantes usando FTS5
 */
export async function retrieveChunks(query: RetrievalQuery): Promise<RetrievedChunk[]> {
  const {
    texto,
    categorias,
    documentos,
    maxChunks = 5,
    minScore = 0.1,
  } = query;

  // Preparar query FTS5
  const queryEscaped = escapeFTS5Query(texto);

  if (!queryEscaped) {
    return [];
  }

  // Busca por ILIKE no Postgres (substitui FTS5 do SQLite).
  // TODO: migrar para tsvector/pgvector quando o volume justificar.
  const { ilike, inArray, and: drizzleAnd } = await import('drizzle-orm');

  const filtros = [];
  filtros.push(ilike(ragChunks.conteudo, `%${texto}%`));
  if (categorias && categorias.length > 0) filtros.push(inArray(ragChunks.categoria, categorias));
  if (documentos && documentos.length > 0) filtros.push(inArray(ragChunks.documentoNome, documentos));

  const rows = await db
    .select()
    .from(ragChunks)
    .where(drizzleAnd(...filtros))
    .limit(maxChunks);

  const resultados: any[] = rows.map((r: any) => ({ ...r, score_bm25: -1 }));

  if (resultados.length === 0) {
    return [];
  }

  // Normalizar scores para 0-1
  const maxScore = Math.max(...resultados.map((r: any) => Math.abs(r.score_bm25)), 1);

  return resultados.map((row: any) => ({
    id: row.id,
    conteudo: row.conteudo,
    metadata: {
      documentoNome: row.documento_nome,
      documentoTipo: row.documento_tipo,
      titulo: row.titulo,
      categoria: row.categoria,
      tags: row.tags ? JSON.parse(row.tags) : [],
    },
    score: 1 - (Math.abs(row.score_bm25) / maxScore), // Normalizar para 0-1
  }));
}

/**
 * Busca chunks por categoria
 */
export async function buscarPorCategoria(categoria: string, maxChunks: number = 10): Promise<RetrievedChunk[]> {
  const resultados = await db
    .select({
      id: ragChunks.id,
      conteudo: ragChunks.conteudo,
      documentoNome: ragChunks.documentoNome,
      documentoTipo: ragChunks.documentoTipo,
      titulo: ragChunks.titulo,
      categoria: ragChunks.categoria,
      tags: ragChunks.tags,
    })
    .from(ragChunks)
    .where(sql`${ragChunks.categoria} = ${categoria}`)
    .limit(maxChunks);

  return resultados.map((row: any) => ({
    id: row.id,
    conteudo: row.conteudo,
    metadata: {
      documentoNome: row.documentoNome,
      documentoTipo: row.documentoTipo,
      titulo: row.titulo,
      categoria: row.categoria || '',
      tags: row.tags ? JSON.parse(row.tags) : [],
    },
    score: 1.0,
  }));
}

/**
 * Busca chunks por documento
 */
export async function buscarPorDocumento(documentoNome: string, maxChunks: number = 20): Promise<RetrievedChunk[]> {
  const resultados = await db
    .select({
      id: ragChunks.id,
      conteudo: ragChunks.conteudo,
      documentoNome: ragChunks.documentoNome,
      documentoTipo: ragChunks.documentoTipo,
      titulo: ragChunks.titulo,
      categoria: ragChunks.categoria,
      tags: ragChunks.tags,
    })
    .from(ragChunks)
    .where(sql`${ragChunks.documentoNome} = ${documentoNome}`)
    .limit(maxChunks);

  return resultados.map((row: any) => ({
    id: row.id,
    conteudo: row.conteudo,
    metadata: {
      documentoNome: row.documentoNome,
      documentoTipo: row.documentoTipo,
      titulo: row.titulo,
      categoria: row.categoria || '',
      tags: row.tags ? JSON.parse(row.tags) : [],
    },
    score: 1.0,
  }));
}

/**
 * Lista todas as categorias disponíveis
 */
export async function listarCategorias(): Promise<string[]> {
  const resultados = await db
    .selectDistinct({
      categoria: ragChunks.categoria,
    })
    .from(ragChunks)
    .where(sql`${ragChunks.categoria} IS NOT NULL`);

  return resultados.map((r: any) => r.categoria!).filter(Boolean);
}

/**
 * Lista todos os documentos indexados
 */
export async function listarDocumentos(): Promise<string[]> {
  const resultados = await db
    .selectDistinct({
      documentoNome: ragChunks.documentoNome,
    })
    .from(ragChunks);

  return resultados.map((r: any) => r.documentoNome);
}
