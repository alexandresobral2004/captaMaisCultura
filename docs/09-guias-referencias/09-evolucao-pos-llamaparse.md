# Evolução do Capta+ após a entrada do LlamaParse

> Resumo do que mudou no sistema desde a introdução do LlamaParse (commit `6329a5b`, 04/06/2026), levantado pelo histórico do git em 28/10/2026. Os itens indicam o commit de referência. Não há medição de impacto em produção neste documento.

## 1. Extração de PDF

- **Fallback corrigido:** `lib/scraper/pdf-downloader.ts` usa o LlamaParse e cai para `pdf-parse` v2 quando ele falha ou devolve menos de 100 caracteres (`9f46713`, 12/10).
- **Produção:** o `pdf-parse` foi externalizado para o worker do pdfjs funcionar no deploy (`9c5cb0d`, 26/10).
- **Título do edital:** vem do próprio PDF, e a busca ignora acentos e quebras de linha (`fe5ad36`, 26/10).
- **Marcação Markdown:** o título do upload deixou de sair com a marcação Markdown do LlamaParse (`a5be509`, 26/10).
- **Validação do documento:** o documento é validado antes de seguir, com palavras de edital e decisão do Jev; itens de menu são descartados (`423b2d4`, 13/10).
- **Limite de tamanho:** aplicado no download do PDF (`c8820f7`, 13/10).
- **Leitura do PDF:** corpo do texto alinhado à esquerda, com mais entrelinhamento (`0a234a7`, 26/10).

## 2. Triagem com Jev (TypeSafe)

- Jev virou triagem rápida antes da OpenAI (`a14b695`, 12/10) e, depois, juiz principal, com dúvida em vez de rejeição (`f3a2aa8`, 13/10).
- Triagem por eixo: Cultura e TI/Pesquisa (`ec89a25`, `95005a3`, 12/10).
- Filtro de abrangência: só editais do Ceará, Nordeste ou Brasil; municipais e de outros estados são descartados (`da357c1`, `1698ca3`, 12/10).
- Jev aceita `JEV_API_KEY` além de `TYPESAFE_API_KEY` (`901e93c`, 12/10).

## 3. Busca e jobs

- Heartbeat e recuperação de jobs órfãos com trava no Postgres (`c7051bc`, 25/10).
- Busca manual com heartbeat e recuperação de órfãos (`f3a2aa8`, 27/10).
- Worker de varreduras separado do processo web (`40805ba`, 26/10).
- Busca de novos editais limitada a 2 por semana, sem baixar de novo o que já existe (`b56d56b`, 13/10).
- Barra de andamento da busca com contagem de editais úteis (`e9300c8`, 13/10).

## 4. Infraestrutura

- Migração para PostgreSQL com modo dual SQLite/Postgres (`b3ccf19`, 20/10).
- PDFs armazenados em bucket S3, com driver local (`3671345`, 25/10).
- Dockerfile próprio; `SERVICE_ROLE` escolhe web ou worker no mesmo Dockerfile (`f25d533`, `477cfdb`, 26/10).

## 5. Segurança

Correções de 12/10:

- SQL injection e path traversal em editais (`373f046`).
- Sanitização de HTML contra XSS com DOMPurify (`ba23f25`).
- Rate limit por e-mail no login, erro genérico e remoção de rotas de debug (`75aa38f`).
- Remoção de segredos padrão e do token de scan na query string (`e12ad0f`).
- Perfil leitor somente leitura e validação de role (`58d8062`).

## 6. Pendente e não entregue

- **Extração do prazo pelo Jev:** teste em 14 editais deu cerca de 93% de acerto, com o gabarito validado pelo usuário em parte dos casos. Ficou em scratchpad e não virou código. Não conta como melhoria entregue.
- **Docling como fallback:** avaliado e adiado. Exige decisão de arquitetura (processo Python dentro do Node ou serviço separado) e mudança no Dockerfile.
