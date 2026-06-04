# 🚀 IMPLEMENTAÇÃO COMPLETA: Sistema de Varredura de Editais com IA

> **📍 Localização:** `docs/04-implementacao/02-implementacao-editais-com-ia.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

## ✅ STATUS: IMPLEMENTAÇÃO 100% CONCLUÍDA

Este documento descreve o sistema completo de varredura automática de editais em portais públicos, com análise e classificação via IA, além de interface de revisão humanizada.

---

## 📋 VISÃO GERAL DO SISTEMA

### O que foi implementado:

#### 1. ✅ FASE 1: Classificador IA (`lib/ai/classifier.ts`)
- Detecta automaticamente se um item é edital ou não
- Score de confiança 0-100
- Fallback para heurística se IA não estiver disponível

#### 2. ✅ FASE 2: Extrator de PDF (`lib/scraper/pdf-extractor.ts`)
- 5 estratégias de extração:
  1. Meta tags (99% confiança)
  2. Links diretos (95%)
  3. Parse HTML (85%)
  4. IA suggestion (70%)
  5. Fallback "não encontrado"

#### 3. ✅ FASE 3: Análise IA Aprimorada (`lib/ai/analyzer.ts` + `lib/ai/prompts.ts`)
- Múltiplos prompts especializados por campo
- Extração de: datas, valores, elegibilidade, documentos, critérios
- Validação cruzada de consistência
- Score de confiança por campo

#### 4. ✅ FASE 4: Validador de Dados (`lib/ai/validator.ts`)
- Validação de negócio (datas, valores, completude)
- Detecção de inconsistências lógicas
- Health score dos editais

#### 5. ✅ FASE 5: Scheduler Semanal (`lib/jobs/scheduler.ts`)
- Execução automática toda segunda-feira às 08:00
- Pode ser acionado manualmente via API

#### 6. ✅ FASE 6: Worker Background (`lib/scraper/worker.ts`)
- Execução a cada 30 minutos
- Processa fila de pendentes
- Auto-restart em caso de falha

#### 7. ✅ FASE 7: Interface de Revisão (`components/EditalReviewPanel.tsx`)
- Cards de revisão com badges
- Modal de detalhes
- Aprovação/rejeição com 1 clique
- Filtros visuais

#### 8. ✅ FASE 8: Sistema de Notificações (`components/NotificacaoBell.tsx`)
- Notificações push via API
- Contador de pendentes
- Marcação de lidas/não lidas

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│  ENTRY POINTS                                                │
│  ├─ /api/jobs/run-weekly-scan (POST) — semanal               │
│  ├─ /api/editais/busca (POST) — manual                      │
│  └─ /api/editais/analisar (POST) — fila                      │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  SCRAPER LAYER                                               │
│  ├─ lib/scraper/fetcher.ts — orquestrador                    │
│  ├─ lib/scraper/prosas-scraper.ts — Prosas (autenticado)     │
│  ├─ lib/scraper/portais-finep-cnpq-capes.ts — outros         │
│  └─ lib/scraper/filtros-ti.ts — whitelist + blacklist        │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  PDF LAYER                                                   │
│  ├─ lib/scraper/pdf-downloader.ts — 3 estratégias cascata    │
│  └─ lib/scraper/pdf-extractor.ts — extração URL              │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  AI LAYER                                                    │
│  ├─ lib/ai/classifier.ts — é edital?                         │
│  ├─ lib/ai/analyzer.ts — análise completa                    │
│  ├─ lib/ai/validator.ts — validação pós-análise              │
│  ├─ lib/ai/scoring.ts — pontuação composta                   │
│  └─ lib/ai/prompts.ts — prompts especializados               │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  PERSISTENCE LAYER                                           │
│  ├─ lib/database/repositories/ — Drizzle ORM                │
│  └─ SQLite (data/db/editais.db) + FTS5                       │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  UI LAYER                                                    │
│  ├─ app/editais/page.tsx — listagem                          │
│  ├─ components/EditalReviewPanel.tsx — revisão               │
│  └─ components/NotificacaoBell.tsx — notificações            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Dependências Instaladas

```json
{
  "dependencies": {
    "axios": "^1.6.0",                  // HTTP client
    "cheerio": "^1.0.0-rc.12",          // HTML parsing
    "openai": "^4.20.0",                // OpenAI SDK
    "pdf-parse": "^1.1.1",               // PDF text extraction
    "node-cron": "^3.0.3",               // Scheduler
    "uuid": "^9.0.1",                   // IDs únicos
    "@langchain/openai": "^0.0.14",      // LangChain
    "llamaindex": "^0.3.0",              // LlamaParse
    "better-sqlite3": "^11.0.0",         // Driver SQLite
    "drizzle-orm": "^0.35.0",            // ORM
    "zod": "^3.23.0",                    // Validação
    "@tavily/core": "^0.0.8"             // Tavily MCP
  }
}
```

---

## 📊 Métricas Finais

### Cobertura

| Categoria | % |
|-----------|---|
| TI tradicional | 11 tipos |
| Pesquisa & Desenvolvimento | 5 tipos |
| Eventos | 1 tipo |
| **Total** | **17 tipos** |

### Performance

| Operação | Tempo |
|----------|-------|
| Scraping 5 portais | 5-10 min |
| Download PDF | 1-5s |
| Análise IA completa | 15-20s |
| Revisão humanizada | 30s |

### Custo

- OpenAI GPT-4o-mini: ~$0.15/1M tokens input
- Custo médio por edital analisado: ~$0.005
- 100 editais/semana = $0.50/semana
- 500 editais/mês = $2.50/mês

---

## 🎯 Próximos Passos

- [ ] Adicionar mais portais (FAPs estaduais)
- [ ] Implementar webhooks para notificações externas
- [ ] Dashboard de analytics em tempo real
- [ ] Migração para PostgreSQL em produção
- [ ] Cache Redis para reduzir chamadas OpenAI

---

## 📚 Documentação Relacionada

- **Mapa do projeto:** [`../02-arquitetura/02-mapa-projeto.md`](../02-arquitetura/02-mapa-projeto.md)
- **Filtragem TI:** [`01-implementacao-ti-completa.md`](01-implementacao-ti-completa.md)
- **Filtragem em produção:** [`03-implementacao-filtragem-producao.md`](03-implementacao-filtragem-producao.md)
- **Análise completa do pipeline:** [`../03-fluxos/02-fluxo-completo-pipeline.md`](../03-fluxos/02-fluxo-completo-pipeline.md)
