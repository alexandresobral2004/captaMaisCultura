# RESUMO DA EXPLORAÇÃO DO CODEBASE - CaptaMais

## Visão Geral
O **CaptaMais** é uma aplicação full-stack em Next.js/TypeScript que busca, analisa e cataloga editais de financiamento usando IA (GPT-4) com web scraping automático e agendamento de tarefas.

---

## 1. ARQUITETURA DO PROJETO

### Stack Tecnológico
- **Frontend**: React 18 + TypeScript + Next.js 14 (App Router)
- **Backend**: Next.js API Routes
- **Banco de Dados**: JSON em arquivo (`/data/editais.json`)
- **IA**: OpenAI GPT-4o-mini
- **Web Scraping**: Axios + Cheerio
- **PDF Processing**: pdf-parse
- **Agendamento**: node-cron
- **Arquitetura**: Client-Server com background workers

### Estrutura de Diretórios
```
lib/
├── scraper/           → Web scraping, PDF download, extração de texto
├── ai/                → Análise com IA, prompts, validação, cache
├── db/                → Camada de dados (CRUD, persistência JSON)
└── jobs/              → Agendamento cron

app/
├── api/editais/       → Rotas de busca, análise, CRUD
├── api/jobs/          → Rotas de agendamento
└── editais/page.tsx   → Página principal (UI)
```

---

## 2. PÁGINA DE EDITAIS - LOCALIZAÇÃO E FUNCIONALIDADE

### Arquivo Principal
- **Caminho**: `/Users/alexandrerocha/captaMais/app/editais/page.tsx`
- **Tipo**: Client Component (React)
- **Tamanho**: 818 linhas

### Funcionalidades Principais
1. **Grid de Editais**: Exibe cards com informações resumidas
2. **Filtros Avançados**:
   - Busca por keyword
   - Área temática (Saúde, Educação, Cultura, Infraestrutura, Esporte)
   - Tipo de instituição (Federal, Estadual, ONG, Universidade)
   - Tipo de edital (Evento, TI, Pesquisa)
   - Ordenação (Recentes/Antigos)

3. **Status Visual**: Badges mostrando `Pendente`, `✨ IA (85%)`, `Erro`, etc
4. **Modal de Detalhes**: Mostra análise IA completa com:
   - Visão geral do edital
   - Elegibilidade/Quem pode participar
   - Requisitos obrigatórios
   - Itens financiáveis
   - Pontos de atenção/alertas

---

## 3. BOTÃO "DISPARAR BUSCA INTELIGENTE"

### Localização
**Arquivo**: `app/editais/page.tsx:290`

### Comportamento
```
CLICK → POST /api/editais/busca → Busca em portais → Download PDFs
    → Pontuação → Salva no banco (status='pendente') → Atualiza UI
```

### Propriedades
- Texto dinâmico: "Disparar Busca Inteligente" (inativo) / "Buscando & Analisando IA..." (ativo)
- Desabilita durante busca (feedback visual)
- Spinner animado enquanto busca

---

## 4. FLUXO COMPLETO DE BUSCA DE EDITAIS

### Arquivo Principal
`/Users/alexandrerocha/captaMais/app/api/editais/busca/route.ts`

### Etapas

#### 4.1 Busca em Portais (lib/scraper/fetcher.ts)
```
buscarEditaisPortais()
├─ Portal Prosas (autenticado com email/senha)
├─ FINEP (RSS)
├─ CNPq (HTML scraping)
├─ CAPES (RSS)
└─ Ministério da Ciência
```

#### 4.2 Download de PDFs (lib/scraper/pdf-downloader.ts)
```
baixarELerPDFEdital()
├─ Estratégia 1: URL S3 pré-assinada
├─ Estratégia 2: Link externo do edital
└─ Estratégia 3: Extração de HTML (fallback)

Salva em: /data/downloads/{data}-{orgao}-{score}.pdf
```

#### 4.3 Cálculo de Pontuação (lib/ai/scoring.ts)
```
calcularPontuacaoEdital()
├─ Whitelist TI (palavras-chave técnicas)
├─ Blacklist (termos bloqueados)
├─ Qualidade do PDF
└─ Portal confiável?

Score final: 0-100
```

#### 4.4 Armazenamento (lib/db/editais-store.ts)
```
saveEdital()
├─ Salva em: /data/editais.json
├─ Status inicial: 'pendente'
├─ Cria manifest em: /data/downloads/manifest.json
└─ Timestamps: criadoEm, atualizadoEm
```

---

## 5. AGENDAMENTO E BACKGROUND WORKER

### Scheduler (Cron Job)
**Arquivo**: `lib/jobs/scheduler.ts`

```
Expressão Cron: '0 8 * * 1'  (Segunda-feira às 08:00)
  └─ Executa: POST /api/jobs/run-weekly-scan
```

### Execução Automática
**Arquivo**: `lib/scraper/worker.ts` (chamado via `lib/db/editais-store.ts`)

```
Timeline:
- Ao iniciar (+ 15 segundos)
- A cada 30 minutos (intervalo)
- Semanal via cron (segunda 08:00)

Ciclo:
1. buscarEditaisPortais()     → Novos editais
2. processarFilaDeEditais()   → Análise dos pendentes
3. Log de estatísticas
```

### Pipeline de Análise (lib/scraper/pipeline.ts)

#### processarEditalUnico(edital)
```
1. Verificar se está fora do escopo TI
2. Tentar baixar PDF (3 estratégias)
   └─ Marca como 'pdf_baixado'
3. Aguardar 3s (rate limiting)
4. Chamar analisarEditalComIA()
5. Salvar resultado ('analisado' ou 'erro')
```

#### processarFilaDeEditais()
```
1. Buscar todos com statusAnalise='pendente'
2. Processar sequencialmente
3. Aguardar 5s entre editais
4. Log completo
```

---

## 6. BUSCA E FILTRAGEM DE PDFs

### Extração de PDFs
**Arquivo**: `lib/scraper/pdf-downloader.ts`

```typescript
extrairUrlPDF(htmlContent, baseUrl) {
  // 5 estratégias de busca:
  1. Links <a href="...pdf">
  2. Atributos data-href
  3. Padrões em strings
  4. iframes
  5. Links indiretos via javascript
}

extrairTextoHtml(url) {
  // Remove scripts, styles, nav, footer
  // Retorna texto limpo para análise IA
}

limparHtmlParaTexto(html) {
  // Remove tags HTML
  // Normaliza espaços
  // Converte HTML entities
}
```

### Validação de Conteúdo
**Arquivo**: `lib/scraper/keyword-validator.ts`

```
validarConteudoComKeywords():
├─ Termos mandatórios (edital, chamada, etc)
├─ Termos acadêmicos (pesquisa, bolsa, etc)
├─ Termos de financiamento
├─ Termos de elegibilidade
├─ Termos de submissão
├─ Termos de avaliação
├─ Termos de timeline
└─ Blacklist (rejeição)

Resultado: aprovado | rejeitado | em_analise
```

---

## 7. ESTRUTURA DO BANCO DE DADOS

### Localização
`/Users/alexandrerocha/captaMais/data/editais.json`

### Schema (Interface Edital)
```typescript
interface Edital {
  // Identificação
  id: string                        // UUID
  titulo: string
  orgao: string
  
  // Financeiro
  valor: string
  valorMin?: number
  valorMax?: number
  
  // Datas
  dataPublicacao?: string
  dataLimite: string               // DD/MM/YYYY
  dataResultado?: string
  
  // Classificação
  status: 'Aberto' | 'Prorrogado' | 'Em Análise' | 'Fechado'
  modalidade?: string
  areasTematicas?: string[]
  abrangencia?: string
  tipoProponente?: string[]
  
  // Conteúdo
  descricao: string
  link: string
  pdfUrl?: string
  pdfSalvoEm?: string              // Caminho relativo
  
  // Análise IA
  analiseIA?: {
    resumo: string
    objetivo: string
    requisitos: string[]
    elegibilidade: string
    itensFinanciáveis: string[]
    documentosNecessarios: string[]
    criteriosAvaliacao: string[]
    contatoEdital?: string
    pontosFracos?: string[]
    scoreAdequacao?: number         // 0-100
  }
  
  // Status
  statusAnalise?: 'pendente' | 'pdf_baixado' | 'analisado' 
                  | 'sem_pdf' | 'descartado' | 'erro'
  fonteConteudo?: 'pdf_s3' | 'pdf_link' | 'html_link' 
                   | 'descricao_api' | 'mock' | 'sem_pdf'
  
  // Pontuação
  scorePontuacao?: number          // 0-100
  nivelPontuacao?: 'baixo' | 'medio' | 'alto'
  scoreValidacaoKeywords?: number
  
  // Timestamps
  criadoEm: string                 // ISO
  atualizadoEm?: string
  ultimaAnalise?: Date
  validadoManualmente?: boolean
  
  // Filtro TI
  tecnologiaFoco?: string          // Software, Cloud, ML, etc
  palavrasChaveEncontradas?: string[]
  foraDoEscopo?: boolean
  
  // ... mais 20+ campos para histórico, confiança, validação
}
```

### Funções Principais (lib/db/editais-store.ts)
```typescript
getAllEditais(incluirFechados?: boolean)     // Leitura com filtro
saveEdital(edital: Partial<Edital>)          // Insert/Update
deleteEdital(id: string)                     // Delete
salvarValidacaoKeywords(editalId, result)    // Update validação
parseDateString(dateStr: string)             // DD/MM/YYYY → Date
```

---

## 8. ANÁLISE COM IA

### Função Principal
**Arquivo**: `lib/ai/analyzer.ts`

```typescript
async analisarEditalComIA(
  editalId: string,
  textoCompleto: string,
  options?: { modo: 'completo' | 'simplificado' }
): Promise<Edital | null>
```

### Modos de Análise

#### Modo COMPLETO (paralelo)
```
Prompt 1: promptAnaliseFinanceiraEDatas()
  └─ Extrai: dataPublicacao, dataLimite, valorMin, valorMax

Prompt 2: promptAnaliseElegibilidadeEDocumentos()
  └─ Extrai: tiposProponentes, requisitos, documentos

Prompt 3: promptAnaliseResumoECriterios()
  └─ Extrai: resumo, objetivo, criterios, alertas

Compilar resultado final com confiança por campo
```

#### Modo SIMPLIFICADO
```
1 Prompt: promptAnaliseSimplificada()
  └─ Rápido, menos tokens, sem validação paralela
```

### Prompts Especializados
**Arquivo**: `lib/ai/prompts.ts` (9 prompts)

1. `promptExtrairDatas()`
2. `promptExtrairValores()`
3. `promptExtrairElegibilidade()`
4. `promptExtrairDocumentos()`
5. `promptExtrairRequisitos()`
6. `promptAnaliseFinanceiraEDatas()`
7. `promptAnaliseElegibilidadeEDocumentos()`
8. `promptAnaliseResumoECriterios()`
9. `promptAnaliseSimplificada()`

### Validação
**Arquivo**: `lib/ai/validator.ts`
- Valida campos extraídos
- Detecta inconsistências
- Registra confiança (0-100) por campo

### Cache de Classificação
**Arquivo**: `lib/ai/classification-cache.ts`
- Hash de conteúdo como chave
- Reduz chamadas à OpenAI
- Melhora performance

---

## 9. ROTAS API

| Rota | Método | Função |
|------|--------|--------|
| `/api/editais` | GET | Listar editais (abertos por padrão) |
| `/api/editais` | POST | Criar novo edital |
| `/api/editais/busca` | POST | Buscar em portais + download |
| `/api/editais/analisar` | POST | Analisar individual ou fila |
| `/api/editais/revisar` | POST | Revisão manual |
| `/api/editais/notificar` | POST | Notificações |
| `/api/editais/deletar` | DELETE | Remover edital |
| `/api/jobs/run-weekly-scan` | POST | Varredura semanal |

---

## 10. ESTRUTURA DE ARQUIVOS-CHAVE

| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| **Frontend** |
| `app/editais/page.tsx` | 818 | UI principal, filtros, grid |
| **API/Rotas** |
| `app/api/editais/busca/route.ts` | 208 | Busca em portais + download |
| `app/api/editais/analisar/route.ts` | 40 | Análise IA |
| `app/api/editais/route.ts` | 31 | CRUD básico |
| **Scraping** |
| `lib/scraper/fetcher.ts` | 155 | Busca em múltiplos portais |
| `lib/scraper/prosas-scraper.ts` | 456 | Scraper Prosas autenticado |
| `lib/scraper/pdf-downloader.ts` | 462 | Download e extração PDF |
| `lib/scraper/pipeline.ts` | 107 | Pipeline de processamento |
| `lib/scraper/keyword-validator.ts` | ? | Validação com keywords |
| **IA/Análise** |
| `lib/ai/analyzer.ts` | 228 | Análise com GPT-4 |
| `lib/ai/prompts.ts` | 343 | Prompts especializados |
| `lib/ai/scoring.ts` | 158 | Cálculo de pontuação |
| `lib/ai/validator.ts` | ? | Validação de campos |
| `lib/ai/classifier.ts` | ? | Classificação |
| `lib/ai/classification-cache.ts` | ? | Cache de resultados |
| **Banco de Dados** |
| `lib/db/editais-store.ts` | 320 | CRUD e persistência |
| **Agendamento** |
| `lib/jobs/scheduler.ts` | 82 | Cron job semanal |
| `lib/scraper/worker.ts` | 27 | Worker em background |

---

## 11. VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```bash
# OpenAI
OPENAI_API_KEY=sk-...                    # Chave da API OpenAI
OPENAI_MODEL=gpt-4o-mini                 # Modelo padrão

# Prosas (autenticação)
PROSAS_EMAIL=seu_email@exemplo.com       # Email
PROSAS_PASSWORD=sua_senha                # Senha

# Agendamento
SCAN_TOKEN=token_opcional                # Token de segurança
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # URL base da app

# Dados
DATA_DIR=./data                          # Diretório de dados
```

---

## 12. FLUXO VISUAL COMPLETO

```
┌─ USUÁRIO CLICA "Disparar Busca Inteligente" ─┐
│                                               │
├─→ POST /api/editais/busca                   │
│   ├─ buscarEditaisPortais()                  │
│   │  └─ Prosas, FINEP, CNPq, CAPES, MinC    │
│   ├─ Para cada edital:                       │
│   │  ├─ baixarELerPDFEdital()                │
│   │  │  └─ S3 > Link > HTML fallback         │
│   │  ├─ calcularPontuacaoEdital()            │
│   │  └─ saveEdital(status='pendente')        │
│   └─ Retorna lista + estatísticas            │
│                                               │
├─→ UI atualiza com novos editais              │
│   (Badges: "Pendente", "Analisar" button)    │
│                                               │
├─ USUÁRIO CLICA "Analisar" OU BACKGROUND ────┤
│                                               │
├─→ POST /api/editais/analisar?id=...          │
│   ├─ processarEditalUnico()                  │
│   │  ├─ Verifica escopo TI                   │
│   │  ├─ Baixa PDF (se necessário)            │
│   │  ├─ Aguarda 3s (rate limit)              │
│   │  └─ analisarEditalComIA()                │
│   │     ├─ 3 prompts paralelos               │
│   │     ├─ Extrai datas, valores, docs      │
│   │     ├─ Calcula confiança por campo      │
│   │     └─ Salva resultado                   │
│   └─ Retorna edital analisado                │
│                                               │
├─→ UI atualiza com resultado                  │
│   (Badge: "✨ IA (85%)", "Ver Catálogo IA") │
│                                               │
└─→ Modal com análise completa ao clicar ─────┘
   ├─ Visão geral + Objetivo
   ├─ Elegibilidade + Abrangência
   ├─ Requisitos obrigatórios
   ├─ Itens financiáveis
   └─ Pontos de atenção/alertas
```

---

## 13. RESUMO EXECUTIVO

### O Que o CaptaMais Faz

1. **Busca Inteligente**: Procura editais em 5 portais brasileiros (Prosas, FINEP, CNPq, CAPES, MinC)
2. **Download Automático**: Baixa PDFs com 3 estratégias (S3 > Link > HTML)
3. **Análise com IA**: Usa GPT-4 para extrair estrutura dos editais
4. **Catalogo Organizado**: Armazena em JSON com 50+ campos de metadados
5. **Filtros Avançados**: Busca por área, tipo de instituição, tipo de edital
6. **Agendamento**: Varredura automática semanal + background worker a cada 30 min
7. **Status Visual**: Interface moderna com badges de progresso e análise

### Arquitetura
- **Frontend**: React/TypeScript com Next.js
- **Backend**: API Routes do Next.js
- **Dados**: JSON em arquivo (escalável para DB real)
- **IA**: OpenAI GPT-4o-mini
- **Web Scraping**: Axios + Cheerio
- **Agendamento**: node-cron

### Performance
- Busca: ~3-5 minutos (5 portais + download PDFs)
- Análise por edital: ~10-20 segundos (3 prompts paralelos)
- Background worker: A cada 30 minutos
- Rate limiting: 3s entre PDFs, 5s entre análises

---

## Arquivo de Documentação Completa

Para análise detalhada, ver:
📄 `/Users/alexandrerocha/captaMais/ESTRUTURA_CODEBASE_ANALISE.md`

Este arquivo contém:
- Detalhes de cada função
- Schemas completos de dados
- Todos os 12 prompts de IA
- Fluxo passo-a-passo
- Configurações completas
- Exemplos de uso

