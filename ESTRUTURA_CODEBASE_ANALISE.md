# Análise Completa do Codebase - CaptaMais

## 1. ESTRUTURA GERAL DO PROJETO

### Framework e Arquitetura
- **Framework Principal**: Next.js 14 (Framework React fullstack)
- **Linguagem**: TypeScript
- **Tipo de Projeto**: Full-stack web application (Frontend + Backend)
- **Principais Dependências**:
  - `axios` - HTTP client para requisições
  - `cheerio` - Web scraping de HTML
  - `next` - Framework Next.js
  - `node-cron` - Agendamento de tarefas
  - `openai` - Integração com GPT/IA
  - `pdf-parse` - Leitura e análise de PDFs
  - `uuid` - Geração de IDs únicos

### Diretórios Principais
```
/captaMais/
├── app/                          # Rotas e páginas Next.js (App Router)
│   ├── api/                      # API endpoints (backend)
│   │   ├── editais/              # Rotas de operações com editais
│   │   ├── jobs/                 # Rotas de agendamento
│   │   └── teste/                # Rotas de teste
│   ├── editais/                  # Página principal de editais
│   ├── dashboard/                # Dashboard
│   └── ...outras páginas
├── components/                   # Componentes React reutilizáveis
│   ├── layout/                   # Componentes de layout
│   └── ui/                       # Componentes UI básicos
├── lib/                          # Lógica de negócio (biblioteca interna)
│   ├── scraper/                  # Web scraping e busca de editais
│   ├── ai/                       # Lógica de IA e análise
│   ├── db/                       # Camada de banco de dados
│   └── jobs/                     # Agendamento de tarefas
├── data/                         # Dados persistidos (JSON)
│   ├── editais.json              # Banco de dados de editais
│   ├── downloads/                # PDFs baixados
│   ├── portais-config.json       # Configuração de portais
│   └── prosas-session.json       # Sessão autenticada Prosas
├── styles/                       # Estilos CSS/SCSS
├── scripts/                      # Scripts auxiliares
└── logs/                         # Arquivos de log
```

---

## 2. PÁGINA/COMPONENTE DE "EDITAIS"

### Localização Principal
**Arquivo**: `/Users/alexandrerocha/captaMais/app/editais/page.tsx` (818 linhas)

### Características
- Componente client-side completo (`'use client'`)
- Funcionalidade: Exploração de editais com filtros avançados
- Integra análise IA com interface visual intuitiva

### Estrutura do Componente
```typescript
Interface Edital {
  id: string
  titulo: string
  orgao: string
  valor: string
  dataLimite: string
  status: 'Aberto' | 'Prorrogado' | 'Em Análise' | 'Fechado'
  descricao: string
  link: string
  analiseIA?: { resumo, objetivo, requisitos, elegibilidade, ... }
  statusAnalise?: 'pendente' | 'pdf_baixado' | 'analisado' | 'sem_pdf' | 'descartado' | 'erro'
  // ... mais 20+ campos de análise e classificação
}
```

### Funcionalidades Principales
1. **Busca e Filtros**:
   - Busca por palavra-chave
   - Filtro por área de interesse (Saúde, Educação, Cultura, Infraestrutura, Esporte)
   - Filtro por tipo de instituição (Federal, Estadual, ONG, Universidade)
   - Filtro por tipo de edital (Evento, TI, Pesquisa)
   - Ordenação (Recentes/Antigos)

2. **Grid de Visualização**:
   - Cards com informações resumidas
   - Status visual com badges
   - Score de compatibilidade IA

3. **Modal de Detalhes**:
   - Análise completa de cada edital
   - Requisitos obrigatórios
   - Itens financiáveis
   - Pontos de atenção
   - Link para portal oficial

---

## 3. BOTÃO "DISPARAR BUSCA INTELIGENTE"

### Localização
**Arquivo**: `/Users/alexandrerocha/captaMais/app/editais/page.tsx:290`

```typescript
<Button 
  onClick={handleBuscarEditais} 
  disabled={searching}
  style={{ background: 'linear-gradient(135deg, var(--color-primary), #4f46e5)' }}
>
  <RefreshCw className={searching ? "animate-spin" : ""} />
  {searching ? 'Buscando & Analisando IA...' : 'Disparar Busca Inteligente'}
</Button>
```

### Funcionamento
1. Desativa o botão enquanto está buscando
2. Chama a API `/api/editais/busca` com método POST
3. Atualiza a lista de editais após conclusão
4. Exibe feedback visual (spinner animado)

---

## 4. FUNCIONALIDADE ATUAL DE BUSCA DE EDITAIS

### Fluxo Completo de Busca
**Arquivo Principal**: `/Users/alexandrerocha/captaMais/app/api/editais/busca/route.ts` (208 linhas)

#### Etapas do Processo:
1. **Busca em Portais** (via `buscarEditaisPortais()`)
   - Portal Prosas (autenticado via sessão)
   - Captura editais TI e de inovação
   - Retorna array de editais brutos

2. **Download de PDFs** (via `baixarELerPDFEdital()`)
   - Estratégia 1: URL pré-assinada S3
   - Estratégia 2: Link externo do edital
   - Estratégia 3: Extração de HTML (fallback)
   - Salva PDFs em `/data/downloads/`

3. **Cálculo de Pontuação** (via `calcularPontuacaoEdital()`)
   - Valida contra whitelist TI
   - Valida contra blacklist
   - Verifica qualidade do PDF
   - Score final 0-100

4. **Armazenamento**
   - Salva no banco (`/data/editais.json`)
   - Status inicial: `pendente` (aguardando análise manual)
   - Cria manifest de downloads

### Portais Disponíveis
- **Prosas**: Portal de chamadas públicas (autenticado)
- **FINEP**: Chamadas Públicas
- **CNPq**: Chamadas Abertas
- **CAPES**: Programas de bolsas
- **Ministério da Ciência, Tecnologia e Inovações**: Chamadas diversas

---

## 5. AGENDAMENTO (SCHEDULING) E SCRIPTS

### Scheduler (Cron Job)
**Arquivo**: `/Users/alexandrerocha/captaMais/lib/jobs/scheduler.ts`

```typescript
// Configuração:
- Expressão Cron: '0 8 * * 1'   // Segunda-feira às 08:00
- Task: Executa varredura semanal
- Rota chamada: POST /api/jobs/run-weekly-scan
- Status: Automático ao iniciar aplicação
```

### Worker em Background
**Arquivo**: `/Users/alexandrerocha/captaMais/lib/scraper/worker.ts`

```typescript
// Executado:
- Ao iniciar (após 15 segundos)
- A cada 30 minutos automaticamente
- Via cron job semanal

// Ciclo:
1. Busca novos editais (buscarEditaisPortais)
2. Processa fila de pendentes (processarFilaDeEditais)
3. Log de resultados
```

### Pipeline de Análise
**Arquivo**: `/Users/alexandrerocha/captaMais/lib/scraper/pipeline.ts`

```typescript
// Funções principais:

processarEditalUnico(edital):
  1. Verifica se está fora do escopo TI
  2. Baixa PDF (3 estratégias)
  3. Marca como 'pdf_baixado'
  4. Aguarda 3s (rate limiting)
  5. Chama IA para análise
  6. Salva resultado ('analisado' ou 'erro')

processarFilaDeEditais():
  1. Busca todos os editais 'pendente'
  2. Processa cada um sequencialmente
  3. Aguarda 5s entre editais
  4. Log completo
```

---

## 6. BUSCA E FILTRAGEM DE PDFs

### PDF Downloader
**Arquivo**: `/Users/alexandrerocha/captaMais/lib/scraper/pdf-downloader.ts` (462 linhas)

#### Funções Principais:
```typescript
baixarELerPDFEdital(editalId, opcoes, orgao, titulo, dataLimite):
  // Retorna:
  {
    fonte: 'pdf_s3' | 'pdf_link' | 'html_link' | 'descricao_api' | 'sem_pdf'
    texto: string (conteúdo extraído)
    caminhoArquivo: string (path absoluto do PDF)
    pdfUrlEncontrada?: string
    tamanhoBytes?: number
  }

extrairUrlPDF(htmlContent, baseUrl):
  // Busca URLs de PDF em 5 estratégias:
  1. Links <a> com href que contém .pdf
  2. Atributos data-href
  3. Padrões em strings
  4. iframes com PDF
  5. Links indiretos

extrairTextoHtml(url):
  // Remove scripts/styles/nav
  // Retorna texto limpo para análise

limparHtmlParaTexto(html):
  // Remove tags HTML
  // Normaliza espaços
  // Converte HTML entities
```

### Validação de Conteúdo
**Arquivo**: `/Users/alexandrerocha/captaMais/lib/scraper/keyword-validator.ts`

- Valida editais contra **keywords obrigatórias**
- Categorias de validação:
  - Termos mandatórios (edital, chamada, etc)
  - Termos acadêmicos (pesquisa, bolsa, etc)
  - Termos de financiamento (recurso, financiar, etc)
  - Termos de elegibilidade (participar, inscrever, etc)
  - Termos de submissão (apresentar, enviar, etc)
  - Termos de avaliação (avaliar, critério, etc)
  - Termos de timeline (prazo, data limite, etc)
  - Termos negativos (blacklist)

---

## 7. ESTRUTURA DO BANCO DE DADOS

### Localização
**Arquivo**: `/Users/alexandrerocha/captaMais/data/editais.json`

### Interface Completa
```typescript
interface Edital {
  // Identificação
  id: string                    // UUID único
  titulo: string
  orgao: string
  
  // Financeiro
  valor: string
  valorMin?: number
  valorMax?: number
  
  // Datas
  dataPublicacao?: string
  dataLimite: string            // DD/MM/YYYY
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
  pdfSalvoEm?: string           // Caminho relativo
  conteudoCompleto?: string
  
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
    scoreAdequacao?: number      // 0-100
  }
  
  // Status e Qualidade
  statusAnalise?: 'pendente' | 'pdf_baixado' | 'analisado' | 'sem_pdf' | 'descartado' | 'erro'
  erroAnalise?: string
  fonteConteudo?: 'pdf_s3' | 'pdf_link' | 'html_link' | 'descricao_api' | 'mock' | 'sem_pdf'
  
  // Pontuação e Confiança
  scorePontuacao?: number        // 0-100
  nivelPontuacao?: 'baixo' | 'medio' | 'alto'
  scoreRelevancia?: number
  scoreConfiancaIA?: number
  scoreValidacaoKeywords?: number
  
  // Rastreabilidade
  criadoEm: string               // ISO timestamp
  atualizadoEm?: string
  ultimaAnalise?: Date
  validadoManualmente?: boolean
  
  // Filtro TI
  tecnologiaFoco?: TecnologiaFoco  // Software, Cloud, ML, etc
  tipoFerramenta?: TipoFerramenta
  palavrasChaveEncontradas?: string[]
  validadoPorIA?: boolean
  foraDoEscopo?: boolean
  
  // ... mais 20 campos para validação e histórico
}
```

### Funções de Acesso (editais-store.ts)
```typescript
getAllEditais(incluirFechados?: boolean): Edital[]
  // Retorna editais (filtra fechados por padrão)
  // Usa parseDateString para validar datas

saveEdital(edital: Partial<Edital>): Edital
  // Insere ou atualiza edital
  // Preserva criadoEm, atualiza atualizadoEm

deleteEdital(id: string): boolean
  // Remove edital

salvarValidacaoKeywords(editalId, validacaoResult, dadosExtraidos?): Edital
  // Atualiza campos de validação e extração

parseDateString(dateStr: string): Date | null
  // Converte DD/MM/YYYY ou ISO para Date
```

---

## 8. ANÁLISE COM IA (GPT-4)

### Analyzer Principal
**Arquivo**: `/Users/alexandrerocha/captaMais/lib/ai/analyzer.ts` (228 linhas)

```typescript
async analisarEditalComIA(
  editalId: string,
  textoCompletoInput: string,
  options?: { modo: 'completo' | 'simplificado' }
): Promise<Edital | null>

// Modos:
- COMPLETO: 3 prompts paralelos (financeiro, elegibilidade, resumo)
- SIMPLIFICADO: 1 prompt rápido

// Limites:
- Máximo 60.000 caracteres por análise
- Modelo: gpt-4o-mini (default)
- Temperature: 0.1 (determinístico)
```

### Prompts Especializados
**Arquivo**: `/Users/alexandrerocha/captaMais/lib/ai/prompts.ts`

1. `promptExtrairDatas()` - Extrai dataPublicacao, dataLimite, dataResultado
2. `promptExtrairValores()` - Extrai valorMin, valorMax, moeda
3. `promptExtrairElegibilidade()` - Tipos de proponentes, requisitos, restrições
4. `promptExtrairDocumentos()` - Listas de documentos obrigatórios/opcionais
5. `promptExtrairRequisitos()` - Requisitos técnicos específicos
6. `promptAnaliseFinanceiraEDatas()` - Análise financeira completa
7. `promptAnaliseElegibilidadeEDocumentos()` - Elegibilidade + docs
8. `promptAnaliseResumoECriterios()` - Resumo + critérios de avaliação
9. `promptAnaliseSimplificada()` - Análise rápida (apenas essencial)

### Validação
**Arquivo**: `/Users/alexandrerocha/captaMais/lib/ai/validator.ts`

- Valida campos extraídos pela IA
- Detecta inconsistências
- Registra confiança por campo

### Classificação com Cache
**Arquivo**: `/Users/alexandrerocha/captaMais/lib/ai/classification-cache.ts`

- Cache de resultados de classificação IA
- Hash de conteúdo como chave
- Reduz chamadas à API OpenAI

---

## 9. ROTAS API PRINCIPAIS

### `/api/editais` (GET/POST)
- **GET**: Retorna lista de editais (abertos por padrão)
- **POST**: Cria novo edital

### `/api/editais/busca` (POST)
- Executa busca consolidada em portais
- Download de PDFs (3 estratégias fallback)
- Salva no banco com status 'pendente'
- Retorna estatísticas

### `/api/editais/analisar` (POST)
- Analisa edital individual ou fila
- Body: `{ id?: string, analisarTodosPendentes?: boolean }`
- Executa pipeline completo
- Retorna resultado da análise

### `/api/editais/revisar` (POST)
- Revisão manual de editais

### `/api/editais/notificar` (POST)
- Notificações de novos editais

### `/api/editais/deletar` (DELETE)
- Remove edital e PDF associado

### `/api/jobs/run-weekly-scan` (POST)
- Executa varredura semanal agendada
- Chamado via cron job

---

## 10. FLUXO COMPLETO DE BUSCA E ANÁLISE

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USUÁRIO CLICA "DISPARAR BUSCA INTELIGENTE"              │
│    (app/editais/page.tsx:290)                               │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. POST /api/editais/busca                                  │
│    (app/api/editais/busca/route.ts)                         │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. buscarEditaisPortais()                                   │
│    (lib/scraper/fetcher.ts)                                 │
│    ├─ Prosas (autenticado)                                  │
│    ├─ FINEP                                                 │
│    ├─ CNPq                                                  │
│    ├─ CAPES                                                 │
│    └─ Ministério da Ciência                                 │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Para cada edital:                                        │
│    ├─ baixarELerPDFEdital()   [PDF Downloader]             │
│    │  ├─ Tenta URL S3                                      │
│    │  ├─ Tenta link externo                                │
│    │  └─ Fallback HTML                                     │
│    ├─ calcularPontuacaoEdital()  [Scoring]                 │
│    └─ saveEdital() com status 'pendente'                   │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. API retorna lista + Página atualiza                      │
│    Status visual: badge com "Pendente"                      │
│    Botão "Analisar" disponível em cada card                 │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. USUÁRIO CLICA "ANALISAR" ou BACKGROUND WORKER           │
│    POST /api/editais/analisar com id                        │
│    (app/api/editais/analisar/route.ts)                      │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. processarEditalUnico()                                   │
│    (lib/scraper/pipeline.ts)                                │
│    ├─ Verifica escopo TI                                    │
│    ├─ Marca como 'pdf_baixado'                              │
│    ├─ Aguarda 3s (rate limiting)                            │
│    └─ Chama analisarEditalComIA()                           │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. analisarEditalComIA() - 3 Chamadas Paralelas             │
│    (lib/ai/analyzer.ts)                                     │
│    ├─ promptAnaliseFinanceiraEDatas()                       │
│    ├─ promptAnaliseElegibilidadeEDocumentos()               │
│    └─ promptAnaliseResumoECriterios()                       │
│                                                              │
│    → Extrair datas, valores, elegibilidade, docs, resumo    │
│    → Validar campos                                         │
│    → Calcular confiança por campo                           │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. Salvar Análise                                           │
│    saveEdital() com status 'analisado'                      │
│    ├─ analiseIA completa                                    │
│    ├─ Confiança por campo                                   │
│    ├─ Score de adequação                                    │
│    └─ Campos extraídos                                      │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. USUÁRIO VÊ RESULTADO                                    │
│     ├─ Card atualizado com badge "✨ IA (85%)"             │
│     ├─ Botão "Ver Catálogo IA" disponível                   │
│     └─ Modal com análise completa ao clicar                │
│        ├─ Visão geral                                       │
│        ├─ Elegibilidade                                     │
│        ├─ Requisitos obrigatórios                           │
│        ├─ Itens financiáveis                                │
│        └─ Pontos de atenção                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. ESTRUTURA DE ARQUIVOS-CHAVE (RESUMO)

| Caminho | Linhas | Função Principal |
|---------|--------|-----------------|
| `/app/editais/page.tsx` | 818 | UI principal, filtros, grid de editais |
| `/app/api/editais/busca/route.ts` | 208 | Busca em portais + download PDFs |
| `/app/api/editais/analisar/route.ts` | 40 | Análise individual ou fila |
| `/lib/db/editais-store.ts` | 320 | Banco de dados (JSON) e funções CRUD |
| `/lib/scraper/fetcher.ts` | 155 | Busca em múltiplos portais |
| `/lib/scraper/prosas-scraper.ts` | 456 | Scraper específico Prosas (autenticado) |
| `/lib/scraper/pdf-downloader.ts` | 462 | Download e extração de PDFs |
| `/lib/scraper/pipeline.ts` | 107 | Pipeline de processamento |
| `/lib/ai/analyzer.ts` | 228 | Análise com IA (GPT-4) |
| `/lib/ai/prompts.ts` | 343 | Prompts especializados para extração |
| `/lib/ai/scoring.ts` | 158 | Cálculo de pontuação |
| `/lib/jobs/scheduler.ts` | 82 | Agendamento semanal (cron) |
| `/lib/scraper/worker.ts` | 27 | Worker em background |

---

## 12. VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Prosas (Scraping autenticado)
PROSAS_EMAIL=seu_email@exemplo.com
PROSAS_PASSWORD=sua_senha

# Agendamento
SCAN_TOKEN=token_opcional
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Dados
DATA_DIR=./data
```

---

## RESUMO EXECUTIVO

O **CaptaMais** é um sistema completo de busca, filtragem e análise inteligente de editais de financiamento/inovação. Funciona como:

1. **Web Scraper Inteligente**: Busca editais em portais oficiais (Prosas, FINEP, CNPq, CAPES)
2. **PDF Processor**: Download e extração de conteúdo com 3 estratégias de fallback
3. **IA Analyzer**: Análise estruturada com GPT-4o-mini para extrair requisitos, elegibilidade, itens financiáveis
4. **Task Scheduler**: Varredura automática semanal + execução em background a cada 30 minutos
5. **Data Pipeline**: Fluxo completo de busca → download → análise → armazenamento
6. **User Interface**: Interface React moderna com filtros avançados, cards, modal de detalhes

**Banco de Dados**: JSON estruturado em `/data/editais.json` com suporte a 50+ campos de análise, validação e rastreabilidade.

