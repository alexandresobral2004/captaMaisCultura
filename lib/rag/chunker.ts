/**
 * RAG - Chunker Inteligente
 * Divide texto de PDFs em chunks com metadados para indexação RAG
 */

import * as crypto from 'crypto';

export interface ChunkMetadata {
  documentoNome: string;
  documentoTipo: 'manual' | 'modelo' | 'dicas' | 'tecnico' | 'legislacao';
  titulo: string;
  paginaInicio?: number;
  paginaFim?: number;
  tags: string[];
  categoria: string;
}

export interface ExtractedChunk {
  conteudo: string;
  metadata: ChunkMetadata;
  hash: string;
}

/**
 * Keywords para categorização automática de chunks
 */
const CATEGORIA_KEYWORDS: Record<string, string[]> = {
  orcamento: ['orçamento', 'custo', 'valor', 'rubrica', 'despesa', 'verba', 'recursos financeiros', 'planilha'],
  metodologia: ['metodologia', 'etapa', 'cronograma', 'atividade', 'plano', 'fase', 'procedimento'],
  justificativa: ['justificativa', 'relevância', 'impacto', 'necessidade', 'pertinência', 'importância'],
  elegibilidade: ['proponente', 'elegibilidade', 'requisito', 'documento', 'condição', 'habilitação'],
  acessibilidade: ['acessibilidade', 'deficiência', 'libras', 'audiodescrição', 'inclusão', 'pcd'],
  prestacao_contas: ['prestação', 'contas', 'comprovação', 'relatório', 'fiscalização', 'auditoria'],
  captacao: ['captação', 'patrocínio', 'doação', 'incentivo', 'renúncia', 'mecenato'],
  objetivos: ['objetivo', 'finalidade', 'propósito', 'meta', 'intenção'],
  publico_alvo: ['público', 'beneficiário', 'participante', 'usuário', 'comunidade'],
  avaliacao: ['avaliação', 'indicador', 'resultado', 'monitoramento', 'impacto'],
  equipe: ['equipe', 'profissional', 'curriculum', 'lattes', 'coordenador'],
  sustentabilidade: ['sustentabilidade', 'permanência', 'continuidade', 'legado'],
};

/**
 * Configurações de chunking
 */
const CHUNK_CONFIG = {
  minTokens: 600,      // ~2400 caracteres
  maxTokens: 1200,     // ~4800 caracteres
  overlap: 200,        // ~800 caracteres de overlap
  minChunkSize: 500,   // tamanho mínimo em caracteres
};

/**
 * Estima número de tokens baseado em caracteres (aproximação)
 */
function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / 4);
}

/**
 * Detecta categoria do chunk baseado em keywords
 */
function detectarCategoria(conteudo: string): string {
  const conteudoLower = conteudo.toLowerCase();

  let melhorCategoria = 'geral';
  let maxScore = 0;

  for (const [categoria, keywords] of Object.entries(CATEGORIA_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = conteudoLower.match(regex);
      if (matches) {
        score += matches.length;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      melhorCategoria = categoria;
    }
  }

  return melhorCategoria;
}

/**
 * Extrai tags do conteúdo
 */
function extrairTags(conteudo: string, titulo: string): string[] {
  const tags = new Set<string>();
  const texto = `${titulo} ${conteudo}`.toLowerCase();

  // Palavras-chave comuns em editais
  const keywordsComuns = [
    'cultura', 'pesquisa', 'inovação', 'tecnologia', 'arte',
    'educação', 'comunidade', 'digital', 'acesso', 'democratização',
    'formação', 'oficina', 'workshop', 'curso', 'capacitação',
    'exposição', 'mostra', 'festival', 'evento', 'publicação',
    'audiovisual', 'música', 'teatro', 'dança', 'literatura',
    'patrimônio', 'memória', 'tradição', 'contemporâneo',
    'intercâmbio', 'residência', 'bolsa', 'prêmio', 'financiamento',
  ];

  for (const keyword of keywordsComuns) {
    if (texto.includes(keyword.toLowerCase())) {
      tags.add(keyword);
    }
  }

  return Array.from(tags);
}

/**
 * Divide texto em parágrafos preservando estrutura
 */
function dividirEmParagrafos(texto: string): string[] {
  // Divide por quebras de seção (##, ###, Capítulo, Módulo, etc.)
  const secoes = texto.split(/(?=^(##|#|Capítulo|Módulo|Seção|Parte|Anexo)\s)/m);

  const paragrafos: string[] = [];

  for (const secao of secoes) {
    if (!secao.trim()) continue;

    // Divide por parágrafos (dupla quebra de linha)
    const partes = secao.split(/\n\s*\n/);

    for (const parte of partes) {
      if (parte.trim().length > CHUNK_CONFIG.minChunkSize) {
        paragrafos.push(parte.trim());
      }
    }
  }

  return paragrafos;
}

/**
 * Agrupa parágrafos em chunks com tamanho adequado
 */
function agruparChunks(paragrafos: string[], documentoNome: string, tipoDocumento: string): ExtractedChunk[] {
  const chunks: ExtractedChunk[] = [];
  let chunkAtual = '';
  let paragrafosNoChunk: string[] = [];
  let paginaInicio: number | undefined;
  let paginaFim: number | undefined;

  for (let i = 0; i < paragrafos.length; i++) {
    const paragrafo = paragrafos[i];
    const tamanhoEstimado = estimarTokens(chunkAtual + paragrafo);

    // Verifica se adiciona ao chunk atual ou cria novo
    if (tamanhoEstimado <= CHUNK_CONFIG.maxTokens) {
      chunkAtual += (chunkAtual ? '\n\n' : '') + paragrafo;
      paragrafosNoChunk.push(paragrafo);
    } else {
      // Finaliza chunk atual se tiver tamanho mínimo
      if (estimarTokens(chunkAtual) >= CHUNK_CONFIG.minTokens) {
        const titulo = extrairTitulo(chunkAtual);
        chunks.push({
          conteudo: chunkAtual,
          metadata: {
            documentoNome,
            documentoTipo: tipoDocumento as any,
            titulo,
            paginaInicio,
            paginaFim,
            tags: extrairTags(chunkAtual, titulo),
            categoria: detectarCategoria(chunkAtual),
          },
          hash: crypto.createHash('sha256').update(chunkAtual).digest('hex'),
        });
      }

      // Inicia novo chunk com overlap
      const overlapParagrafos = paragrafosNoChunk.slice(-Math.ceil(paragrafosNoChunk.length * 0.3));
      chunkAtual = overlapParagrafos.join('\n\n') + (overlapParagrafos.length ? '\n\n' : '') + paragrafo;
      paragrafosNoChunk = [...overlapParagrafos, paragrafo];
    }
  }

  // Adiciona último chunk
  if (chunkAtual.trim() && estimarTokens(chunkAtual) >= CHUNK_CONFIG.minTokens / 2) {
    const titulo = extrairTitulo(chunkAtual);
    chunks.push({
      conteudo: chunkAtual,
      metadata: {
        documentoNome,
        documentoTipo: tipoDocumento as any,
        titulo,
        paginaInicio,
        paginaFim,
        tags: extrairTags(chunkAtual, titulo),
        categoria: detectarCategoria(chunkAtual),
      },
      hash: crypto.createHash('sha256').update(chunkAtual).digest('hex'),
    });
  }

  return chunks;
}

/**
 * Extrai título do chunk (primeira linha significativa)
 */
function extrairTitulo(texto: string): string {
  const linhas = texto.split('\n').filter(l => l.trim().length > 0);

  // Procura por título com ## ou #
  for (const linha of linhas.slice(0, 5)) {
    const match = linha.match(/^#+\s+(.+)$/);
    if (match) {
      return match[1].trim();
    }
  }

  // Retorna primeira linha como título
  return linhas[0]?.slice(0, 100).trim() || 'Seção';
}

/**
 * Função principal de chunking
 */
export function chunkTexto(
  texto: string,
  documentoNome: string,
  tipoDocumento: 'manual' | 'modelo' | 'dicas' | 'tecnico' | 'legislacao'
): ExtractedChunk[] {
  // Limpeza básica do texto
  texto = texto
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Divide em parágrafos
  const paragrafos = dividirEmParagrafos(texto);

  // Agrupa em chunks
  return agruparChunks(paragrafos, documentoNome, tipoDocumento);
}
