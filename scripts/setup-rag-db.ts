#!/usr/bin/env tsx
/**
 * Script para criar a tabela RAG no banco de dados
 * Executa o SQL diretamente usando better-sqlite3
 */

import path from 'path';
import Database from 'better-sqlite3';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'db', 'editais.db');

// Garantir que o diretorio existe
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sql = `
-- Criar tabela rag_chunks para armazenamento de chunks RAG
CREATE TABLE IF NOT EXISTS rag_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  documento_nome TEXT NOT NULL,
  documento_tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  pagina_inicio INTEGER,
  pagina_fim INTEGER,
  tags TEXT,
  categoria TEXT,
  embedding TEXT,
  hash_conteudo TEXT NOT NULL,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_rag_documento ON rag_chunks(documento_nome);
CREATE INDEX IF NOT EXISTS idx_rag_categoria ON rag_chunks(categoria);
CREATE INDEX IF NOT EXISTS idx_rag_hash ON rag_chunks(hash_conteudo);

-- Criar tabela virtual FTS5 para busca full-text
CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
  titulo,
  conteudo,
  tags,
  categoria,
  content='rag_chunks',
  content_rowid='id',
  tokenize="unicode61 remove_diacritics 2"
);

-- Triggers para sincronização FTS5
CREATE TRIGGER IF NOT EXISTS rag_chunks_ai AFTER INSERT ON rag_chunks BEGIN
  INSERT INTO rag_chunks_fts(rowid, titulo, conteudo, tags, categoria)
  VALUES (new.id, new.titulo, new.conteudo, new.tags, new.categoria);
END;

CREATE TRIGGER IF NOT EXISTS rag_chunks_ad AFTER DELETE ON rag_chunks BEGIN
  INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, titulo, conteudo, tags, categoria)
  VALUES('delete', old.id, old.titulo, old.conteudo, old.tags, old.categoria);
END;

CREATE TRIGGER IF NOT EXISTS rag_chunks_au AFTER UPDATE ON rag_chunks BEGIN
  INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, titulo, conteudo, tags, categoria)
  VALUES('delete', old.id, old.titulo, old.conteudo, old.tags, old.categoria);
  INSERT INTO rag_chunks_fts(rowid, titulo, conteudo, tags, categoria)
  VALUES (new.id, new.titulo, new.conteudo, new.tags, new.categoria);
END;
`;

console.log('🔧 Criando tabela RAG no banco de dados...\n');

const db = new Database(DB_PATH);

try {
  db.exec(sql);
  console.log('✅ Tabela rag_chunks criada com sucesso!');
  console.log('✅ Índices criados!');
  console.log('✅ Tabela FTS5 criada!');
  console.log('✅ Triggers de sincronização criados!');

  // Verificar se a tabela foi criada
  const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rag_chunks'").get();
  if (result) {
    console.log('\n✨ RAG database setup concluído!');
  }
} catch (error) {
  console.error('❌ Erro ao criar tabela RAG:', error);
  process.exit(1);
} finally {
  db.close();
}
