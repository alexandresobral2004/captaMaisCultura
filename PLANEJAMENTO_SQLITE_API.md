# 📋 Planejamento: Migração para SQLite com Arquitetura API

## Resumo Executivo

Migração do sistema atual (JSON) para banco de dados SQLite com arquitetura de API RESTful completa, separando totalmente frontend do backend, incluindo busca full-text e gerenciamento inteligente de arquivos PDF.

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
  
  -- Índices para busca
  UNIQUE(id)
);

-- Tabela de áreas temáticas (relação many-to-many)
CREATE TABLE areas_tematicas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT UNIQUE NOT NULL
);

CREATE TABLE editais_areas (
  edital_id TEXT NOT NULL,
  area_id INTEGER NOT NULL,
  PRIMARY KEY (edital_id, area_id),
  FOREIGN KEY (edital_id) REFERENCES editais(id) ON DELETE CASCADE,
  FOREIGN KEY (area_id) REFERENCES areas_tematicas(id)
);

-- Tabela de tipos de proponente
CREATE TABLE tipos_proponente (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT UNIQUE NOT NULL
);

CREATE TABLE editais_tipos_proponente (
  edital_id TEXT NOT NULL,
  tipo_id INTEGER NOT NULL,
  PRIMARY KEY (edital_id, tipo_id),
  FOREIGN KEY (edital_id) REFERENCES editais(id) ON DELETE CASCADE,
  FOREIGN KEY (tipo_id) REFERENCES tipos_proponente(id)
);

-- Tabela de arquivos anexos
CREATE TABLE arquivos_anexos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edital_id TEXT NOT NULL,
  descricao TEXT,
  url TEXT,
  tipo TEXT,
  caminho_local TEXT,
  tamanho_bytes INTEGER,
  hash_arquivo TEXT,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (edital_id) REFERENCES editais(id) ON DELETE CASCADE
);

-- Tabela de palavras-chave encontradas
CREATE TABLE palavras_chave (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edital_id TEXT NOT NULL,
  palavra TEXT NOT NULL,
  frequencia INTEGER DEFAULT 1,
  FOREIGN KEY (edital_id) REFERENCES editais(id) ON DELETE CASCADE
);

-- Tabela de análise IA (dados estruturados)
CREATE TABLE analise_ia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edital_id TEXT UNIQUE NOT NULL,
  resumo TEXT,
  objetivo TEXT,
  elegibilidade TEXT,
  contato_edital TEXT,
  score_adequacao INTEGER CHECK(score_adequacao >= 0 AND score_adequacao <= 100),
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (edital_id) REFERENCES editais(id) ON DELETE CASCADE
);

-- Tabela de requisitos (relação 1-to-many com análise)
CREATE TABLE analise_requisitos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analise_id INTEGER NOT NULL,
  requisito TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  FOREIGN KEY (analise_id) REFERENCES analise_ia(id) ON DELETE CASCADE
);

-- Tabela de itens financiáveis
CREATE TABLE analise_itens_financiaveis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analise_id INTEGER NOT NULL,
  item TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  FOREIGN KEY (analise_id) REFERENCES analise_ia(id) ON DELETE CASCADE
);

-- Tabela de documentos necessários
CREATE TABLE analise_documentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analise_id INTEGER NOT NULL,
  documento TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  FOREIGN KEY (analise_id) REFERENCES analise_ia(id) ON DELETE CASCADE
);

-- Tabela de critérios de avaliação
CREATE TABLE analise_criterios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analise_id INTEGER NOT NULL,
  criterio TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  FOREIGN KEY (analise_id) REFERENCES analise_ia(id) ON DELETE CASCADE
);

-- Tabela de pontos fracos
CREATE TABLE analise_pontos_fracos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analise_id INTEGER NOT NULL,
  ponto_fraco TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  FOREIGN KEY (analise_id) REFERENCES analise_ia(id) ON DELETE CASCADE
);

-- Tabela de motivos de pontuação
CREATE TABLE motivos_pontuacao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edital_id TEXT NOT NULL,
  motivo TEXT NOT NULL,
  FOREIGN KEY (edital_id) REFERENCES editais(id) ON DELETE CASCADE
);
```

### 2.2 Full-Text Search (FTS5)

```sql
-- Tabela virtual para busca full-text
CREATE VIRTUAL TABLE editais_fts USING fts5(
  titulo,
  descricao,
  conteudo_completo,
  orgao,
  content=editais,
  content_rowid=rowid,
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
-- Índices para queries comuns
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
-- Atualização automática de timestamps
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

### 3.1 Endpoints Disponíveis

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

// ARQUIVOS
POST   /api/v1/editais/:id/upload      // Upload de PDF
GET    /api/v1/editais/:id/download    // Download do PDF
DELETE /api/v1/editais/:id/file        // Deletar apenas arquivo

// IMPORTAÇÃO
POST   /api/v1/import/folder           // Importar PDFs da pasta downloads
POST   /api/v1/import/scrape           // Buscar editais nos portais
GET    /api/v1/import/status           // Status da importação

// ÁREAS E TAGS
GET    /api/v1/areas                   // Listar áreas temáticas
POST   /api/v1/areas                   // Criar área
GET    /api/v1/tags                    // Listar tags/palavras-chave
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
│   ├── middleware/
│   │   ├── error-handler.ts        // Tratamento global de erros
│   │   ├── validation.ts           // Validação de entrada
│   │   └── rate-limit.ts          // Rate limiting
│   ├── responses/
│   │   ├── success.ts             // Resposta padronizada sucesso
│   │   └── error.ts               // Resposta padronizada erro
│   └── validators/
│       ├── edital.validator.ts    // Schemas Zod para validação
│       └── query.validator.ts     // Validação de query params
├── database/
│   ├── schema.ts                  // Schema Drizzle
│   ├── db.ts                      // Conexão SQLite
│   ├── repositories/
│   │   ├── base.repository.ts     // Classe base
│   │   ├── edital.repository.ts   // CRUD editais
│   │   ├── analise.repository.ts  // Análises IA
│   │   └── search.repository.ts   // Busca FTS
│   └── services/
│       ├── edital.service.ts      // Lógica de negócio
│       ├── file.service.ts        // Gerenciamento de arquivos
│       └── import.service.ts      // Importação em lote
├── api-client/
│   ├── edital.client.ts           // Cliente TypeScript para frontend
│   └── types.ts                   // Tipos compartilhados
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
      titulo,
      descricao,
      conteudo_completo,
      orgao,
      content=editais,
      content_rowid=rowid,
      tokenize="unicode61 remove_diacritics 2"
    );
  `);
}
```

### 5.2 Schema Drizzle

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
    if (query.status) {
      conditions.push(eq(editais.status, query.status));
    }
    if (query.orgao) {
      conditions.push(like(editais.orgao, `%${query.orgao}%`));
    }
    if (query.dataInicio) {
      conditions.push(gte(editais.dataLimite, query.dataInicio));
    }
    if (query.dataFim) {
      conditions.push(lte(editais.dataLimite, query.dataFim));
    }
    if (query.scoreMin) {
      conditions.push(gte(editais.scoreRelevancia, query.scoreMin));
    }
    
    // Query com paginação
    const offset = (query.page - 1) * query.limit;
    
    const [data, countResult] = await Promise.all([
      db.select()
        .from(editais)
        .where(and(...conditions))
        .orderBy(desc(editais[query.sortBy]))
        .limit(query.limit)
        .offset(offset),
      
      db.select({ count: sql`count(*)` })
        .from(editais)
        .where(and(...conditions))
    ]);
    
    return {
      data,
      total: countResult[0].count
    };
  }
  
  async findById(id: string) {
    const result = await db.select()
      .from(editais)
      .where(eq(editais.id, id))
      .limit(1);
    
    return result[0];
  }
  
  async create(data: CreateEditalDTO) {
    const result = await db.insert(editais).values(data).returning();
    return result[0];
  }
  
  async update(id: string, data: UpdateEditalDTO) {
    const result = await db.update(editais)
      .set(data)
      .where(eq(editais.id, id))
      .returning();
    return result[0];
  }
  
  async delete(id: string) {
    await db.delete(editais).where(eq(editais.id, id));
  }
  
  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return db.transaction(fn);
  }
}
```

### 5.4 Service Layer

```typescript
// lib/database/services/edital.service.ts
import { EditalRepository } from '../repositories/edital.repository';
import { FileService } from './file.service';
import { SearchRepository } from '../repositories/search.repository';

export class EditalService {
  constructor(
    private editalRepo = new EditalRepository(),
    private fileService = new FileService(),
    private searchRepo = new SearchRepository()
  ) {}

  async listar(query: ListQuery): Promise<PaginatedResult<Edital>> {
    // Se tem busca full-text, usar FTS5
    if (query.search) {
      return this.searchRepo.searchEditais(query);
    }
    
    // Senão, query normal com filtros
    return this.editalRepo.findAll(query);
  }

  async criar(data: CreateEditalDTO): Promise<Edital> {
    // Iniciar transação
    return this.editalRepo.transaction(async (tx) => {
      // 1. Criar edital
      const edital = await this.editalRepo.create(data);
      
      // 2. Se tem PDF, processar
      if (data.pdfFile) {
        const pdfPath = await this.fileService.salvarPDF(
          data.pdfFile,
          edital.id
        );
        await this.editalRepo.update(edital.id, { pdfPath });
      }
      
      // 3. Inserir tags e áreas
      if (data.areas) {
        await this.inserirAreas(tx, edital.id, data.areas);
      }
      
      return edital;
    });
  }

  async deletar(id: string): Promise<void> {
    // 1. Buscar edital
    const edital = await this.editalRepo.findById(id);
    if (!edital) throw new Error('Edital não encontrado');
    
    // 2. Deletar arquivo físico se existir
    if (edital.pdfPath) {
      await this.fileService.deletarArquivo(edital.pdfPath);
    }
    
    // 3. Deletar do banco (cascade cuida do resto)
    await this.editalRepo.delete(id);
  }
}
```

### 5.5 File Management

```typescript
// lib/database/services/file.service.ts
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class FileService {
  private basePath = path.join(process.cwd(), 'data', 'downloads');
  
  async salvarPDF(file: File, editalId: string): Promise<string> {
    // Gerar nome único
    const fileName = `edital-${editalId}-${Date.now()}.pdf`;
    const filePath = path.join(this.basePath, fileName);
    
    // Salvar arquivo
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    
    // Calcular hash para integridade
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    
    // Retornar caminho relativo
    return `downloads/${fileName}`;
  }
  
  async deletarArquivo(relativePath: string): Promise<void> {
    const fullPath = path.join(process.cwd(), 'data', relativePath);
    
    try {
      await fs.unlink(fullPath);
      
      // Tentar deletar arquivo de conteúdo também
      const txtPath = fullPath.replace('.pdf', '-conteudo.txt');
      await fs.unlink(txtPath).catch(() => {});
    } catch (error) {
      console.error(`Erro ao deletar arquivo: ${error.message}`);
    }
  }
  
  async verificarIntegridade(): Promise<{
    orfaos: string[],
    faltando: string[]
  }> {
    const arquivos = await fs.readdir(this.basePath);
    const pdfFiles = arquivos.filter(f => f.endsWith('.pdf'));
    
    // Buscar todos editais com PDF
    const editaisComPdf = await this.editalRepo.findWithPdf();
    
    const orfaos = [];
    const faltando = [];
    
    // Verificar órfãos
    for (const arquivo of pdfFiles) {
      const existe = editaisComPdf.some(e => 
        e.pdfPath && e.pdfPath.includes(arquivo)
      );
      if (!existe) {
        orfaos.push(arquivo);
      }
    }
    
    // Verificar faltando
    for (const edital of editaisComPdf) {
      if (edital.pdfPath) {
        const fullPath = path.join(this.basePath, 
          edital.pdfPath.replace('downloads/', '')
        );
        const existe = await fs.access(fullPath)
          .then(() => true)
          .catch(() => false);
        if (!existe) {
          faltando.push(edital.id);
        }
      }
    }
    
    return { orfaos, faltando };
  }
}
```

### 5.6 API Endpoints

```typescript
// app/api/v1/editais/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';
import { successResponse, errorResponse } from '@/lib/api/responses';
import { validateQuery, validateBody } from '@/lib/api/validators';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Validar e extrair parâmetros
    const query = validateQuery({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      status: searchParams.get('status'),
      orgao: searchParams.get('orgao'),
      search: searchParams.get('search'),
      sortBy: searchParams.get('sortBy') || 'criado_em',
      sortOrder: searchParams.get('sortOrder') || 'desc',
      dataInicio: searchParams.get('dataInicio'),
      dataFim: searchParams.get('dataFim'),
      tecnologia: searchParams.get('tecnologia'),
      scoreMin: searchParams.get('scoreMin'),
    });

    const service = new EditalService();
    const result = await service.listar(query);

    return NextResponse.json(successResponse(result.data, {
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pages: Math.ceil(result.total / query.limit)
      }
    }));
  } catch (error) {
    return NextResponse.json(
      errorResponse('FETCH_ERROR', error.message),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar entrada
    const validatedData = validateBody(body);
    
    const service = new EditalService();
    const novoEdital = await service.criar(validatedData);

    return NextResponse.json(
      successResponse(novoEdital),
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      errorResponse('CREATE_ERROR', error.message),
      { status: 400 }
    );
  }
}
```

```typescript
// app/api/v1/editais/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';
import { successResponse, errorResponse } from '@/lib/api/responses';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const service = new EditalService();
    const edital = await service.buscarPorId(params.id);
    
    if (!edital) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Edital não encontrado'),
        { status: 404 }
      );
    }
    
    return NextResponse.json(successResponse(edital));
  } catch (error) {
    return NextResponse.json(
      errorResponse('FETCH_ERROR', error.message),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const service = new EditalService();
    await service.deletar(params.id);
    
    return NextResponse.json(
      successResponse({ message: 'Edital deletado com sucesso' }),
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      errorResponse('DELETE_ERROR', error.message),
      { status: 500 }
    );
  }
}
```

### 5.7 Search Endpoint

```typescript
// app/api/v1/editais/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { SearchRepository } from '@/lib/database/repositories/search.repository';
import { successResponse, errorResponse } from '@/lib/api/responses';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('search');
    
    if (!query) {
      return NextResponse.json(
        errorResponse('INVALID_QUERY', 'Termo de busca é obrigatório'),
        { status: 400 }
      );
    }
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const filters = {
      status: searchParams.get('status'),
      orgao: searchParams.get('orgao'),
      tecnologia: searchParams.get('tecnologia'),
    };
    
    const searchRepo = new SearchRepository();
    const result = await searchRepo.searchFullText(query, {
      page,
      limit,
      ...filters
    });
    
    return NextResponse.json(successResponse(result.data, {
      pagination: {
        page,
        limit,
        total: result.total,
        pages: Math.ceil(result.total / limit)
      },
      search: {
        query,
        highlights: result.highlights
      }
    }));
  } catch (error) {
    return NextResponse.json(
      errorResponse('SEARCH_ERROR', error.message),
      { status: 500 }
    );
  }
}
```

### 5.8 Frontend Client

```typescript
// lib/api-client/edital.client.ts
export class EditalAPIClient {
  private baseUrl = '/api/v1';
  
  async listarEditais(filters?: FilterParams): Promise<PaginatedResponse<Edital>> {
    const params = new URLSearchParams(filters as any);
    const response = await fetch(`${this.baseUrl}/editais?${params}`);
    
    if (!response.ok) {
      throw new Error('Erro ao buscar editais');
    }
    
    return response.json();
  }
  
  async buscarEdital(id: string): Promise<Edital> {
    const response = await fetch(`${this.baseUrl}/editais/${id}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error.message);
    }
    
    return data.data;
  }
  
  async deletarEdital(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/editais/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Erro ao deletar edital');
    }
  }
  
  async buscarFullText(termo: string, filtros?: FilterParams) {
    const params = new URLSearchParams({
      search: termo,
      ...filtros
    } as any);
    
    const response = await fetch(`${this.baseUrl}/editais/search?${params}`);
    return response.json();
  }
  
  async uploadPDF(editalId: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('pdf', file);
    
    const response = await fetch(`${this.baseUrl}/editais/${editalId}/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Erro ao fazer upload do PDF');
    }
  }
  
  async downloadPDF(editalId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/editais/${editalId}/download`);
    
    if (!response.ok) {
      throw new Error('Erro ao baixar PDF');
    }
    
    return response.blob();
  }
}
```

## 6. Migração de Dados

### 6.1 Script de Migração

```typescript
// scripts/migrate-to-sqlite.ts
import { db } from '@/lib/database/db';
import { editais, analiseIa, palavrasChave } from '@/lib/database/schema';
import fs from 'fs';
import path from 'path';

async function migrate() {
  console.log('🚀 Iniciando migração para SQLite...');
  
  // 1. Ler JSON existente
  const jsonPath = path.join(process.cwd(), 'data', 'editais.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  
  console.log(`📊 Encontrados ${jsonData.length} editais para migrar`);
  
  // 2. Criar backup
  const backupPath = jsonPath + '.backup-' + Date.now();
  fs.copyFileSync(jsonPath, backupPath);
  console.log(`💾 Backup criado em: ${backupPath}`);
  
  // 3. Migrar em lotes
  const batchSize = 100;
  let migrados = 0;
  let erros = 0;
  
  for (let i = 0; i < jsonData.length; i += batchSize) {
    const batch = jsonData.slice(i, i + batchSize);
    
    await db.transaction(async (tx) => {
      for (const edital of batch) {
        try {
          // Verificar se PDF existe
          let pdfPath = null;
          if (edital.pdfSalvoEm) {
            const fullPath = path.join(process.cwd(), edital.pdfSalvoEm);
            if (fs.existsSync(fullPath)) {
              pdfPath = edital.pdfSalvoEm.replace('data/', '');
            }
          }
          
          // Inserir edital
          const novoEdital = await tx.insert(editais).values({
            id: edital.id,
            titulo: edital.titulo,
            orgao: edital.orgao,
            valor: edital.valor,
            valorMin: edital.valorMin,
            valorMax: edital.valorMax,
            dataPublicacao: edital.dataPublicacao,
            dataLimite: edital.dataLimite,
            dataResultado: edital.dataResultado,
            status: edital.status,
            statusAnalise: edital.statusAnalise,
            modalidade: edital.modalidade,
            abrangencia: edital.abrangencia,
            descricao: edital.descricao,
            link: edital.link,
            pdfUrl: edital.pdfUrl,
            pdfPath: pdfPath,
            conteudoCompleto: edital.conteudoCompleto,
            fonteConteudo: edital.fonteConteudo,
            tecnologiaFoco: edital.tecnologiaFoco,
            tipoFerramenta: edital.tipoFerramenta,
            scoreRelevancia: edital.scoreRelevancia,
            scoreConfiancaIa: edital.scoreConfiancaIA,
            validadoPorIa: edital.validadoPorIA ? 1 : 0,
            motivoRejeicao: edital.motivoRejeicao,
            foraDoEscopo: edital.foraDoEscopo ? 1 : 0,
            dataValidacaoIa: edital.dataValidacaoIA,
            scorePontuacao: edital.scorePontuacao,
            nivelPontuacao: edital.nivelPontuacao,
            criadoEm: edital.criadoEm || new Date().toISOString(),
            atualizadoEm: edital.atualizadoEm || new Date().toISOString()
          }).returning();
          
          // Migrar análise IA se existir
          if (edital.analiseIA) {
            const analise = await tx.insert(analiseIa).values({
              editalId: edital.id,
              resumo: edital.analiseIA.resumo,
              objetivo: edital.analiseIA.objetivo,
              elegibilidade: edital.analiseIA.elegibilidade,
              contatoEdital: edital.analiseIA.contatoEdital,
              scoreAdequacao: edital.analiseIA.scoreAdequacao,
            }).returning();
            
            // TODO: Inserir requisitos, itens financiáveis, etc
          }
          
          // Migrar palavras-chave
          if (edital.palavrasChaveEncontradas?.length) {
            for (const palavra of edital.palavrasChaveEncontradas) {
              await tx.insert(palavrasChave).values({
                editalId: edital.id,
                palavra: palavra
              });
            }
          }
          
          migrados++;
        } catch (error) {
          console.error(`Erro ao migrar edital ${edital.id}:`, error);
          erros++;
        }
      }
    });
    
    console.log(`✅ Migrados ${Math.min(i + batchSize, jsonData.length)} de ${jsonData.length}`);
  }
  
  console.log(`\n🎉 Migração concluída!`);
  console.log(`✅ Sucesso: ${migrados}`);
  console.log(`❌ Erros: ${erros}`);
  
  // 4. Criar índice FTS
  console.log('\n🔍 Criando índice de busca full-text...');
  await db.raw(`
    INSERT INTO editais_fts 
    SELECT rowid, titulo, descricao, conteudo_completo, orgao 
    FROM editais
  `);
  
  console.log('✨ Banco de dados SQLite configurado com sucesso!');
}

// Executar
migrate().catch(console.error);
```

### 6.2 Scripts NPM

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate:sqlite",
    "db:push": "drizzle-kit push:sqlite",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx scripts/migrate-to-sqlite.ts",
    "db:backup": "cp data/db/editais.db data/db/editais.db.backup",
    "db:restore": "cp data/db/editais.db.backup data/db/editais.db",
    "db:vacuum": "sqlite3 data/db/editais.db 'VACUUM;'",
    "db:integrity": "tsx scripts/check-integrity.ts"
  }
}
```

## 7. Cronograma de Implementação

### Fase 1: Setup Inicial (4 horas)
- [ ] Instalar dependências
- [ ] Criar estrutura de pastas
- [ ] Configurar Drizzle
- [ ] Criar schema inicial

### Fase 2: Banco de Dados (6 horas)
- [ ] Definir todas as tabelas
- [ ] Criar migrations
- [ ] Configurar FTS5
- [ ] Criar índices e triggers

### Fase 3: Camada de Repositório (6 horas)
- [ ] Implementar base repository
- [ ] Criar CRUD editais
- [ ] Implementar busca FTS
- [ ] Criar repository de análise

### Fase 4: Camada de Serviço (4 horas)
- [ ] Implementar lógica de negócio
- [ ] Criar serviço de arquivos
- [ ] Implementar importação

### Fase 5: API Endpoints (8 horas)
- [ ] Criar todos endpoints CRUD
- [ ] Implementar busca
- [ ] Criar endpoints de arquivo
- [ ] Adicionar validação

### Fase 6: Migração (4 horas)
- [ ] Criar script de migração
- [ ] Testar migração
- [ ] Verificar integridade
- [ ] Criar backups

### Fase 7: Frontend (4 horas)
- [ ] Criar API client
- [ ] Atualizar páginas
- [ ] Testar integração

### Fase 8: Testes e Documentação (4 horas)
- [ ] Testes unitários
- [ ] Testes de integração
- [ ] Documentação API
- [ ] README atualizado

**Total Estimado: 40 horas**

## 8. Considerações de Segurança

1. **Validação de Entrada**: Toda entrada validada com Zod
2. **SQL Injection**: Protegido pelo Drizzle ORM
3. **File Upload**: Validação de tipo e tamanho
4. **Rate Limiting**: Implementado nos endpoints
5. **CORS**: Configurado apropriadamente
6. **Autenticação**: A ser implementada (JWT recomendado)

## 9. Performance

1. **Índices**: Todos campos de busca indexados
2. **FTS5**: Busca full-text otimizada
3. **WAL Mode**: Write-Ahead Logging ativado
4. **Paginação**: Limite máximo de 100 registros
5. **Cache**: Headers de cache apropriados
6. **VACUUM**: Agendado semanalmente

## 10. Monitoramento

1. **Logs**: Winston ou Pino para logging estruturado
2. **Métricas**: Tempo de resposta, uso de memória
3. **Alertas**: Erros críticos, espaço em disco
4. **Backup**: Automático diário
5. **Health Check**: Endpoint de status

## Conclusão

Este planejamento fornece uma base sólida para migrar o sistema atual baseado em JSON para uma arquitetura moderna com SQLite, API RESTful completa e busca full-text. A separação entre frontend e backend através de API garante flexibilidade e escalabilidade futura.

**Principais Benefícios:**
- ✅ Performance otimizada com índices e FTS5
- ✅ Integridade referencial com foreign keys
- ✅ API RESTful completa e documentada
- ✅ Type-safety com TypeScript e Drizzle
- ✅ Gerenciamento inteligente de arquivos
- ✅ Fácil migração para PostgreSQL no futuro

**Próximos Passos:**
1. Aprovar o planejamento
2. Começar implementação pelo setup inicial
3. Seguir cronograma fase por fase
4. Testar cada componente isoladamente
5. Deploy gradual com rollback preparado