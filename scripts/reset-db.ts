import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'data', 'db', 'editais.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
-- Tabela editais
CREATE TABLE IF NOT EXISTS editais (
  id text PRIMARY KEY NOT NULL,
  titulo text NOT NULL,
  orgao text NOT NULL,
  valor text,
  valor_min real,
  valor_max real,
  data_publicacao text,
  data_abertura text,
  data_limite text NOT NULL,
  data_resultado text,
  status text DEFAULT 'Aberto' NOT NULL,
  status_analise text DEFAULT 'pendente',
  modalidade text,
  abrangencia text,
  tipo_proponente text,
  areas_tematicas text,
  tipo_edital text,
  descricao text,
  link text NOT NULL,
  pdf_url text,
  pdf_path text,
  conteudo_completo text,
  fonte_conteudo text,
  arquivos_anexos text,
  tecnologia_foco text,
  tipo_ferramenta text,
  score_relevancia integer,
  score_confianca_ia integer,
  validado_por_ia integer DEFAULT false,
  motivo_rejeicao text,
  fora_do_escopo integer DEFAULT false,
  data_validacao_ia text,
  score_pontuacao integer,
  nivel_pontuacao text,
  motivos_pontuacao text,
  modo_analise_ia text,
  hash_pontuacao text,
  cache_classificacao_usado integer DEFAULT false,
  confianca_por_campo text,
  criado_em text DEFAULT CURRENT_TIMESTAMP,
  atualizado_em text DEFAULT CURRENT_TIMESTAMP,
  deleted_at text,
  codigo text UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_editais_status ON editais (status);
CREATE INDEX IF NOT EXISTS idx_editais_data_limite ON editais (data_limite);
CREATE INDEX IF NOT EXISTS idx_editais_orgao ON editais (orgao);
CREATE INDEX IF NOT EXISTS idx_editais_score ON editais (score_relevancia);
CREATE INDEX IF NOT EXISTS idx_editais_tecnologia ON editais (tecnologia_foco);
CREATE INDEX IF NOT EXISTS idx_editais_criado_em ON editais (criado_em);
CREATE INDEX IF NOT EXISTS idx_editais_deleted_at ON editais (deleted_at);

-- Tabela projetos
CREATE TABLE IF NOT EXISTS projetos (
  id text PRIMARY KEY NOT NULL,
  edital_id text NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  area_atuacao text,
  proposta_usuario text,
  resumo_executivo text,
  justificativa text,
  objetivos text,
  metodologia text,
  resultados_esperados text,
  cronograma text,
  orcamento_detalhado text,
  valor_solicitado real,
  prazo_meses integer,
  equipe text,
  criterios_atendidos text,
  criterios_pendentes text,
  score_compliance integer,
  status text DEFAULT 'rascunho',
  versao integer DEFAULT 1,
  prompt_original text,
  fontes text,
  criado_em text DEFAULT CURRENT_TIMESTAMP,
  atualizado_em text DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projetos_edital_id ON projetos (edital_id);
CREATE INDEX IF NOT EXISTS idx_projetos_status ON projetos (status);
CREATE INDEX IF NOT EXISTS idx_projetos_criado_em ON projetos (criado_em);

-- Tabela analise_ia
CREATE TABLE IF NOT EXISTS analise_ia (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  edital_id text NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  resumo text,
  objetivo text,
  elegibilidade text,
  contato_edital text,
  score_adequacao integer,
  criado_em text DEFAULT CURRENT_TIMESTAMP,
  atualizado_em text DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS analise_ia_edital_id_unique ON analise_ia (edital_id);

-- Tabela analise_criterios
CREATE TABLE IF NOT EXISTS analise_criterios (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  analise_id integer NOT NULL REFERENCES analise_ia(id) ON DELETE CASCADE,
  criterio text NOT NULL,
  ordem integer DEFAULT 0
);

-- Tabela analise_documentos
CREATE TABLE IF NOT EXISTS analise_documentos (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  analise_id integer NOT NULL REFERENCES analise_ia(id) ON DELETE CASCADE,
  documento text NOT NULL,
  ordem integer DEFAULT 0
);

-- Tabela analise_itens_financiaveis
CREATE TABLE IF NOT EXISTS analise_itens_financiaveis (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  analise_id integer NOT NULL REFERENCES analise_ia(id) ON DELETE CASCADE,
  item text NOT NULL,
  ordem integer DEFAULT 0
);

-- Tabela analise_pontos_fracos
CREATE TABLE IF NOT EXISTS analise_pontos_fracos (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  analise_id integer NOT NULL REFERENCES analise_ia(id) ON DELETE CASCADE,
  ponto_fraco text NOT NULL,
  ordem integer DEFAULT 0
);

-- Tabela analise_requisitos
CREATE TABLE IF NOT EXISTS analise_requisitos (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  analise_id integer NOT NULL REFERENCES analise_ia(id) ON DELETE CASCADE,
  requisito text NOT NULL,
  ordem integer DEFAULT 0
);

-- Tabela arquivos_anexos
CREATE TABLE IF NOT EXISTS arquivos_anexos (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  edital_id text NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  descricao text,
  url text,
  tipo text,
  caminho_local text,
  tamanho_bytes integer,
  hash_arquivo text,
  criado_em text DEFAULT CURRENT_TIMESTAMP
);

-- Tabela motivos_pontuacao
CREATE TABLE IF NOT EXISTS motivos_pontuacao (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  edital_id text NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  motivo text NOT NULL
);

-- Tabela palavras_chave
CREATE TABLE IF NOT EXISTS palavras_chave (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  edital_id text NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  palavra text NOT NULL,
  frequencia integer DEFAULT 1
);

-- Tabela usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id text PRIMARY KEY NOT NULL,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  role text DEFAULT 'leitor' NOT NULL,
  status text DEFAULT 'ativo' NOT NULL,
  criado_em text DEFAULT CURRENT_TIMESTAMP,
  atualizado_em text DEFAULT CURRENT_TIMESTAMP
);

-- Tabela areas_tematicas
CREATE TABLE IF NOT EXISTS areas_tematicas (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  nome text NOT NULL UNIQUE
);

-- Tabela tipos_proponente
CREATE TABLE IF NOT EXISTS tipos_proponente (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  nome text NOT NULL UNIQUE
);
`);

db.close();
console.log('✅ Banco de dados recriado com sucesso em', dbPath);