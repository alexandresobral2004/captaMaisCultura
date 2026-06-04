# RESUMO DA EXPLORAÇÃO DO CODEBASE - CaptaMais

> **📍 Localização:** `docs/09-guias-referencias/03-resumo-exploracao.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

## Visão Geral

O **CaptaMais** é uma aplicação full-stack em Next.js/TypeScript que busca, analisa e cataloga editais de financiamento usando IA (GPT-4) com web scraping automático e agendamento de tarefas.

---

## 1. ARQUITETURA DO PROJETO

### Stack Tecnológico
- **Frontend**: React 18 + TypeScript + Next.js 14 (App Router)
- **Backend**: Next.js API Routes
- **Banco de Dados**: SQLite (`data/db/editais.db`) + Drizzle ORM
- **IA**: OpenAI GPT-4o-mini
- **Web Scraping**: Axios + Cheerio
- **PDF Processing**: pdf-parse + LlamaParse
- **Agendamento**: node-cron
- **Arquitetura**: Client-Server com background workers

### Estrutura de Diretórios
```
lib/
├── scraper/           → Web scraping, PDF download, extração de texto
├── ai/                → Análise com IA, prompts, validação, cache
├── database/          → Camada de dados (Drizzle ORM)
└── jobs/              → Agendamento cron

app/
├── api/editais/       → Rotas de busca, análise, CRUD
├── api/jobs/          → Rotas de agendamento
├── api/v1/            → API versionada (SQLite)
└── editais/page.tsx   → Página principal (UI)
```

---

## 2. PÁGINA DE EDITAIS - LOCALIZAÇÃO E FUNCIONALIDADE

### Arquivo Principal
- **Caminho**: `app/editais/page.tsx`
- **Tipo**: Client Component (React)

### Funcionalidades
- Listagem de editais com paginação
- Filtros: status, tipo, área, data
- Busca por palavra-chave
- Modal de detalhes com análise IA
- Ações em lote (aprovar/rejeitar)

---

## 3. BOTÃO "DISPARAR BUSCA INTELIGENTE"

### Localização
`app/editais/page.tsx` (componente client-side)

### Funcionamento
1. Chama `POST /api/editais/busca`
2. Aguarda retorno com estatísticas
3. Atualiza lista automaticamente
4. Mostra feedback visual (spinner)

---

## 4. SISTEMA DE SCRAPING

### 5 Portais Suportados
1. **Prosas** — autenticado (OAuth2 + sessão)
2. **FINEP** — RSS feed
3. **CNPq** — HTML scraping
4. **CAPES** — HTML scraping
5. **Ministério da Ciência** — HTML scraping

### Função Orquestradora
`lib/scraper/fetcher.ts:buscarEditaisPortais()`

### Retorno
- Array de `Edital[]` com 15+ campos
- Estatísticas por portal
- Tempo de execução

---

## 5. DOWNLOAD E PROCESSAMENTO DE PDF

### 3 Estratégias de Cascata
1. **PDF S3** (60% sucesso) — URLs pré-assinadas
2. **Link Externo** (30% sucesso) — PDF direto ou página web
3. **HTML da API** (10% sucesso) — fallback de texto

### Validação com Keywords
- 200+ termos em 8 categorias
- Score 0-100 baseado em densidade
- Threshold: 5+ keywords = aprovado

---

## 6. ANÁLISE COM IA

### Modelo
- **gpt-4o-mini** (custo/benefício ótimo)
- **Temperature**: 0.1 (determinístico)
- **Max tokens**: 60.000 caracteres

### 7 Prompts Especializados
1. Datas (publicação, abertura, limite, resultado)
2. Valores (min, max, moeda, unidade)
3. Elegibilidade (tipos, requisitos, restrições)
4. Documentos (obrigatórios, opcionais, técnicos)
5. Critérios de avaliação
6. Resumo executivo
7. Validação de consistência

### Validação Pós-Análise
- Datas (sequência temporal)
- Valores (min < max, não negativos)
- Completude (campos obrigatórios)
- Coerência (sem contradições)

---

## 7. AGENDAMENTO E AUTOMAÇÃO

### Worker Background
- Inicia 15s após boot do servidor
- Executa a cada 30 minutos
- Processa fila de pendentes

### Cron Job
- **Expressão**: `0 8 * * 1` (segunda 08:00)
- **Rota**: `POST /api/jobs/run-weekly-scan`
- **Setup**: `scripts/setup-cron.sh`

### Disparo Manual
- `POST /api/editais/busca` — busca imediata
- `POST /api/jobs/run-weekly-scan` — varredura completa

---

## 8. BANCO DE DADOS

### Migração para SQLite (v2.9+)
- **Antes**: JSON em arquivo `editais.json`
- **Depois**: SQLite + Drizzle ORM + FTS5

### Tabelas Principais (15)
- `editais` — tabela principal
- `analise_ia` — análises geradas
- `analise_requisitos` — requisitos
- `analise_itens_financiaveis` — itens financiáveis
- `analise_documentos` — documentos necessários
- `analise_criterios` — critérios de avaliação
- `analise_pontos_fracos` — pontos fracos
- `palavras_chave` — keywords encontradas
- `arquivos_anexos` — anexos do edital
- `motivos_pontuacao` — motivos de scoring
- `usuarios` — usuários do sistema
- `projetos` — projetos aprovados
- `areas_tematicas` — áreas disponíveis
- `tipos_proponente` — tipos de proponentes

### Endpoints v1
- `GET /api/v1/editais` — listar
- `POST /api/v1/editais` — criar
- `GET /api/v1/editais/:id` — detalhes
- `PUT /api/v1/editais/:id` — atualizar
- `DELETE /api/v1/editais/:id` — deletar
- `GET /api/v1/editais/search` — busca FTS
- `POST /api/v1/editais/:id/analyze` — análise IA
- `GET /api/v1/editais/:id/analysis` — obter análise

---

## 9. PONTOS DE OTIMIZAÇÃO IDENTIFICADOS

### Quick Wins
- Cache de classificação (30 dias)
- Skip OpenAI se whitelist > 90%
- Skip portais pré-validados

### Medium Impact
- Combinar 7 chamadas em 3 paralelas
- Sumarizar PDFs > 30K chars

### High Impact
- Skip análise para confidence < 50%
- Batch API para classificação

**Potencial de redução:** 71% (~2.1M → 0.6M tokens/semana)

---

## 10. CONCLUSÕES

### Pontos Fortes
- ✅ Arquitetura bem estruturada
- ✅ Pipeline modular e testável
- ✅ Múltiplas estratégias de fallback
- ✅ Boa cobertura de portais brasileiros

### Pontos de Atenção
- ⚠️ Alto consumo de tokens (2.1M/semana)
- ⚠️ Processamento sequencial de detalhes
- ⚠️ Sem cache persistente de classificações
- ⚠️ Blacklist desativada (decisão consciente)

### Recomendações
1. Implementar as otimizações de tokens
2. Adicionar testes E2E
3. Migrar para PostgreSQL em produção
4. Adicionar dashboard de analytics

---

## 📚 Documentação Relacionada

- **Mapa do projeto:** [`../02-arquitetura/02-mapa-projeto.md`](../02-arquitetura/02-mapa-projeto.md)
- **Architecture Summary (EN):** [`../02-arquitetura/01-architecture-summary.md`](../02-arquitetura/01-architecture-summary.md)
- **Token Waste Analysis:** [`../08-testes-analise/03-token-waste-analysis.md`](../08-testes-analise/03-token-waste-analysis.md)
- **Quick Reference:** [`../01-introducao/03-quick-reference.md`](../01-introducao/03-quick-reference.md)
- **README Exploration (EN):** [`02-readme-exploracao.md`](02-readme-exploracao.md)
- **Exploration Summary (EN):** [`04-exploration-summary.md`](04-exploration-summary.md)
