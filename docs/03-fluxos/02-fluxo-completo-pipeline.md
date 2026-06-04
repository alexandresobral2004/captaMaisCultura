# Análise Completa do Código - CaptaMais v3.0

> **📍 Localização:** `docs/03-fluxos/02-fluxo-completo-pipeline.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

> Data da análise original: 31/05/2026

## Visão Geral do Pipeline

O sistema implementa um pipeline automatizado de 4 etapas:

```
BUSCAR → BAIXAR → ANALISAR → GERAR PROJETO
```

---

## ETAPA 1: BUSCAR EDITAL

### Ponto de Entrada

- **[`scripts/buscar-editais.sh`](../../scripts/buscar-editais.sh)** — Shell script, ÚNICO ponto de entrada para buscas

### Fluxo de Execução

```
buscar-editais.sh
  → curl POST /api/jobs/run-weekly-scan
    → fetcher.ts :: buscarEditaisPortais()
      → prosas-scraper.ts :: buscarEditaisProsas()
      → capta-scraper.ts :: buscarEditaisCapta()
    → filtros-ti.ts :: validarWhitelistTI() + validarComOpenAI()
    → filtros-ti.ts :: validarBlacklist()
    → pdf-downloader.ts :: baixarELerPDFEdital()
    → analyzer.ts :: analisarEditalComIA()
```

### Detalhamento dos Arquivos

#### `scripts/buscar-editais.sh` (460 linhas)

- Função `validate_prerequisites()` — valida Node.js, npm, curl
- Função `check_server()` — verifica se Next.js está rodando, inicia se necessário
- Função `execute_search()` — chama POST em `/api/jobs/run-weekly-scan`
- Função `generate_report()` — gera relatório de PDFs baixados
- Suporte a `--verbose`, `--dry-run`, `--url`, `--token`

#### `lib/scraper/fetcher.ts` (194 linhas)

- `buscarEditaisPortais()` — orquestra busca em 2 portais ativos:
  - **Prosas** (prosas.com.br) — via API V2 com OAuth2
  - **Capta** (capta.org.br) — scraping HTML
- `filtrarComClassificador()` — prepara editais para análise IA (score neutro=50)

#### `lib/scraper/prosas-scraper.ts` (456 linhas)

##### Fluxo de Autenticação
```
1. Carrega sessão salva (data/prosas-session.json)
2. Se sessão vazia/expirada → login via formulário Rails
3. GET /users/sign_in → extrai CSRF token
4. POST /users/sign_in (email + senha)
5. Salva cookies em data/prosas-session.json
6. Re-autenticação automática em caso de 401
```

##### Fluxo de Busca
```
1. Solicita token OAuth2 (POST /auth/oauth2/token, client_credentials)
2. GET /inscricoes_abertas?page=1&size=50
3. Para cada edital: GET /oportunidades/{id}?include=arquivos,sites
4. Extrai: descricao (HTML), link, valor_limite, arquivos (S3)
5. Rate limiting: 500ms entre requests
6. Retorna array Edital[] com campos enriquecidos
```

#### `lib/scraper/filtros-ti.ts` (902 linhas)

##### Whitelist (3 categorias, 200+ termos)
- **tecnologia** (120+): software, IA, cloud, blockchain, IoT, DevOps, Big Data
- **contexto_institucional** (50+): universidade, instituto federal, pesquisa
- **contexto_geral** (30+): projeto, bolsa, edital, fomento

##### Validação OpenAI (gpt-4o-mini)
```typescript
async validarComOpenAI(titulo, descricao, link) → {
  tecnologiaFoco: TecnologiaFoco enum,
  tipoFerramenta: TipoFerramenta enum,
  score: 0-100,
  confianca: 0-100,
  motivo: string
}
```

- **Cache** em memória com TTL de 24h
- **Timeout** de 10s com retry
- **Fallback permissivo**: se OpenAI falhar, aceita edital (score 50, conf 30%)

##### Blacklist (DESATIVADA)
- 80+ termos de áreas irrelevantes
- Função `validarBlacklist()` retorna `true` sempre
- Motivo: permitir editais interdisciplinares (Saúde Digital, Agrotech)

---

## ETAPA 2: BAIXAR PDF

### Arquivo Principal: `lib/scraper/pdf-downloader.ts` (477 linhas)

### 3 Estratégias de Download em Cascata

```
ESTRATÉGIA 1: PDF pré-assinado S3 (prioridade máxima)
  ↓ falha
ESTRATÉGIA 2: Link externo
  ├── 2a: Link é PDF direto (.pdf)
  └── 2b: Link é página web → buscar PDF dentro
      ↓ falha
      FALLBACK: extrair texto do HTML
  ↓ falha
ESTRATÉGIA 3: Descrição HTML da API
  ↓ falha
RESULTADO: sem_pdf (marca com fonteConteudo='sem_pdf')
```

### Funções Principais

- `baixarELerPDFEdital(id, opcoes, orgao, titulo, dataLimite)` — orquestra 3 estratégias
- `baixarArquivo()` — download via axios com arraybuffer
- `extrairTextoPdf()` — 2 estratégias:
  1. **LlamaParse** (prioridade) — preserva tabelas e formatação Markdown
  2. **pdf-parse** (fallback) — extração local
- `buscarPdfNaPaginaHtml()` — busca links `.pdf` em páginas web (Cheerio)
- `extrairTextoHtml()` — extrai texto limpo de HTML
- `validarERegistrarConteudo()` — valida com keywords e registra em log

### Retorno

```typescript
{
  texto: string,
  fonte: 'pdf_s3' | 'pdf_link' | 'html_link' | 'descricao_api' | 'sem_pdf',
  pdfUrlEncontrada?: string,
  caminhoArquivo: string,
  tamanhoBytes?: number,
  validacaoKeywords?: any
}
```

### Pipeline: `lib/scraper/pipeline.ts` (109 linhas)

```typescript
processarEditalUnico(edital) → boolean
  // 1. Verificar foraDoEscopo
  // 2. baixarELerPDFEdital()
  // 3. delay(3000) — evitar rate limit
  // 4. analisarEditalComIA()
  // 5. saveEdital()

processarFilaDeEditais() → void
  // Busca pendentes e processa cada um (delay 5s)
```

---

## ETAPA 3: ANALISAR COM IA

### Arquivos

| Arquivo | Linhas | Função |
|---------|--------|--------|
| `lib/ai/analyzer.ts` | 279 | Orquestrador de análise |
| `lib/ai/schema-analise.ts` | 82 | Schema Zod da análise |
| `lib/ai/validator.ts` | 455 | Validação pós-análise |
| `lib/ai/classifier.ts` | 200 | Classificação preliminar |
| `lib/ai/scoring.ts` | 158 | Pontuação composta |
| `lib/ai/prompts.ts` | — | Prompts de análise |

### Schema de Análise

```typescript
{
  datas: { publicacao, abertura, limite, resultado },
  valores: { valorMin, valorMax, valorReferencia, moeda, unidade },
  elegibilidade: { tiposProponentes, requisitos, restricoes, ... },
  documentos: { obrigatorios, opcionais, tecnicos, fiscais, bancarios },
  resumo: string,
  objetivo: string,
  criterios: string[],
  avaliacao: { criteriosDetalhados, penalizacoes, pontuacaoMinima },
  contato: string,
  consistencia: { status, alertas },
  confiancas: { ... }
}
```

### Dois Modos de Análise

**Modo Completo (padrão):**
- LangChain `ChatOpenAI` com `withStructuredOutput(AnaliseEditalSchema)`
- 1 chamada OpenAI preenche TODOS os campos
- `temperature: 0.1`
- Limite de 60.000 caracteres

**Modo Simplificado (fallback):**
- OpenAI SDK direto com `response_format: json_object`
- Prompt mais simples

### Validação Pós-Análise

- **Datas** — formato, sequência (publicacao < limite < resultado), não expiradas
- **Valores** — não-negativos, min < max, diferença razoável
- **Completude** — campos obrigatórios
- **Confiança IA** — campos com confiança <70% geram avisos
- **Coerência** — detecção de contradições

### Classificação: `lib/ai/classifier.ts` (200 linhas)

- IA: `gpt-4o-mini` com `json_object` response
- Heurística (fallback): contagem de palavras positivas/negativas
- Score mínimo: 60% para ser edital
- `classificarEmLote()` — processa múltiplos itens

### Pontuação: `lib/ai/scoring.ts` (158 linhas)

| Fonte | Peso | Detalhe |
|-------|------|---------|
| Whitelist TI | 30% | alta=30, media=22, baixa=12 |
| Blacklist | -35 | se bloqueado |
| PDF encontrado | +20 | PDF real |
| PDF alternativo | +12 | conteúdo alternativo |
| Conteúdo extenso | +5 | >1500 chars |
| Portal confiável | +5 | FINEP, CNPq, CAPES, Prosas |
| IA confirmou edital | +40 | até +40 baseado em confiança |
| IA indicou não-edital | -30 | — |

**Decisão:**
- `score >= 80` + PDF real → `analise_completa`
- `score >= 60` → `analise_simplificada`
- `score < 60` ou sem PDF → `ignorar`

---

## ETAPA 4: GERAR PROJETO

### Arquivos

| Arquivo | Linhas | Função |
|---------|--------|--------|
| `lib/ai/writer.ts` | 109 | ProposalWriter class |
| `lib/ai/prompts-projeto.ts` | 288 | Prompts Anti-IA |
| `lib/ai/schema-projeto.ts` | 147 | Schema Zod do projeto |
| `lib/ai/tavily-mcp.client.ts` | 83 | Busca web Tavily |
| `app/api/v1/projetos/[id]/gerar/route.ts` | 143 | API de geração |

### ProposalWriter Class

```typescript
class ProposalWriter {
  constructor(model: 'mini' | 'full')

  async gerarPropostaCompleta(edital, proposal) → PropostaCompleta
  async gerarSecao(secao, edital, proposal, secoesAnteriores?) → SecaoGerada
  async polirTexto(texto, tipo) → string
}
```

### Schema de Saída

```typescript
{
  resumoExecutivo: string,        // 5 parágrafos
  justificativa: string,          // 4-5 parágrafos
  objetivos: string,              // JSON
  metodologia: string,            // 6 parágrafos
  resultadosEsperados: string,    // JSON
  cronograma: string,
  orcamentoDetalhado: string,     // JSON
  valorSolicitado: number,
  prazoMeses: number,
  equipe: string,
  criteriosAtendidos: string[],
  criteriosPendentes: string[],
  scoreCompliance: number,
  fontes: string[]
}
```

### Prompt Anti-IA

- **22 palavras proibidas** (clichês IA): "mergulhe", "jornada", "sinergia", "catalisador"
- **Tom técnico**, 3ª pessoa, sem introduções amigáveis
- **Variação sintática** (frases curtas + compostas)
- **Citações reais** do Tavily

### Tavily MCP Client

```typescript
buscarDadosProjetoMCP(tema, areaAtuacao?) → {
  results: [{ title, url, content }],
  query: string
}
```

- Query: `tema + areaAtuacao + "dados estatisticas 2024 2025 Brasil"`
- Até 5 resultados
- Se falhar, continua sem search

### Fluxo da API de Geração

```
1. Busca projeto e edital associado
2. Valida que edital tem análise IA
3. Monta EditalContext (normalizando arrays)
4. Monta UserProposal (dados do usuário)
5. Chama writer.gerarPropostaCompleta()
6. Salva com status='gerado' e incrementa versão
```

---

## Estatísticas do Sistema

### Banco de Dados (SQLite)
- **Edições em produção:** 147 editais
- **Tamanho:** ~500 KB (SQLite compact)
- **PDFs baixados:** 106 arquivos
- **Análises IA:** 102 (69%)

### Fontes de Conteúdo
- HTML pages: 99 (67%)
- PDF direto: 43 (29%)
- Sem PDF: 5 (3%)

### Performance
- 5 portais: 5-10 minutos total
- Whitelist check: ~10ms por item
- OpenAI classification: ~2-3 segundos
- 7 analyzer calls: ~15-20 segundos por edital

---

## 📚 Documentação Relacionada

- **Fluxo de busca e cadastro:** [`01-fluxo-busca-cadastro.md`](01-fluxo-busca-cadastro.md)
- **Fluxo Prosas detalhado:** [`03-fluxo-prosas-completo.md`](03-fluxo-prosas-completo.md)
- **Fluxo de extração PDF:** [`04-fluxo-extracao-pdf.md`](04-fluxo-extracao-pdf.md)
- **Mapa do projeto:** [`../02-arquitetura/02-mapa-projeto.md`](../02-arquitetura/02-mapa-projeto.md)
- **Architecture Summary:** [`../02-arquitetura/01-architecture-summary.md`](../02-arquitetura/01-architecture-summary.md)
