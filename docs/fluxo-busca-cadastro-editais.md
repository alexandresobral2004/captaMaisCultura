# Fluxo Completo: Busca e Cadastro de Editais

Este documento descreve detalhadamente o funcionamento da arquitetura de busca, triagem, download, extração de texto, análise inteligente e armazenamento de editais no ecossistema do **CaptaMais**.

---

## 1. Inicialização do Daemon e Agendamento

O ciclo de vida do coletor é automático e inicia juntamente com o servidor Next.js no arquivo [editais-store.ts](file:///Users/alexandrerocha/captaMais/lib/db/editais-store.ts). Ele é orquestrado em três frentes de disparo:

*   **Daemon de Segundo Plano (Worker):** Ao iniciar o servidor (em ambiente `node` e sem janela de navegador), verifica-se a flag global `globalThis.__editalWorkerStarted`. Se não iniciada, o daemon dispara a função `runBackgroundWorker()` 15 segundos após o boot e a repete em um intervalo contínuo **a cada 30 minutos** via `setInterval`.
*   **Agendador de Varredura Semanal (Cron Job):** O arquivo [scheduler.ts](file:///Users/alexandrerocha/captaMais/lib/jobs/scheduler.ts) configura um cron job para disparar um escaneamento completo **toda segunda-feira às 08:00**.
*   **Disparo Manual (Endpoints de API):**
    *   `POST /api/editais/busca`: Realiza a busca imediata e triagem inicial de novos editais.
    *   `POST /api/jobs/run-weekly-scan`: Simula a varredura semanal completa com todas as fases do pipeline.

---

## 2. Busca e Integração com Portais

**Arquivo Principal:** [prosas-scraper.ts](file:///Users/alexandrerocha/captaMais/lib/scraper/prosas-scraper.ts) e [fetcher.ts](file:///Users/alexandrerocha/captaMais/lib/scraper/fetcher.ts)

Atualmente, o portal **Prosas (prosas.com.br)** é o portal ativo padrão do pipeline devido ao foco de captura rica:

1.  **Autenticação Avançada:** O scraper realiza uma sessão autenticada utilizando credenciais salvas em `.env.local` (guardando cookies em cache para evitar logins repetidos).
2.  **Tokens Temporários OAuth2:** Utiliza as chaves públicas da API Prosas V2 para solicitar tokens de acesso temporários do tipo `Bearer`.
3.  **Coleta Base via API V2 (Paginação):** Consulta o endpoint `/selecao/api/v2/third_party/oportunidades/inscricoes_abertas` buscando editais em aberto, limitando a paginação e trazendo informações básicas como IDs e títulos.
4.  **Consulta Rica de Detalhes:** Para cada edital de ID localizado na listagem, o scraper efetua uma consulta rica individual (`/selecao/api/v2/third_party/oportunidades/{id}?include=arquivos,sites`), capturando o corpo da descrição em formato HTML, links de sites externos e anexos PDF armazenados no S3 do Prosas.

---

## 3. Filtragem de TI e Relevância

**Arquivo Principal:** [filtros-ti.ts](file:///Users/alexandrerocha/captaMais/lib/scraper/filtros-ti.ts)

A triagem dos editais capturados baseia-se em uma estratégia de qualificação rápida para garantir que apenas editais focados em P&D, TI ou Inovação sigam para o pipeline pesado de extração:

1.  **Whitelist TI (Palavras-Chave):** Realiza uma varredura sobre mais de 200 termos estruturados em tecnologia (IA, Cloud Computing, Blockchain, IoT, DevOps, Big Data, Linguagens de Programação). O edital é classificado como válido se contiver o número mínimo de palavras-chave qualificadas (pontuação/confiança).
2.  **Validação Inicial com OpenAI:** Dispara uma chamada direcionada à API do OpenAI (`validarComOpenAI()`) utilizando um prompt especialista de baixo custo (`gpt-4o-mini`) para receber uma pré-classificação em JSON estruturado com foco tecnológico, tipo de ferramenta, pontuação de relevância (0-100) e nível de confiança.
3.  **Blacklist (DESATIVADA):** Anteriormente, a blacklist filtrava por termos de áreas não-TI (artes, humanidades, biologia tradicional). **Por solicitação do usuário, a blacklist está completamente desativada** (`validarBlacklist()` retorna sempre `true` incondicionalmente), garantindo que editais interdisciplinares e com aplicações híbridas (como *Saúde Digital*, *Agrotech* e *Educação Digital*) não sejam erroneamente cancelados.

---

## 4. Persistência de Dados (SQLite + Drizzle ORM)

**Arquivo Principal:** [editais-store.ts](file:///Users/alexandrerocha/captaMais/lib/db/editais-store.ts)

*   **Banco de Dados Relacional:** O CaptaMais migrou de um armazenamento baseado em arquivos JSON (`editais.json`) para uma arquitetura profissional relacional utilizando **SQLite** e o **Drizzle ORM** (arquivo de esquema em `lib/database/schema.ts`).
*   **Upsert Inteligente:** A gravação é feita através do repositório `EditalRepository.ts` (`saveEdital()`), realizando uma checagem baseada em `id` ou `link` correspondente. Se o edital já existir, os novos dados extraídos são mesclados aos existentes para preservar o enriquecimento histórico das colunas.

---

## 5. Download Inteligente de Editais e PDFs

**Arquivo Principal:** [pdf-downloader.ts](file:///Users/alexandrerocha/captaMais/lib/scraper/pdf-downloader.ts)

A fim de possibilitar a extração detalhada de dados do edital, o CaptaMais utiliza uma abordagem em cascata com **três estratégias** de obtenção de conteúdo textual:

| Prioridade | Origem / Estratégia | Funcionamento |
| :---: | :--- | :--- |
| **1ª** | **Anexos do S3** | Baixa o arquivo de edital PDF direto dos caminhos de relacionamento disponibilizados pela API rica do Prosas (arquivos armazenados no Amazon S3). |
| **2ª** | **Links Externos** | Caso não existam arquivos no S3, o downloader navega no site externo informado no edital para caçar PDFs. Utiliza auxílio da IA (`pdf-extractor.ts` com `extrairComIA()`) para decifrar a URL correta do PDF nos nós da árvore HTML. |
| **3ª** | **Fallback (HTML da API)** | Caso as etapas anteriores falhem, o sistema utiliza o HTML completo da descrição da API enriquecida como conteúdo para a IA, convertendo-o de HTML para Markdown para diminuir o consumo de tokens. |

Uma vez obtido o arquivo PDF, o texto bruto é extraído utilizando a biblioteca `pdf-parse`.

---

## 6. Análise Profunda por IA (OpenAI Structured Outputs)

**Arquivo Principal:** [analyzer.ts](file:///Users/alexandrerocha/captaMais/lib/ai/analyzer.ts) e [schema-analise.ts](file:///Users/alexandrerocha/captaMais/lib/ai/schema-analise.ts)

A etapa de análise completa converte o texto extraído do edital em dados altamente estruturados e relacionais de forma extremamente precisa:

*   **Schema Unificado via LangChain:** O CaptaMais substituiu as três chamadas separadas e lentas de prompts por **uma única chamada unificada** no OpenAI (`analisarComSchemaUnificado`), reduzindo expressivamente os custos e a latência de processamento de tokens.
*   **Strict Mode Compliance (OpenAI Structured Outputs):** A chamada utiliza o interpretador de saídas estruturadas da OpenAI com modo estrito (`strict: true`). Para obedecer rigorosamente os critérios de compilação da OpenAI, o arquivo [schema-analise.ts](file:///Users/alexandrerocha/captaMais/lib/ai/schema-analise.ts) declara o campo `observacoes` em todas as sub-seções como **`.nullable()`** em vez de `.optional()`. Isso garante que 100% das propriedades no esquema pertençam à lista `required`, permitindo a entrega de valor `null` quando não houver notas.

### O que a IA Extrai em 1 Única Chamada:
1.  **Datas (`DatasSchema`):** Publicação, abertura, limite/prazo final de inscrições e resultado.
2.  **Valores (`ValoresSchema`):** Valores mínimo, máximo, moeda, unidade e a referência textual literal.
3.  **Elegibilidade (`ElegibilidadeSchema`):** Tipos de proponentes aptos, requisitos obrigatórios, restrições gerais, abrangência geográfica e áreas temáticas de foco.
4.  **Documentos (`DocumentosSchema`):** Lista de arquivos obrigatórios, opcionais, fiscais, bancários e técnicos.
5.  **Critérios de Avaliação (`AvaliacaoSchema`):** Fórmulas, notas de aprovação e motivos de penalizações e desclassificações.
6.  **Resumo e Objetivo:** Texto conciso com a finalidade principal do fomento.

---

## 7. Validação, Pontuação e Triagem Final

**Arquivo Principal:** [scoring.ts](file:///Users/alexandrerocha/captaMais/lib/ai/scoring.ts) e [validator.ts](file:///Users/alexandrerocha/captaMais/lib/ai/validator.ts)

O sistema de classificação composto decide o destino do edital calculando um **Score Final ponderado de 0 a 100**:

*   **Whitelist TI (30%):** Relevância baseada na contagem e relevância dos termos técnicos na triagem rápida.
*   **Confirmação IA da OpenAI (40%):** Peso da validação inteligente do classificador que lê o texto e valida a natureza corporativa/fomento de TI.
*   **Portais Confiáveis (5%):** Bônus concedido caso seja originário de fundações renomadas (como FINEP, CNPq, CAPES).
*   **Qualidade do PDF (20%):** Bônus de segurança se o edital tiver texto extraído de arquivo PDF real.

### Faixas de Ação (Recomendações):
*   **Score >= 80 e PDF Real:** Recomenda `analise_completa` (modo de processamento rico completo).
*   **Score >= 60:** Recomenda `analise_simplificada` (modo leve estruturado).
*   **Score < 60:** Recomenda `ignorar` (movido para lixeira/fora de escopo).

---

## 8. Notificação e Revisão Humana

*   **Fila de Notificações:** Uma vez processados, editais qualificados criam gatilhos no repositório de notificações (`app/api/editais/notificar/route.ts`).
*   **Fluxo de Revisão Humana:** Os editais são visualizados no dashboard em tempo real, onde analistas humanos podem revisar os dados estruturados pela IA (datas, valores, elegibilidade), aplicar correções pontuais, recusar o edital ou aprovar o envio para a área de captação e formulação de projetos.

---

## Usos de IA Mapeados no Fluxo

| Etapa | Arquivo / Módulo | Finalidade | Modelo |
| :--- | :--- | :--- | :--- |
| **Triagem TI** | `filtros-ti.ts` | Identificação inicial se o edital trata de TI | `gpt-4o-mini` |
| **Extração de PDF** | `pdf-extractor.ts` | Busca e localiza link para download do PDF em portais externos | `gpt-4o-mini` |
| **Classificação** | `classifier.ts` | Determina se o texto corresponde realmente a um edital | `gpt-4o-mini` |
| **Análise Estruturada** | `analyzer.ts` | Análise unificada de datas, valores, documentos e elegibilidade | `gpt-4o-mini` / `gpt-4o` |
