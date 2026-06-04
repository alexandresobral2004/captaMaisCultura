# 📋 Planejamento: Migração para SQLite com Arquitetura API

> **📍 Localização:** `docs/02-arquitetura/04-planejamento-sqlite-api.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

## Resumo Executivo

Migração do sistema atual (JSON) para banco de dados SQLite com arquitetura de API RESTful completa, separando totalmente frontend do backend, incluindo busca full-text e gerenciamento inteligente de arquivos PDF.

> **Status atual:** ✅ Migração concluída. Banco SQLite em produção com Drizzle ORM + FTS5.

## 1. Arquitetura de 3 Camadas

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   API       │────▶│   SQLite    │
│   (Next.js) │     │  (Next.js   │     │   Database  │
│             │◀────│   Routes)   │◀────│             │
└─────────────┘     └─────────────┘     └─────────────┘
     React              REST API          editais.db
                     JSON Responses        + FTS5
```

### Tecnologias Escolhidas
- **Banco de Dados**: SQLite com FTS5 (Full-Text Search)
- **ORM**: Drizzle ORM (TypeScript-first)
- **API**: Next.js API Routes v14
- **Validação**: Zod
- **Arquivos**: Sistema de arquivos local com integridade referencial

## 2. Estrutura do Banco de Dados

### 2.1 Schema Principal

```sql
-- Tabela principal de editais
CREATE TABLE editais (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  orgao TEXT NOT NULL,

  -- Informações financeiras
  valor TEXT,
  valor_min REAL,
  valor_max REAL,

  -- Datas
  data_publicacao DATETIME,
  data_limite DATETIME NOT NULL,
  data_resultado DATETIME,

  -- Status e classificação
  status TEXT CHECK(status IN ('Aberto', 'Prorrogado', 'Em Análise', 'Fechado')) NOT NULL,
  status_analise TEXT CHECK(status_analise IN ('pendente', 'pdf_baixado', 'analisado', 'sem_pdf', 'descartado', 'erro')),
  modalidade TEXT,
  abrangencia TEXT,

  -- Conteúdo
  descricao TEXT,
  link TEXT NOT NULL,
  pdf_url TEXT,
  pdf_path TEXT, -- Caminho local do PDF
  conteudo_completo TEXT,
  fonte_conteudo TEXT CHECK(fonte_conteudo IN ('pdf_s3', 'pdf_link', 'html_link', 'descricao_api', 'mock', 'sem_pdf')),

  -- Análise TI
  tecnologia_foco TEXT,
  tipo_ferramenta TEXT,
  score_relevancia INTEGER CHECK(score_relevancia >= 0 AND score_relevancia <= 100),
  score_confianca_ia INTEGER CHECK(score_confianca_ia >= 0 AND score_confianca_ia <= 100),
  validado_por_ia BOOLEAN DEFAULT 0,
  motivo_rejeicao TEXT,
  fora_do_escopo BOOLEAN DEFAULT 0,
  data_validacao_ia DATETIME,
  score_pontuacao INTEGER CHECK(score_pontuacao >= 0 AND score_pontuacao <= 100),
  nivel_pontuacao TEXT CHECK(nivel_pontuacao IN ('baixo', 'medio', 'alto')),
  modo_analise_ia TEXT CHECK(modo_analise_ia IN ('ignorar', 'simplificado', 'completo')),
  hash_pontuacao TEXT,
  cache_classificacao_usado BOOLEAN DEFAULT 0,

  -- Timestamps
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(id)
);
```

### Tabelas Auxiliares

```sql
-- Áreas temáticas (relação many-to-many)
CREATE TABLE areas_tematicas (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT UNIQUE NOT NULL);
CREATE TABLE editais_areas (edital_id TEXT, area_id INTEGER, PRIMARY KEY (edital_id, area_id));

-- Tipos de proponente
CREATE TABLE tipos_proponente (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT UNIQUE NOT NULL);
CREATE TABLE editais_tipos_proponente (edital_id TEXT, tipo_id INTEGER, PRIMARY KEY (edital_id, tipo_id));

-- Arquivos anexos
CREATE TABLE arquivos_anexos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edital_id TEXT NOT NULL,
  descricao TEXT, url TEXT, tipo TEXT, caminho_local TEXT,
  tamanho_bytes INTEGER, hash_arquivo TEXT,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (edital_id) REFERENCES editais(id) ON DELETE CASCADE
);

-- Palavras-chave
CREATE TABLE palavras_chave (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edital_id TEXT NOT NULL,
  palavra TEXT NOT NULL,
  frequencia INTEGER DEFAULT 1,
  FOREIGN KEY (edital_id) REFERENCES editais(id) ON DELETE CASCADE
);

-- Análise IA + tabelas normalizadas
CREATE TABLE analise_ia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edital_id TEXT UNIQUE NOT NULL,
  resumo TEXT, objetivo TEXT, elegibilidade TEXT,
  contato_edital TEXT, score_adequacao INTEGER,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (edital_id) REFERENCES editais(id) ON DELETE CASCADE
);

CREATE TABLE analise_requisitos (id INTEGER PK, analise_id INTEGER FK, requisito TEXT, ordem INTEGER);
CREATE TABLE analise_itens_financiaveis (id INTEGER PK, analise_id INTEGER FK, item TEXT, ordem INTEGER);
CREATE TABLE analise_documentos (id INTEGER PK, analise_id INTEGER FK, documento TEXT, ordem INTEGER);
CREATE TABLE analise_criterios (id INTEGER PK, analise_id INTEGER FK, criterio TEXT, ordem INTEGER);
CREATE TABLE analise_pontos_fracos (id INTEGER PK, analise_id INTEGER FK, ponto_fraco TEXT, ordem INTEGER);
CREATE TABLE motivos_pontuacao (id INTEGER PK, edital_id TEXT FK, motivo TEXT);
```

### 2.2 Full-Text Search (FTS5)

```sql
-- Tabela virtual para busca full-text
CREATE VIRTUAL TABLE editais_fts USING fts5(
  titulo, descricao, conteudo_completo, orgao,
  content=editais, content_rowid=rowid,
  tokenize="unicode61 remove_diacritics 2"
);

-- Triggers para manter FTS sincronizado
CREATE TRIGGER editais_fts_insert AFTER INSERT ON editais BEGIN
  INSERT INTO editais_fts(rowid, titulo, descricao, conteudo_completo, orgao)
  VALUES (new.rowid, new.titulo, new.descricao, new.conteudo_completo, new.orgao);
END;

CREATE TRIGGER editais_fts_delete AFTER DELETE ON editais BEGIN
  DELETE FROM editais_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER editais_fts_update AFTER UPDATE ON editais BEGIN
  DELETE FROM editais_fts WHERE rowid = old.rowid;
  INSERT INTO editais_fts(rowid, titulo, descricao, conteudo_completo, orgao)
  VALUES (new.rowid, new.titulo, new.descricao, new.conteudo_completo, new.orgao);
END;
```

### 2.3 Índices para Performance

```sql
CREATE INDEX idx_editais_status ON editais(status);
CREATE INDEX idx_editais_data_limite ON editais(data_limite);
CREATE INDEX idx_editais_orgao ON editais(orgao);
CREATE INDEX idx_editais_score_relevancia ON editais(score_relevancia);
CREATE INDEX idx_editais_tecnologia ON editais(tecnologia_foco);
CREATE INDEX idx_editais_criado_em ON editais(criado_em);
CREATE INDEX idx_arquivos_edital ON arquivos_anexos(edital_id);
CREATE INDEX idx_palavras_edital ON palavras_chave(edital_id);
```

### 2.4 Triggers para Timestamps

```sql
CREATE TRIGGER update_editais_timestamp
AFTER UPDATE ON editais
FOR EACH ROW
BEGIN
  UPDATE editais SET atualizado_em = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_analise_timestamp
AFTER UPDATE ON analise_ia
FOR EACH ROW
BEGIN
  UPDATE analise_ia SET atualizado_em = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

## 3. Estrutura de API RESTful

### 3.1 Endpoints Disponíveis (v1)

```typescript
// EDITAIS - CRUD Completo
GET    /api/v1/editais                 // Listar com paginação e filtros
GET    /api/v1/editais/:id             // Buscar edital específico
POST   /api/v1/editais                 // Criar novo edital
PUT    /api/v1/editais/:id             // Atualizar edital
DELETE /api/v1/editais/:id             // Deletar edital e arquivo PDF
PATCH  /api/v1/editais/:id/status      // Atualizar apenas status

// BUSCA E FILTROS
GET    /api/v1/editais/search          // Busca full-text
GET    /api/v1/editais/filters         // Retorna filtros disponíveis
GET    /api/v1/editais/stats           // Estatísticas gerais

// ANÁLISE IA
POST   /api/v1/editais/:id/analyze     // Analisar com IA
GET    /api/v1/editais/:id/analysis    // Buscar análise existente
PUT    /api/v1/editais/:id/analysis    // Atualizar análise
POST   /api/v1/editais/:id/reanalyze   // Re-analisar edital

// ARQUIVOS
POST   /api/v1/editais/:id/upload      // Upload de PDF
GET    /api/v1/editais/:id/download    // Download do PDF
DELETE /api/v1/editais/:id/file        // Deletar apenas arquivo
POST   /api/v1/editais/upload-pdf      // Upload em massa

// IMPORTAÇÃO
POST   /api/v1/import/folder           // Importar PDFs da pasta downloads
POST   /api/v1/import/scrape           // Buscar editais nos portais
GET    /api/v1/import/status           // Status da importação

// FILTROS
GET    /api/v1/filtros                 // Listar filtros
POST   /api/v1/filtros/simular         // Simular aplicação de filtros
GET    /api/v1/filtros/whitelist       // Whitelist
GET    /api/v1/filtros/blacklist       // Blacklist

// LOGS
GET    /api/v1/logs                    // Logs do sistema
GET    /api/v1/logs/stats              // Estatísticas dos logs

// PORTAIS
GET    /api/v1/portais                 // Listar portais
PUT    /api/v1/portais/:id/toggle      // Habilitar/desabilitar portal

// USUÁRIOS
POST   /api/v1/usuarios/cadastrar      // Cadastro
POST   /api/v1/usuarios/login          // Login
GET    /api/v1/usuarios                // Listar
GET    /api/v1/usuarios/:id            // Detalhes
PUT    /api/v1/usuarios/:id            // Atualizar
DELETE /api/v1/usuarios/:id            // Deletar

// PROJETOS
GET    /api/v1/projetos                // Listar
POST   /api/v1/projetos                // Criar
GET    /api/v1/projetos/:id            // Detalhes
PUT    /api/v1/projetos/:id            // Atualizar
DELETE /api/v1/projetos/:id            // Deletar
POST   /api/v1/projetos/:id/gerar      // Gerar proposta IA

// ÁREAS E TAGS
GET    /api/v1/areas                   // Listar áreas temáticas
POST   /api/v1/areas                   // Criar área
GET    /api/v1/tags                    // Listar tags/palavras-chave

// SCRAPER LOGS
POST   /api/v1/scraper/logs/trigger    // Disparar scraper
GET    /api/v1/scraper/logs/stream     // Stream de logs
```

### 3.2 Estrutura de Resposta Padronizada

```typescript
// Resposta de sucesso
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    version: string;
  };
}

// Resposta de erro
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    version: string;
  };
}

// Resposta paginada
interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  meta: {
    timestamp: string;
    version: string;
  };
}
```

### 3.3 Parâmetros de Query

```typescript
// GET /api/v1/editais
interface ListEditaisQuery {
  // Paginação
  page?: number;        // Default: 1
  limit?: number;       // Default: 20, Max: 100

  // Filtros
  status?: 'Aberto' | 'Prorrogado' | 'Em Análise' | 'Fechado';
  orgao?: string;
  tecnologia?: string;
  scoreMin?: number;
  scoreMax?: number;
  dataInicio?: string;  // ISO 8601
  dataFim?: string;     // ISO 8601

  // Busca
  search?: string;      // Full-text search

  // Ordenação
  sortBy?: 'criado_em' | 'data_limite' | 'score_relevancia' | 'titulo';
  sortOrder?: 'asc' | 'desc';
}
```

## 4. Estrutura de Código

### 4.1 Organização de Pastas

```
/app/api/v1/
├── editais/
│   ├── route.ts                    // GET (listar) e POST (criar)
│   ├── [id]/
│   │   ├── route.ts                // GET, PUT, DELETE individual
│   │   ├── status/route.ts         // PATCH status
│   │   ├── analyze/route.ts        // POST análise IA
│   │   ├── reanalyze/route.ts      // POST re-analisar
│   │   ├── analysis/route.ts       // GET/PUT análise
│   │   ├── upload/route.ts         // POST upload PDF
│   │   ├── download/route.ts       // GET download PDF
│   │   └── file/route.ts           // DELETE arquivo
│   ├── search/route.ts             // GET busca full-text
│   ├── filters/route.ts            // GET filtros disponíveis
│   └── stats/route.ts              // GET estatísticas
├── import/
│   ├── folder/route.ts             // POST importar pasta
│   ├── scrape/route.ts             // POST scraping
│   └── status/route.ts             // GET status
├── areas/route.ts                  // GET/POST áreas
└── tags/route.ts                   // GET tags

/lib/
├── api/
│   ├── middleware/                 // error-handler, validation, rate-limit
│   ├── responses/                  // success, error
│   └── validators/                 // Zod schemas
├── database/
│   ├── schema.ts                   // Schema Drizzle
│   ├── db.ts                       // Conexão SQLite
│   ├── repositories/               // base, edital, analise, search
│   └── services/                   // edital, file, import
├── api-client/
│   ├── edital.client.ts            // Cliente TypeScript para frontend
│   └── types.ts                    // Tipos compartilhados
```

### 4.2 Stack Técnica

```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0",     // Driver SQLite otimizado
    "drizzle-orm": "^0.35.0",        // ORM TypeScript-first
    "zod": "^3.23.0",                // Validação de schemas
    "multer": "^1.4.5-lts.1"         // Upload de arquivos
  },
  "devDependencies": {
    "drizzle-kit": "^0.27.0",        // CLI para migrations
    "@types/better-sqlite3": "^7.6.0",
    "@types/multer": "^1.4.11"
  }
}
```

## 5. Implementações Detalhadas

### 5.1 Configuração do Banco

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/database/schema.ts',
  out: './lib/database/migrations',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: './data/db/editais.db',
  },
  verbose: true,
  strict: true,
});
```

```typescript
// lib/database/db.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

// Criar conexão SQLite
const sqlite = new Database('./data/db/editais.db');
sqlite.pragma('journal_mode = WAL'); // Performance
sqlite.pragma('foreign_keys = ON');  // Integridade referencial

// Criar instância Drizzle
export const db = drizzle(sqlite, { schema });

// Função para criar FTS5 se não existir
export function setupFTS() {
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS editais_fts USING fts5(
      titulo, descricao, conteudo_completo, orgao,
      content=editais, content_rowid=rowid,
      tokenize="unicode61 remove_diacritics 2"
    );
  `);
}
```

### 5.2 Schema Drizzle (resumo)

```typescript
// lib/database/schema.ts
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

export const editais = sqliteTable('editais', {
  id: text('id').primaryKey(),
  titulo: text('titulo').notNull(),
  orgao: text('orgao').notNull(),

  // Financeiro
  valor: text('valor'),
  valorMin: real('valor_min'),
  valorMax: real('valor_max'),

  // Datas
  dataPublicacao: text('data_publicacao'),
  dataLimite: text('data_limite').notNull(),
  dataResultado: text('data_resultado'),

  // Status
  status: text('status', {
    enum: ['Aberto', 'Prorrogado', 'Em Análise', 'Fechado']
  }).notNull(),
  statusAnalise: text('status_analise', {
    enum: ['pendente', 'pdf_baixado', 'analisado', 'sem_pdf', 'descartado', 'erro']
  }),

  // Conteúdo
  descricao: text('descricao'),
  link: text('link').notNull(),
  pdfUrl: text('pdf_url'),
  pdfPath: text('pdf_path'),
  conteudoCompleto: text('conteudo_completo'),
  fonteConteudo: text('fonte_conteudo', {
    enum: ['pdf_s3', 'pdf_link', 'html_link', 'descricao_api', 'mock', 'sem_pdf']
  }),

  // Análise TI
  tecnologiaFoco: text('tecnologia_foco'),
  tipoFerramenta: text('tipo_ferramenta'),
  scoreRelevancia: integer('score_relevancia'),
  scoreConfiancaIa: integer('score_confianca_ia'),
  validadoPorIa: integer('validado_por_ia', { mode: 'boolean' }),
  motivoRejeicao: text('motivo_rejeicao'),
  foraDoEscopo: integer('fora_do_escopo', { mode: 'boolean' }),
  dataValidacaoIa: text('data_validacao_ia'),
  scorePontuacao: integer('score_pontuacao'),
  nivelPontuacao: text('nivel_pontuacao', {
    enum: ['baixo', 'medio', 'alto']
  }),

  // Timestamps
  criadoEm: text('criado_em').default('CURRENT_TIMESTAMP'),
  atualizadoEm: text('atualizado_em').default('CURRENT_TIMESTAMP'),
}, (table) => {
  return {
    statusIdx: index('idx_status').on(table.status),
    dataLimiteIdx: index('idx_data_limite').on(table.dataLimite),
    orgaoIdx: index('idx_orgao').on(table.orgao),
    scoreIdx: index('idx_score').on(table.scoreRelevancia),
  };
});
```

### 5.3 Repository Pattern

```typescript
// lib/database/repositories/edital.repository.ts
import { db } from '../db';
import { editais, analiseIa, arquivosAnexos } from '../schema';
import { eq, desc, and, gte, lte, like, sql } from 'drizzle-orm';

export class EditalRepository {
  async findAll(query: ListQuery) {
    const conditions = [];

    // Montar filtros
    if (query.status) conditions.push(eq(editais.status, query.status));
    if (query.orgao) conditions.push(like(editais.orgao, `%${query.orgao}%`));
    if (query.dataInicio) conditions.push(gte(editais.dataLimite, query.dataInicio));
    if (query.dataFim) conditions.push(lte(editais.dataLimite, query.dataFim));
    if (query.scoreMin) conditions.push(gte(editais.scoreRelevancia, query.scoreMin));

    // Query com paginação
    const offset = (query.page - 1) * query.limit;

    const [data, countResult] = await Promise.all([
      db.select().from(editais).where(and(...conditions))
        .orderBy(desc(editais[query.sortBy]))
        .limit(query.limit).offset(offset),
      db.select({ count: sql`count(*)` }).from(editais).where(and(...conditions))
    ]);

    return { data, total: countResult[0].count };
  }

  async findById(id: string) {
    const result = await db.select().from(editais).where(eq(editais.id, id)).limit(1);
    return result[0];
  }

  async create(data: CreateEditalDTO) {
    const result = await db.insert(editais).values(data).returning();
    return result[0];
  }

  async update(id: string, data: UpdateEditalDTO) {
    const result = await db.update(editais).set(data).where(eq(editais.id, id)).returning();
    return result[0];
  }

  async delete(id: string) {
    // Cascata: remove análises, arquivos, palavras-chave
    await db.delete(editais).where(eq(editais.id, id));
    return true;
  }
}
```

## 6. Cronograma de Implementação (concluído)

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | Setup do banco SQLite + Drizzle ORM | ✅ |
| 2 | Schema completo (15 tabelas) | ✅ |
| 3 | Configuração FTS5 | ✅ |
| 4 | Repositórios base | ✅ |
| 5 | Endpoints CRUD v1 | ✅ |
| 6 | Validação Zod | ✅ |
| 7 | Respostas padronizadas | ✅ |
| 8 | Cliente API (frontend) | ✅ |
| 9 | Migração JSON → SQLite | ✅ |
| 10 | Testes de integração | ✅ |

## 7. Próximas Fases (Futuro)

- [ ] Integração com GPT-4 Vision para análise de PDFs
- [ ] Webhooks para notificação de novos editais
- [ ] GraphQL API como alternativa
- [ ] Cache Redis para queries frequentes
- [ ] Backup automático para cloud (S3/Drive)
- [ ] Dashboard de analytics em tempo real
- [ ] Migração para PostgreSQL em produção

---

## 📚 Documentação Relacionada

- **API Documentation completa:** [`05-api-documentacao.md`](05-api-documentacao.md)
- **Estrutura do codebase:** [`03-estrutura-codebase.md`](03-estrutura-codebase.md)
- **Mapa do projeto:** [`02-mapa-projeto.md`](02-mapa-projeto.md)
- **Quickstart API:** [`../01-introducao/02-quickstart.md`](../01-introducao/02-quickstart.md)
