# Fluxo Completo: Busca e Cadastro de Editais

> **📍 Localização:** `docs/03-fluxos/01-fluxo-busca-cadastro.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

Este documento descreve detalhadamente o funcionamento da arquitetura de busca, triagem, download, extração de texto, análise inteligente e armazenamento de editais no ecossistema do **CaptaMais**.

---

## 1. Inicialização do Daemon e Agendamento

O ciclo de vida do coletor é automático e inicia juntamente com o servidor Next.js no arquivo [`lib/db/editais-store.ts`](../../lib/db/editais-store.ts). Ele é orquestrado em três frentes de disparo:

*   **Daemon de Segundo Plano (Worker):** Ao iniciar o servidor (em ambiente `node` e sem janela de navegador), verifica-se a flag global `globalThis.__editalWorkerStarted`. Se não iniciada, o daemon dispara a função `runBackgroundWorker()` 15 segundos após o boot e a repete em um intervalo contínuo **a cada 30 minutos** via `setInterval`.
*   **Agendador de Varredura Semanal (Cron Job):** O arquivo [`lib/jobs/scheduler.ts`](../../lib/jobs/scheduler.ts) configura um cron job para disparar um escaneamento completo **toda segunda-feira às 08:00**.
*   **Disparo Manual (Endpoints de API):**
    *   `POST /api/editais/busca`: Realiza a busca imediata e triagem inicial de novos editais.
    *   `POST /api/jobs/run-weekly-scan`: Simula a varredura semanal completa com todas as fases do pipeline.

---

## 2. Busca e Integração com Portais

**Arquivo Principal:** [`lib/scraper/prosas-scraper.ts`](../../lib/scraper/prosas-scraper.ts) e [`lib/scraper/fetcher.ts`](../../lib/scraper/fetcher.ts)

Atualmente, o portal **Prosas (prosas.com.br)** é o portal ativo padrão do pipeline devido ao foco de captura rica:

1.  **Autenticação Avançada:** O scraper realiza uma sessão autenticada utilizando credenciais salvas em `.env.local` (guardando cookies em cache para evitar logins repetidos).
2.  **Tokens Temporários OAuth2:** Utiliza as chaves públicas da API Prosas V2 para solicitar tokens de acesso temporários do tipo `Bearer`.
3.  **Coleta Base via API V2 (Paginação):** Consulta o endpoint `/selecao/api/v2/third_party/oportunidades/inscricoes_abertas` buscando editais em aberto, limitando a paginação e trazendo informações básicas como IDs e títulos.
4.  **Consulta Rica de Detalhes:** Para cada edital de ID localizado na listagem, o scraper efetua uma consulta rica individual (`/selecao/api/v2/third_party/oportunidades/{id}?include=arquivos,sites`), capturando o corpo da descrição em formato HTML, links de sites externos e anexos PDF armazenados no S3 do Prosas.

---

## 3. Filtragem de TI e Relevância

**Arquivo Principal:** [`lib/scraper/filtros-ti.ts`](../../lib/scraper/filtros-ti.ts)

A triagem dos editais capturados baseia-se em uma estratégia de qualificação rápida para garantir que apenas editais focados em P&D, TI ou Inovação sigam para o pipeline pesado de extração:

1.  **Whitelist TI (Palavras-Chave):** Realiza uma varredura sobre mais de 200 termos estruturados em tecnologia (IA, Cloud Computing, Blockchain, IoT, DevOps, Big Data, Linguagens de Programação). O edital é classificado como válido se contiver o número mínimo de palavras-chave qualificadas (pontuação/confiança).
2.  **Validação Inicial com OpenAI:** Dispara uma chamada direcionada à API do OpenAI (`validarComOpenAI()`) utilizando um prompt especialista de baixo custo (`gpt-4o-mini`) para receber uma pré-classificação em JSON estruturado com foco tecnológico, tipo de ferramenta, pontuação de relevância (0-100) e nível de confiança.
3.  **Blacklist (DESATIVADA):** Anteriormente, a blacklist filtrava por termos de áreas não-TI (artes, humanidades, biologia tradicional). **Por solicitação do usuário, a blacklist está completamente desativada** (`validarBlacklist()` retorna sempre `true` incondicionalmente), garantindo que editais interdisciplinares e com aplicações híbridas (como *Saúde Digital*, *Agrotech* e *Educação Digital*) não sejam erroneamente cancelados.

---

## 4. Persistência de Dados (SQLite + Drizzle ORM)

**Arquivo Principal:** [`lib/db/editais-store.ts`](../../lib/db/editais-store.ts)

*   **Banco de Dados Relacional:** O CaptaMais migrou de um armazenamento baseado em arquivos JSON (`editais.json`) para uma arquitetura profissional relacional utilizando **SQLite** e o **Drizzle ORM** (arquivo de esquema em [`lib/database/schema.ts`](../../lib/database/schema.ts)).
*   **Upsert Inteligente:** A gravação é feita através do repositório [`EditalRepository.ts`](../../lib/database/repositories/edital.repository.ts) (`saveEdital()`), realizando uma checagem baseada em `id` ou `link` correspondente. Se o edital já existir, os novos dados extraídos são mesclados aos existentes para preservar o enriquecimento histórico das colunas.

### 4.1 Tabelas Normalizadas

O esquema relacional é composto por **15 tabelas** interligadas:

```
editais 1→1 analise_ia
editais 1→N palavras_chave
editais 1→N arquivos_anexos
editais 1→N motivos_pontuacao
analise_ia 1→N analise_requisitos
analise_ia 1→N analise_itens_financiaveis
analise_ia 1→N analise_documentos
analise_ia 1→N analise_criterios
analise_ia 1→N analise_pontos_fracos
editais 1→N projetos
```

Documentação completa do schema em [`../02-arquitetura/05-api-documentacao.md`](../02-arquitetura/05-api-documentacao.md).

---

## 5. Download de PDF (3 Estratégias de Cascata)

**Arquivo Principal:** [`lib/scraper/pdf-downloader.ts`](../../lib/scraper/pdf-downloader.ts)

Antes de qualquer análise de IA ser dispendiosa, o sistema tenta materializar o documento original. Para isso, a função `baixarELerPDFEdital()` implementa 3 níveis de fallback, em ordem decrescente de confiabilidade:

### Estratégia 1: S3 (Prioridade Máxima)
- URL pré-assinada do Amazon S3 (validade de 1 hora)
- Retornada por `include=arquivos` na API V2
- Resultado esperado: ~60% dos PDFs

### Estratégia 2: Link Externo
- **2a.** Se URL termina em `.pdf` → download direto com axios
- **2b.** Se URL é página web → busca links `.pdf` na página com Cheerio
- **Fallback:** Extrair texto do HTML
- Resultado esperado: ~30% dos PDFs

### Estratégia 3: Descrição HTML da API
- Campo `attributes.descricao` da API V2
- Conversão HTML → texto limpo
- Limitador: apenas se HTML > 200 caracteres
- Resultado esperado: ~10% dos casos

### Sem PDF: `fonteConteudo='sem_pdf'`
- Marcador para casos raros onde nenhuma estratégia funcionou

### Rastreabilidade
- O resultado é registrado com o campo `fonteConteudo` para auditoria
- PDFs são salvos em `data/downloads/edital-{id}.pdf`

---

## 6. Análise Estruturada com IA (LLM)

**Arquivos Principais:**
- [`lib/ai/analyzer.ts`](../../lib/ai/analyzer.ts) (orquestrador)
- [`lib/ai/prompts.ts`](../../lib/ai/prompts.ts) (prompts especializados)
- [`lib/ai/schema-analise.ts`](../../lib/ai/schema-analise.ts) (schema Zod)
- [`lib/ai/validator.ts`](../../lib/ai/validator.ts) (validação pós-análise)

O texto extraído do PDF é então enviado para a OpenAI (modelo `gpt-4o-mini`) através de **prompts estruturados baseados em Schema Zod** (Structured Outputs). A análise é dividida em duas modalidades:

### 6.1 Modo Completo (Padrão)
- **1 chamada OpenAI** com `withStructuredOutput(AnaliseEditalSchema)`
- `temperature: 0.1` (respostas determinísticas)
- Limite de 60.000 caracteres por análise
- Preenche **todos os campos de uma vez**:
  - Datas (publicação, abertura, limite, resultado)
  - Valores (min, max, moeda, unidade)
  - Elegibilidade (tipos de proponentes, requisitos, restrições)
  - Documentos (obrigatórios, opcionais, técnicos, fiscais, bancários)
  - Critérios de avaliação
  - Resumo executivo
  - Pontos de contato

### 6.2 Modo Simplificado (Fallback)
- Acionado se o modo completo falhar
- 1 prompt OpenAI SDK direto
- Extrai apenas campos essenciais

### 6.3 Validação Pós-Análise
- **Datas:** formato, sequência temporal, não expiradas
- **Valores:** não-negativos, min < max, diferença razoável
- **Completude:** campos obrigatórios (titulo >10 chars, descrição >50 chars)
- **Confiança IA:** campos com confiança <70% geram avisos
- **Coerência:** detecção de contradições lógicas

### 6.4 Health Score
- `calcularHealthScore()` retorna score 0-100
- Usado para priorização na fila de revisão manual
- Score 80+ = alta qualidade, score <50 = requer revisão

---

## 7. Notificações e Revisão Humanizada

**Arquivos Principais:**
- [`app/api/editais/notificar/route.ts`](../../app/api/editais/notificar/route.ts)
- [`app/api/editais/revisar/route.ts`](../../app/api/editais/revisar/route.ts)
- [`components/EditalReviewPanel.tsx`](../../components/EditalReviewPanel.tsx)

Ao final de cada varredura, o sistema gera **arquivos de notificação** no diretório `data/notificacoes/{uuid}.json`. O frontend React consome essas notificações via componente `NotificacaoBell` e exibe a fila de editais pendentes de revisão.

A interface de revisão permite ao usuário:
1. Visualizar resumo IA do edital
2. Aprovar (`statusRevisao = 'aprovado'`)
3. Rejeitar (`statusRevisao = 'rejeitado'`)
4. Solicitar re-análise com parâmetros customizados
5. Deletar edital (cascata: remove PDF, análise, palavras-chave)

---

## 8. Geração de Projeto (Pipeline Adicional)

**Arquivos Principais:**
- [`lib/ai/writer.ts`](../../lib/ai/writer.ts) (ProposalWriter)
- [`lib/ai/prompts-projeto.ts`](../../lib/ai/prompts-projeto.ts) (Prompts Anti-IA)
- [`lib/ai/tavily-mcp.client.ts`](../../lib/ai/tavily-mcp.client.ts) (Busca web)
- [`app/api/v1/projetos/[id]/gerar/route.ts`](../../app/api/v1/projetos/[id]/gerar/route.ts)

Após aprovação de um edital, o usuário pode gerar uma **proposta de projeto** estruturada com IA:

1. **Tavily MCP:** busca dados estatísticos e referências para fundamentação
2. **Prompt Anti-IA:** sem clichês, tom técnico, 3ª pessoa
3. **Schema Zod:** 8 seções estruturadas (resumo, justificativa, objetivos, metodologia, etc.)
4. **Export:** PDF ou Markdown via `/api/v1/projetos/[id]/export`

Documentação detalhada em [`../02-arquitetura/02-mapa-projeto.md`](../02-arquitetura/02-mapa-projeto.md) (seção 7).

---

## 9. Resumo do Fluxo Completo

```
┌──────────────────────────────────────────────────────────────┐
│  1. DISPARO (a cada 30min, semanalmente ou manual)           │
│     ├─ Worker background (lib/scraper/worker.ts)             │
│     ├─ Cron job (lib/jobs/scheduler.ts) - Seg 08:00          │
│     └─ API: POST /api/jobs/run-weekly-scan                   │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  2. BUSCAR (lib/scraper/prosas-scraper.ts)                   │
│     ├─ Login OAuth2 (sessão cache em data/prosas-session)   │
│     ├─ Token Bearer (client_credentials)                    │
│     ├─ Listagem paginada API V2                             │
│     └─ Detalhe individual cada edital (include=arquivos)     │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  3. FILTRAR (lib/scraper/filtros-ti.ts)                      │
│     ├─ Whitelist TI (200+ termos)                            │
│     ├─ Validação OpenAI (gpt-4o-mini)                       │
│     └─ Blacklist (DESATIVADA)                                │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  4. BAIXAR PDF (lib/scraper/pdf-downloader.ts)               │
│     ├─ Estratégia 1: S3 pré-assinado                        │
│     ├─ Estratégia 2a: Link .pdf direto                      │
│     ├─ Estratégia 2b: PDF em página web                     │
│     ├─ Estratégia 3: Texto HTML da descrição                │
│     └─ Salva em data/downloads/ + registra fonteConteudo     │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  5. ANALISAR (lib/ai/analyzer.ts)                            │
│     ├─ Modo completo: 1 chamada com schema Zod              │
│     ├─ Extrai: datas, valores, elegibilidade, documentos    │
│     ├─ Modo simplificado: fallback                          │
│     └─ Validação (lib/ai/validator.ts)                      │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  6. PERSISTIR (lib/database/repositories/edital.repository)  │
│     ├─ Upsert inteligente (id ou link)                      │
│     ├─ Preserva enriquecimento histórico                    │
│     └─ SQLite WAL mode + FTS5                               │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  7. NOTIFICAR (data/notificacoes/{uuid}.json)                │
│     └─ Frontend consome via NotificacaoBell                  │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  8. REVISAR (app/editais/page.tsx + EditalReviewPanel)       │
│     ├─ Aprovar / Rejeitar                                   │
│     ├─ Re-analisar                                          │
│     └─ Deletar (cascata)                                    │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  9. GERAR PROJETO (lib/ai/writer.ts) [OPCIONAL]              │
│     ├─ Tavily: fundamentação com dados reais                │
│     ├─ Prompt Anti-IA: 8 seções estruturadas                │
│     └─ Export: PDF ou Markdown                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📚 Documentação Relacionada

- **Análise completa do pipeline:** [`02-fluxo-completo-pipeline.md`](02-fluxo-completo-pipeline.md)
- **Fluxo Prosas detalhado:** [`03-fluxo-prosas-completo.md`](03-fluxo-prosas-completo.md)
- **Fluxo de extração PDF:** [`04-fluxo-extracao-pdf.md`](04-fluxo-extracao-pdf.md)
- **Fluxo de exclusão:** [`05-fluxo-exclusao-analise.md`](05-fluxo-exclusao-analise.md)
- **Mudanças no pipeline:** [`06-mudancas-pipeline.md`](06-mudancas-pipeline.md)
- **Mapa do projeto:** [`../02-arquitetura/02-mapa-projeto.md`](../02-arquitetura/02-mapa-projeto.md)
