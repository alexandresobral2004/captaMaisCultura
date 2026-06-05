/**
 * Migration SQL para criar tabela FTS5 do RAG
 * Executar após criar a tabela rag_chunks
 */

export const RAG_FTS5_MIGRATION = `
-- Criar tabela virtual FTS5 para busca full-text nos chunks RAG
CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
  titulo,
  conteudo,
  tags,
  categoria,
  content='rag_chunks',
  content_rowid='id',
  tokenize="unicode61 remove_diacritics 2"
);

-- Trigger para INSERT na tabela rag_chunks
CREATE TRIGGER IF NOT EXISTS rag_chunks_ai AFTER INSERT ON rag_chunks BEGIN
  INSERT INTO rag_chunks_fts(rowid, titulo, conteudo, tags, categoria)
  VALUES (new.id, new.titulo, new.conteudo, new.tags, new.categoria);
END;

-- Trigger para DELETE na tabela rag_chunks
CREATE TRIGGER IF NOT EXISTS rag_chunks_ad AFTER DELETE ON rag_chunks BEGIN
  INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, titulo, conteudo, tags, categoria)
  VALUES('delete', old.id, old.titulo, old.conteudo, old.tags, old.categoria);
END;

-- Trigger para UPDATE na tabela rag_chunks
CREATE TRIGGER IF NOT EXISTS rag_chunks_au AFTER UPDATE ON rag_chunks BEGIN
  INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, titulo, conteudo, tags, categoria)
  VALUES('delete', old.id, old.titulo, old.conteudo, old.tags, old.categoria);
  INSERT INTO rag_chunks_fts(rowid, titulo, conteudo, tags, categoria)
  VALUES (new.id, new.titulo, new.conteudo, new.tags, new.categoria);
END;
`;

/**
 * Função para executar a migration
 */
export async function runRagMigration(): Promise<void> {
  const { execSQL } = await import('../database/db');

  console.log('🔧 Executando migration RAG FTS5...');

  try {
    execSQL(RAG_FTS5_MIGRATION);
    console.log('✅ Migration RAG FTS5 executada com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao executar migration RAG FTS5:', error);
    throw error;
  }
}
