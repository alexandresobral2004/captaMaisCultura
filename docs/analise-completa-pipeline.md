# Análise Completa do Código - CaptaMais v3.0

> Data da análise: 31/05/2026

## Visão Geral do Pipeline

O sistema implementa um pipeline automatizado de 4 etapas:

```
BUSCAR → BAIXAR → ANALISAR → GERAR PROJETO
```

---

## ETAPA 1: BUSCAR EDITAL

### Ponto de Entrada

- **`scripts/buscar-editais.sh`** — Shell script, ÚNICO ponto de entrada para buscas

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
- Gera tabela de resumo com tempo por portal

#### `lib/scraper/prosas-scraper.ts` (456 linhas)

- `realizarLoginProsas()` — login via formulário Rails (email/senha do `.env.local`)
- `carregarSessaoSalva()` — cache de sessão com expiração de 8 horas
- `buscarEditaisProsas()` — busca com re-autenticação automática
- `tentarBuscaComSessao()`:
  1. Obtém token OAuth2 (client_credentials)
  2. Consulta API V2 com paginação (até 10 páginas, 50 itens/página)
  3. Para CADA edital, busca detalhe individual com `include=arquivos,sites`
  4. Extrai PDFs do S3, datas, valores, anexos
  5. Aplica **3 filtros**: Whitelist TI → OpenAI → Blacklist
  6. Monta objeto `Edital` com campos enriquecidos (tecnologiaFoco, scoreRelevancia, etc.)

#### `lib/scraper/config.ts` (78 linhas)

- `PortalConfig` interface — define config de cada portal (id, nome, url, tipo, categoria)
- `getPortais()` — lê de `data/portais-config.json` ou cria defaults
- `removerPortal()` — remove portal permanentemente se estiver fora do ar

### Filtros de TI (`lib/scraper/filtros-ti.ts` — 902 linhas)

#### Whitelist — 3 categorias de termos:

- `tecnologia` — 120+ termos (software, IA, cloud, blockchain, IoT, etc.)
- `contexto_institucional` — universidades, institutos federais, pesquisa
- `contexto_geral` — projeto, bolsa, edital

#### Blacklist — 80+ termos de áreas irrelevantes (artes, humanidades, saúde, etc.)

- **DESATIVADA** — `validarBlacklist()` retorna sempre `true`

#### Validação OpenAI — chamada ao `gpt-4o-mini`:

- Classifica em `TecnologiaFoco` (60+ categorias como IA, Big Data, Cloud, etc.)
- Classifica em `TipoFerramenta` (framework, linguagem, plataforma, etc.)
- Retorna score (0-100) e confiança (0-100)
- Cache em memória com TTL de 24 horas
- **Fallback permissivo** — se OpenAI falhar, aceita edital automaticamente

### API Route (`app/api/jobs/run-weekly-scan/route.ts` — 271 linhas)

- 5 fases: Buscar → Classificar → Baixar PDFs → Analisar IA → Criar Notificação
- Autenticação: token de script OU cookie de admin
- Salva notificações em `data/notificacoes/`

---

## ETAPA 2: BAIXAR PDF

### Arquivo Principal

**`lib/scraper/pdf-downloader.ts`** (477 linhas)

### Estratégia de Download em Cascata (3 níveis)

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
RESULTADO: sem_pdf
```

### Detalhamento por Função

- `baixarELerPDFEdital()` — função principal, orquestra as 3 estratégias
- `baixarArquivo()` — download via axios com `responseType: arraybuffer`
- `extrairTextoPdf()` — 2 estratégias de extração:
  1. **LlamaParse** (prioridade) — preserva tabelas e formatação Markdown
  2. **pdf-parse** (fallback) — extração local do PDF
- `buscarPdfNaPaginaHtml()` — busca links `.pdf` dentro de páginas web usando Cheerio
- `extrairTextoHtml()` — extrai texto limpo de HTML (remove scripts, styles, nav, etc.)
- `limparHtmlParaTexto()` — remove tags HTML e converte entities
- `validarERegistrarConteudo()` — valida com keywords e registra em log

### Fluxo Completo

```
baixarELerPDFEdital(id, opcoes, orgao, titulo, dataLimite)
  → initDownloadDir()  # garante data/downloads/
  → tentar S3 → download → salvar PDF → extrair texto → retornar
  → tentar Link externo → PDF direto OU página web
  → tentar Descrição API → limpar HTML → retornar
  → retornar sem_pdf
```

---

## ETAPA 3: ANALISAR COM IA

### Arquivos Principais

- `lib/ai/analyzer.ts` (279 linhas) — orquestrador
- `lib/ai/schema-analise.ts` (82 linhas) — schema Zod
- `lib/ai/validator.ts` (455 linhas) — validação pós-análise
- `lib/ai/classifier.ts` (200 linhas) — classificação preliminar
- `lib/ai/scoring.ts` (158 linhas) — pontuação composta
- `lib/ai/prompts.ts` — prompts para modo simplificado
- `lib/scraper/pipeline.ts` (109 linhas) — pipeline download+análise

### Schema de Análise (`AnaliseEditalSchema`)

```typescript
{
  datas: { publicacao, abertura, limite, resultado },
  valores: { valorMin, valorMax, valorReferencia, moeda, unidade },
  elegibilidade: { tiposProponentes, requisitos, restricoes, abrangencia, areasTematicas },
  documentos: { obrigatorios, opcionais, tecnicos, fiscais, bancarios },
  resumo: string,           // até 5 frases
  objetivo: string,         // 1-2 frases
  criterios: string[],
  avaliacao: { criteriosDetalhados, penalizacoes, pontuacaoMinima },
  contato: string,
  consistencia: { status: 'ok'|'duvida'|'incompleto', alertas: string[] },
  confiancas: { datas, valores, tiposProponentes, requisitos, documentos, resumo, criterios }
}
```

### Dois Modos de Análise

#### Modo Completo (padrão)

- Usa LangChain `ChatOpenAI` com `withStructuredOutput(AnaliseEditalSchema)`
- 1 chamada OpenAI que preenche TODOS os campos de uma vez
- `temperature: 0.1` para respostas determinísticas
- Limite de 60.000 caracteres no texto

#### Modo Simplificado (fallback)

- Usa OpenAI SDK direto com `response_format: json_object`
- Prompt `promptAnaliseSimplificada()` mais simples

### Pipeline (`lib/scraper/pipeline.ts`)

```
processarEditalUnico(edital)
  → verificar foraDoEscopo
  → baixarELerPDFEdital()  # download + extração
  → delay(3000)            # evitar rate limit
  → analisarEditalComIA()  # análise completa
  → validarCamposEdital()  # validação pós-análise
  → saveEdital()           # persistir

processarFilaDeEditais()
  → getAllEditais()
  → filtrar pendentes
  → processarEditalUnico() para cada um (delay 5s entre eles)
```

### Validação (`lib/ai/validator.ts`)

- **Datas** — formato, sequência (publicação < limite < resultado), não expiradas
- **Valores** — não negativos, min < max, diferença razoável
- **Completude** — campos obrigatórios preenchidos (título >10 chars, descrição >50 chars)
- **Confiança IA** — campos com confiança <70% geram avisos
- **Coerência** — verifica contradições (ex: "startup" + "Universidade")
- `calcularHealthScore()` — score 0-100 para priorização

### Classificação (`lib/ai/classifier.ts`)

- IA: `gpt-4o-mini` com `json_object` response
- Heurística (fallback): contagem de palavras positivas/negativas, presença de datas/valores
- Score: 60% mínimo para ser considerado edital
- `classificarEmLote()` — processa múltiplos itens

### Pontuação (`lib/ai/scoring.ts`)

- **Whitelist TI**: 30% do score (alta=30, média=22, baixa=12)
- **Blacklist**: -35 pontos se bloqueado
- **PDF**: +20 (real) ou +12 (alternativo)
- **Conteúdo extenso**: +5 (>1500 chars)
- **Portal confiável**: +5
- **Classificação IA**: até +40 (confirmou edital) ou -30 (não é edital)
- Cache de classificação com hash de conteúdo (30 dias)

---

## ETAPA 4: GERAR PROJETO

### Arquivos Principais

- `lib/ai/writer.ts` (109 linhas) — `ProposalWriter` class
- `lib/ai/prompts-projeto.ts` (288 linhas) — prompts detalhados
- `lib/ai/schema-projeto.ts` (147 linhas) — schema Zod de saída
- `lib/ai/tavily-mcp.client.ts` (83 linhas) — busca web para fundamentação
- `app/api/v1/projetos/[id]/gerar/route.ts` (143 linhas) — API endpoint

### `ProposalWriter` Class

```typescript
class ProposalWriter {
  constructor(model: 'mini' | 'full')  // gpt-4o-mini ou gpt-4o

  gerarPropostaCompleta(edil, proposal) → PropostaCompleta
  gerarSecao(secao, edil, proposal, secoesAnteriores?) → SecaoGerada
  polirTexto(texto, tipo) → string
}
```

### Schema de Saída (`PropostaCompleta`)

```typescript
{
  resumoExecutivo: string,        // 5 parágrafos
  justificativa: string,          // 4-5 parágrafos
  objetivos: string,              // JSON { geral, especificos[{cod, descricao, indicador, meta}] }
  metodologia: string,            // 6 parágrafos
  resultadosEsperados: string,    // JSON { curtoPrazo, medioPrazo, longoPrazo }
  cronograma: string,
  orcamentoDetalhado: string,     // JSON { administracao, divulgacao, equipe, materiais, outros, total }
  valorSolicitado: number,
  prazoMeses: number,
  equipe: string,                 // JSON [{ nome, funcao, qualificacao, dedicacao }]
  criteriosAtendidos: string[],
  criteriosPendentes: string[],
  scoreCompliance: number,
  fontes: string[]
}
```

### Prompt Anti-IA (`prompts-projeto.ts`)

O prompt usa formato "ATUE COMO" e inclui:

- **Lista de palavras proibidas** (22 clichês como "mergulhe", "jornada", "sinergia", etc.)
- **DADOS DE BUSCA** do Tavily (fontes reais para fundamentação)
- **CONTEXTO DO EDITAL** completo (título, órgão, valor, objetivo, critérios)
- **REQUISITOS MINIMOS** obrigatórios por seção:
  - Resumo: exatamente 5 parágrafos
  - Justificativa: 4-5 parágrafos com citações [1], [2]
  - Objetivos: JSON com objetivo geral + 4-5 específicos (SMARTER)
  - Metodologia: 6 parágrafos
  - Resultados: 3 horizontes temporais com indicadores
  - Orçamento: 5 categorias, administração máx 15%
  - Equipe: 3-5 membros com funções distintas
- **DIRETRIZES ANTI-IA**:
  1. Variação sintática (frases curtas + compostas)
  2. Tom impessoal e técnico (3ª pessoa)
  3. Proibição absoluta de clichês
  4. Objetividade (sem introduções amigáveis)

### Tavily MCP Client (`tavily-mcp.client.ts`)

- Busca web via API Tavily para fundamentar dados do projeto
- Query composta: `tema + areaAtuacao + "dados estatisticas 2024 2025 Brasil"`
- Retorna até 5 resultados com título, URL e conteúdo (400 chars)
- Se Tavily falhar, continua sem search

### API de Geração (`/api/v1/projetos/[id]/gerar`)

1. Busca projeto e edital associado
2. Valida que edital tem análise IA
3. Monta `EditalContext` (título, órgão, valor, critérios, etc.)
4. Monta `UserProposal` (título, descrição, área, proposta)
5. Chama `writer.gerarPropostaCompleta()`
6. Salva resultado com status `'gerado'` e incrementa versão

---

## Fluxo Completo do Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  1. BUSCAR (buscar-editais.sh → API → fetcher → scrapers)      │
│     Prosas API V2 → OAuth2 → Paginação → Detalhes              │
│     Filtros: Whitelist TI → OpenAI → Blacklist                  │
│     Resultado: array de Edital[]                                │
├─────────────────────────────────────────────────────────────────┤
│  2. BAIXAR (pdf-downloader.ts)                                  │
│     Cascata: S3 → Link externo → HTML → Descrição API          │
│     Extração: LlamaParse → pdf-parse                            │
│     Salva PDF em data/downloads/edital-{id}.pdf                 │
├─────────────────────────────────────────────────────────────────┤
│  3. ANALISAR (analyzer.ts + validator.ts + scoring.ts)          │
│     LangChain + OpenAI gpt-4o-mini                              │
│     Schema Zod: datas, valores, elegibilidade, documentos      │
│     Validação: datas, valores, completude, coerência            │
│     Score: whitelist(30%) + IA(40%) + PDF(20%) + portal(5%)    │
│     Status: pendente → pdf_baixado → analisado                  │
├─────────────────────────────────────────────────────────────────┤
│  4. GERAR PROJETO (writer.ts + prompts-projeto.ts)              │
│     Tavily: busca web para fundamentação                        │
│     Prompt Anti-IA: sem clichês, tom técnico                    │
│     Saída: 8 seções + compliance + fontes                       │
│     Export: PDF ou Markdown                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Banco de Dados (SQLite + Drizzle ORM)

| Tabela | Descrição |
|--------|-----------|
| `editais` | Dados principais (50+ campos) |
| `analise_ia` | Resultado da análise IA |
| `analise_requisitos` | Requisitos extraídos |
| `analise_itens_financiaveis` | Itens financiáveis |
| `analise_documentos` | Documentos necessários |
| `analise_criterios` | Critérios de avaliação |
| `analise_pontos_fracos` | Alertas e pontos fracos |
| `palavras_chave` | Palavras-chave encontradas |
| `arquivos_anexos` | Arquivos do S3 |
| `motivos_pontuacao` | Razões do score |
| `usuarios` | Usuários do sistema |
| `projetos` | Projetos gerados (15+ campos) |
| `areas_tematicas` | Áreas temáticas |
| `tipos_proponente` | Tipos de proponente |

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 14, React, TypeScript |
| Backend | Next.js API Routes |
| Banco | SQLite + Drizzle ORM |
| IA | OpenAI GPT-4o/mini, LangChain |
| Busca Web | Tavily API |
| Extração PDF | LlamaParse, pdf-parse |
| Scraping | Axios, Cheerio |
| Validação | Zod schemas |
| Testes | Vitest |

---

## Mapa de Arquivos por Função

### Buscar Edital
| Arquivo | Função |
|---------|--------|
| `scripts/buscar-editais.sh` | Ponto de entrada shell |
| `lib/scraper/fetcher.ts` | Orquestrador de busca |
| `lib/scraper/prosas-scraper.ts` | Scraper Prosas (OAuth2 + API V2) |
| `lib/scraper/capta-scraper.ts` | Scraper Capta |
| `lib/scraper/config.ts` | Config de portais |
| `lib/scraper/filtros-ti.ts` | Whitelist/Blacklist/OpenAI |
| `app/api/jobs/run-weekly-scan/route.ts` | API endpoint |
| `lib/jobs/scheduler.ts` | Cron scheduler |

### Baixar PDF
| Arquivo | Função |
|---------|--------|
| `lib/scraper/pdf-downloader.ts` | Download em cascata |
| `lib/scraper/pdf-extractor.ts` | Extração de URLs PDF |
| `lib/scraper/llamaparse-extractor.ts` | Extração via LlamaParse |
| `lib/scraper/utils/path-utils.ts` | Utilitários de caminho |

### Analisar com IA
| Arquivo | Função |
|---------|--------|
| `lib/ai/analyzer.ts` | Orquestrador de análise |
| `lib/ai/schema-analise.ts` | Schema Zod da análise |
| `lib/ai/classifier.ts` | Classificação preliminar |
| `lib/ai/validator.ts` | Validação pós-análise |
| `lib/ai/scoring.ts` | Pontuação composta |
| `lib/ai/prompts.ts` | Prompts de análise |
| `lib/scraper/pipeline.ts` | Pipeline download+análise |

### Gerar Projeto
| Arquivo | Função |
|---------|--------|
| `lib/ai/writer.ts` | ProposalWriter class |
| `lib/ai/prompts-projeto.ts` | Prompts Anti-IA |
| `lib/ai/schema-projeto.ts` | Schema Zod do projeto |
| `lib/ai/tavily-mcp.client.ts` | Busca web Tavily |
| `app/api/v1/projetos/[id]/gerar/route.ts` | API de geração |
| `app/api/v1/projetos/route.ts` | CRUD projetos |
| `app/api/v1/projetos/[id]/export/route.ts` | Export PDF/Markdown |
