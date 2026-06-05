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
CREATE INDEX IF NOT EXISTS idx_rag_documento ON rag_chunks (documento_nome);

CREATE INDEX IF NOT EXISTS idx_rag_categoria ON rag_chunks (categoria);

CREATE INDEX IF NOT EXISTS idx_rag_hash ON rag_chunks (hash_conteudo);

-- Criar tabela virtual FTS5 para busca full-text
CREATE VIRTUAL
TABLE IF NOT EXISTS rag_chunks_fts USING fts5 (
    titulo,
    conteudo,
    tags,
    categoria,
    content = 'rag_chunks',
    content_rowid = 'id',
    tokenize = "unicode61 remove_diacritics 2"
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