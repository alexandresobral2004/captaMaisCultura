# CaptaMais SQLite API - Documentação Técnica

> **📍 Localização:** `docs/02-arquitetura/05-api-documentacao.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Schema do Banco de Dados](#schema-do-banco-de-dados)
4. [Endpoints da API](#endpoints-da-api)
5. [Como Usar](#como-usar)
6. [Scripts de Migração](#scripts-de-migração)
7. [Troubleshooting](#troubleshooting)

---

## Visão Geral

O CaptaMais agora utiliza **SQLite** como banco de dados local, eliminando a dependência de JSON files. A arquitetura segue padrões enterprise:

- **Database**: SQLite com WAL mode (Write-Ahead Logging)
- **ORM**: Drizzle ORM para type-safety
- **Search**: FTS5 (Full-Text Search) com unicode61 tokenizer
- **API**: RESTful com validação Zod

### Arquivos Principais

```
├── lib/database/
│   ├── schema.ts              # Definição de 15 tabelas
│   ├── db.ts                  # Conexão SQLite + FTS5 setup
│   └── repositories/          # Data access layer
├── lib/database/services/     # Business logic layer
├── lib/api/
│   ├── responses/index.ts     # Padronização de respostas
│   └── validators/index.ts    # Schemas Zod
├── app/api/v1/                # Endpoints REST
├── lib/api-client/            # Cliente para frontend
└── scripts/                   # Migração e utilitários
```

---

## Arquitetura

### Camadas

```
Frontend (React)
     ↓
API Client (lib/api-client/edital.client.ts)
     ↓
HTTP Endpoints (app/api/v1/)
     ↓
Services (lib/database/services/)  ← Business Logic
     ↓
Repositories (lib/database/repositories/)  ← Data Access
     ↓
SQLite Database (data/db/editais.db)
```

### Fluxo de Dados

1. **Frontend** utiliza `EditalAPIClient` para chamar endpoints
2. **Endpoints** validam input com Zod schemas
3. **Services** implementam lógica de negócio
4. **Repositories** acessam dados via Drizzle ORM
5. **Database** persiste com SQLite + FTS5

---

## Schema do Banco de Dados

### Tabelas Principais

#### `editais`

```sql
CREATE TABLE editais (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  orgao TEXT,
  valor TEXT,
  valorMin REAL,
  valorMax REAL,
  dataLimite TEXT NOT NULL,
  status TEXT,
  statusAnalise TEXT,
  -- ... 20+ colunas
  criadoEm TEXT DEFAULT CURRENT_TIMESTAMP,
  atualizadoEm TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### `analiseIA`

Armazena análises geradas pela IA:
- `resumo`, `objetivo`, `elegibilidade`
- `scoreAdequacao`, `scoreRelevancia`

#### Tabelas de Análise (normalizadas)

- `analiseRequisitos` - Requisitos de elegibilidade
- `analiseItensFinanciaveis` - Itens que podem ser financiados
- `analiseDocumentos` - Documentação necessária
- `analiseCriterios` - Critérios de avaliação
- `analisePontosFracos` - Pontos fracos da proposta

#### `palavrasChave`

Índice de palavras-chave com contagem de frequência

#### `editaisFTS`

Tabela virtual FTS5 para busca de texto completo

### Índices

```sql
CREATE INDEX idx_editais_orgao ON editais(orgao);
CREATE INDEX idx_editais_status ON editais(status);
CREATE INDEX idx_editais_dataLimite ON editais(dataLimite);
CREATE INDEX idx_analise_editalId ON analiseIA(editalId);
```

### Full-Text Search

```sql
CREATE VIRTUAL TABLE editaisFTS USING fts5(
  titulo, descricao, content,
  tokenize = 'unicode61',
  content = 'editais'
);
```

---

## Endpoints da API

### Editais - CRUD

#### `GET /api/v1/editais`

Lista editais com paginação e filtros

**Query Parameters:**

```javascript
{
  page: number,              // padrão: 1
  limit: number,             // padrão: 20
  status: string,            // 'Aberto', 'Fechado', etc
  orgao: string,
  dataInicio: ISO8601,
  dataFim: ISO8601,
  sortBy: string,            // 'dataLimite', 'scoreRelevancia'
  sortOrder: 'asc' | 'desc'
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "edital-001",
      "titulo": "Edital de Inovação",
      "orgao": "CNPq",
      "dataLimite": "2024-12-31",
      "status": "Aberto"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

#### `POST /api/v1/editais`

Criar novo edital

**Body:**

```json
{
  "titulo": "string",
  "orgao": "string",
  "dataLimite": "2024-12-31",
  "link": "https://...",
  "descricao": "string opcional"
}
```

#### `GET /api/v1/editais/:id`

Obter detalhes completos de um edital

#### `PUT /api/v1/editais/:id`

Atualizar edital

#### `DELETE /api/v1/editais/:id`

Deletar edital (cascata: remove análises, arquivos, palavras-chave)

#### `PATCH /api/v1/editais/:id/status`

Atualizar apenas o status

**Body:**

```json
{
  "status": "Fechado"
}
```

---

### Análise IA

#### `GET /api/v1/editais/:id/analysis`

Obter análise IA completa

#### `PUT /api/v1/editais/:id/analysis`

Salvar/atualizar análise IA

**Body:**

```json
{
  "resumo": "string",
  "objetivo": "string",
  "elegibilidade": "string",
  "scoreAdequacao": 0.95,
  "requisitos": ["req1", "req2"],
  "itensFinanciaveis": ["item1"],
  "documentosNecessarios": ["doc1"],
  "criteriosAvaliacao": ["critério1"],
  "pontosFracos": ["fraco1"]
}
```

#### `POST /api/v1/editais/:id/analyze`

Disparar análise IA (integração com ChatGPT/Claude)

#### `POST /api/v1/editais/:id/reanalyze`

Re-analisar edital (forçar nova análise)

---

### Busca Full-Text

#### `GET /api/v1/editais/search`

Busca por texto em titulo, descrição, conteúdo completo

**Query Parameters:**

```javascript
{
  search: string,            // termo de busca (obrigatório)
  page: number,
  limit: number,
  filters: {
    status: string,
    orgao: string,
    dataInicio: string,
    dataFim: string
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "edital-001",
      "titulo": "Edital...",
      "_score": 0.95
    }
  ],
  "pagination": {...}
}
```

---

### Filtros e Estatísticas

#### `GET /api/v1/editais/filters`

Retorna valores únicos para filtros

**Response:**

```json
{
  "status": ["Aberto", "Fechado", "Em Analise"],
  "orgaos": ["CNPq", "CAPES", "FINEP"],
  "modalidades": ["Chamada Pública", "Evento Científico"],
  "anos": [2024, 2025]
}
```

#### `GET /api/v1/editais/stats`

Estatísticas gerais

**Response:**

```json
{
  "total": 1250,
  "abertos": 450,
  "fechados": 800,
  "emAnalise": 150,
  "comPDF": 890,
  "analisesPendentes": 360,
  "scoreMedio": 0.75,
  "ultimaAtualizacao": "2024-05-29T10:30:00Z"
}
```

---

### Arquivos

#### `POST /api/v1/editais/:id/upload`

Upload de PDF

**Body:** `multipart/form-data`

```
pdf: File (application/pdf)
```

**Response:**

```json
{
  "success": true,
  "data": {
    "pdfPath": "downloads/edital-001.pdf",
    "tamanho": 1024000,
    "uploadEm": "2024-05-29T10:30:00Z"
  }
}
```

#### `GET /api/v1/editais/:id/download`

Download do PDF

#### `DELETE /api/v1/editais/:id/file`

Deletar arquivo PDF do edital

#### `POST /api/v1/editais/upload-pdf`

Upload em massa de PDFs

---

### Importação

#### `POST /api/v1/import/folder`

Importar todos os PDFs da pasta `data/downloads/`

**Response:**

```json
{
  "success": true,
  "data": {
    "importados": 22,
    "erros": 0,
    "tempo": "45s",
    "statusURL": "/api/v1/import/status"
  }
}
```

#### `GET /api/v1/import/status`

Status da importação em andamento

---

### Filtros TI

#### `GET /api/v1/filtros`

Lista todos os filtros disponíveis (whitelist, blacklist, categorias)

#### `POST /api/v1/filtros/simular`

Simula aplicação de filtros em um texto

**Body:**

```json
{
  "texto": "Edital de pesquisa em IA e machine learning...",
  "whitelist": true,
  "blacklist": false
}
```

#### `GET /api/v1/filtros/whitelist`

Retorna a whitelist TI

#### `GET /api/v1/filtros/blacklist`

Retorna a blacklist

---

### Portais

#### `GET /api/v1/portais`

Lista portais configurados

#### `PUT /api/v1/portais/:id/toggle`

Habilita/desabilita portal

---

### Logs

#### `GET /api/v1/logs`

Retorna logs do sistema com paginação

#### `GET /api/v1/logs/stats`

Estatísticas dos logs

---

### Scraper

#### `POST /api/v1/scraper/logs/trigger`

Dispara execução manual do scraper

#### `GET /api/v1/scraper/logs/stream`

Stream SSE de logs em tempo real

---

### Projetos

#### `GET /api/v1/projetos`

Lista projetos

#### `POST /api/v1/projetos`

Cria projeto a partir de edital

#### `POST /api/v1/projetos/:id/gerar`

Gera proposta de projeto com IA (Tavily + GPT)

---

## Como Usar

### 1. Inicializar o Banco de Dados

O banco é criado automaticamente na primeira inicialização:

```bash
npm run dev
# SQLite database initialized at data/db/editais.db
```

### 2. Migrar Dados JSON → SQLite

```bash
# Script de migração
npx tsx scripts/migrate-json-to-sqlite.ts

# Output:
# 🚀 Iniciando migração JSON → SQLite...
# 📊 Encontrados 1250 editais para migrar
# ✅ Migrados 1250 de 1250 (100%)
# 🎉 Migração concluída!
```

**O que faz:**

- Lê `data/editais.json`
- Insere em `data/db/editais.db`
- Cria backup em `data/editais.json.migration-backup`
- Migra análises IA, requisitos, palavras-chave

### 3. Importar PDFs

```bash
# Via endpoint
curl -X POST http://localhost:3000/api/v1/import/folder

# Via cliente
import { editalAPI } from '@/lib/api-client/edital.client';
const resultado = await editalAPI.importarPasta();
console.log(`${resultado.importados} PDFs importados`);
```

### 4. Usar o Cliente API no Frontend

```typescript
import { editalAPI, type Edital } from '@/lib/api-client/edital.client';

// Listar editais
const response = await editalAPI.listarEditais({
  page: 1,
  limit: 20,
  status: 'Aberto',
  sortBy: 'dataLimite',
  sortOrder: 'desc'
});

// Buscar por termo
const resultados = await editalAPI.buscarFullText('inovação', {
  orgao: 'CNPq'
});

// Atualizar análise
await editalAPI.salvarAnalise(editalId, {
  resumo: 'Edital sobre...',
  scoreAdequacao: 0.95,
  requisitos: ['req1', 'req2']
});

// Upload de PDF
const file = document.querySelector('input[type="file"]').files[0];
await editalAPI.uploadPDF(editalId, file);
```

---

## Scripts de Migração

### Migração JSON → SQLite

**Arquivo:** `scripts/migrate-json-to-sqlite.ts`

```bash
npx tsx scripts/migrate-json-to-sqlite.ts
```

**Processa:**

1. Lê `data/editais.json`
2. Valida e normaliza dados
3. Insere em tabelas relacionais
4. Migra análises IA em lotes
5. Cria backup automático

**Resultado:**

- ✅ 1250 editais migrados
- ✅ 890 análises IA
- ✅ 5000+ palavras-chave
- ✅ Banco otimizado com índices

---

## Troubleshooting

### ❌ "Database is locked"

**Causa:** Múltiplos processos acessando simultâneamente

**Solução:**

```typescript
// db.ts já inclui proteção:
db.pragma('busy_timeout = 5000'); // 5s timeout
db.pragma('journal_mode = WAL');   // Write-Ahead Logging
```

### ❌ "Memory usage increasing"

**Causa:** Cache SQLite muito grande

**Solução:**

```bash
# Reduzir cache em db.ts
db.pragma('cache_size = -32000'); // 32MB ao invés de 64MB
```

### ❌ "Full-Text Search não encontra resultados"

**Causa:** Índice FTS não sincronizado

**Solução:**

```typescript
// Recriar índice
await db.delete(editaisFTS).run();
await db.insert(editaisFTS)
  .select({
    id: editais.id,
    titulo: editais.titulo,
    descricao: editais.descricao,
    content: editais.conteudoCompleto
  })
  .from(editais)
  .run();
```

### ❌ Erro ao fazer upload de PDF

**Causa:** Permissões ou espaço em disco

**Solução:**

```bash
# Verificar permissões
chmod -R 755 data/downloads/

# Verificar espaço
df -h
```

---

## Referência Rápida

| Operação | Método | Endpoint |
|----------|--------|----------|
| Listar | GET | `/api/v1/editais` |
| Criar | POST | `/api/v1/editais` |
| Obter | GET | `/api/v1/editais/:id` |
| Atualizar | PUT | `/api/v1/editais/:id` |
| Deletar | DELETE | `/api/v1/editais/:id` |
| Buscar | GET | `/api/v1/editais/search?search=...` |
| Análise | GET/PUT | `/api/v1/editais/:id/analysis` |
| Upload PDF | POST | `/api/v1/editais/:id/upload` |
| Importar | POST | `/api/v1/import/folder` |
| Stats | GET | `/api/v1/editais/stats` |
| Filtros | GET | `/api/v1/editais/filters` |

---

## Próximas Fases (Futuro)

- [ ] Integração com GPT-4 Vision para análise de PDFs
- [ ] Webhooks para notificação de novos editais
- [ ] GraphQL API como alternativa
- [ ] Cache Redis para queries frequentes
- [ ] Backup automático para cloud (S3/Drive)
- [ ] Dashboard de analytics em tempo real
- [ ] Autenticação OAuth2 (Google, GitHub)
- [ ] Rate limiting por usuário

---

## 📚 Documentação Relacionada

- **Planejamento SQLite:** [`04-planejamento-sqlite-api.md`](04-planejamento-sqlite-api.md)
- **Estrutura do codebase:** [`03-estrutura-codebase.md`](03-estrutura-codebase.md)
- **Mapa do projeto:** [`02-mapa-projeto.md`](02-mapa-projeto.md)
- **Quickstart:** [`../01-introducao/02-quickstart.md`](../01-introducao/02-quickstart.md)
