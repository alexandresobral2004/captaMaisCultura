# Guia de estudo: como o Capta+ funciona

> Documento de estudo para entender o sistema por dentro. Os caminhos citados foram conferidos no código
> na data da revisão. Os demais documentos em `docs/` são mais detalhados, mas alguns estão desatualizados
> (ainda mencionam SQLite como banco de produção). Quando houver conflito, o código vence.

---

## 1. Visão geral em um parágrafo

O Capta+ busca editais de fomento em portais externos, baixa os PDFs, filtra os que são realmente editais,
pontua e classifica cada um (com regras e IA), e apresenta a lista para uma pessoa revisar. Também gera
projetos a partir de editais. A aplicação é uma app Next.js (`next dev`, `next build`, `next start` em
`package.json`), com banco Postgres acessado pelo Drizzle ORM, deployada no Railway.

---

## 2. Stack e como rodar

| Peça | Onde está | Observação |
|---|---|---|
| Framework | Next.js (App Router) | pastas `app/` (páginas e rotas de API) |
| Banco | Postgres + Drizzle | schema em `lib/database/schema.ts`; migrations em `lib/database/migrations-pg/` |
| Migrations | `scripts/db-migrate.mjs` | roda como pre-deploy no Railway |
| Banco de testes | better-sqlite3 | `lib/database/db.ts` usa SQLite quando `DATABASE_PATH` está definido ou em testes |
| Testes | Vitest | `npm test` roda `__tests__/` inteiro |
| Agendamento | node-cron | `lib/jobs/scheduler.ts` |
| Tipos | TypeScript | `npm run typecheck` (há 3 erros antigos em `__tests__/repositories/palavra-chave.repository.test.ts`) |

Comandos úteis (de `package.json`): `npm run dev`, `npm test`, `npm run db:up` (Postgres local via Docker),
`npm run db:migrate`, `npm run db:generate` (gera migration a partir do schema).

---

## 3. Ordem de leitura sugerida

1. **`lib/database/schema.ts`**: as tabelas. Comece por `editais` e `jobs`. Quase tudo gira em torno delas.
2. **`lib/jobs/job-types.ts`, `job-repository.ts`, `job-runner.ts`**: o ciclo de vida de uma varredura.
3. **`app/api/jobs/run-weekly-scan/route.ts`** e **`lib/jobs/scheduler.ts`**: como a varredura é disparada
   (agendada ou manual).
4. **`lib/scraper/fetcher.ts`**: busca nos portais e primeira filtragem.
5. **`lib/scraper/pdf-downloader.ts`**: baixa o PDF (três estratégias: S3 pré-assinado, link, HTML) e extrai o texto.
6. **`lib/scraper/preparar-edital.ts`**: a etapa que decide se o documento é edital, pontua e guarda o PDF.
7. **`lib/triagem/`** e **`lib/filtros-ti/`**: regras de whitelist, blacklist e pontuação.
8. **`lib/ai/`**: chamadas ao LLM (`client.ts`, `analyzer.ts`, `jev.ts`).
9. **`lib/storage/armazenamento.ts`** e **`lib/database/services/file.service.ts`**: onde os PDFs ficam.
10. **`app/api/v1/`**: API pública e rotas de filtros e editais.

---

## 4. Conceitos-chave

### 4.1 Job de varredura
Uma execução da varredura é um registro na tabela `jobs` com `status` (`PENDENTE`, `RODANDO`, `CONCLUIDO`,
`ERRO`, em `job-types.ts`), a `fase` atual e contadores de progresso.

- **Uma por vez:** o índice único parcial `uniq_jobs_um_rodando` (migration `0001`) impede dois jobs `RODANDO`
  ao mesmo tempo. Um INSERT concorrente falha com código `23505`, que o runner converte em `ConflictError`.
- **Heartbeat:** enquanto o processo vive, `job-runner.ts` atualiza `atualizado_em` a cada 30 s (`HEARTBEAT_MS`).
- **Órfãos:** antes de cada execução, `encerrarOrfaos` marca como `ERRO` os jobs `RODANDO` sem heartbeat
  há mais de 5 min (`TEMPO_SEM_ATUALIZACAO_MS`). Isso cobre processo morto por deploy, reinício ou OOM.
- **Limite:** um deadline geral para o job ainda não existe. Só há timeout no `fetch` do agendador (60 min).

### 4.2 Pipeline de um edital
Resumo do caminho de cada edital dentro do job:

1. `fetcher.ts` lista editais dos portais.
2. `pdf-downloader.ts` tenta baixar o PDF e extrai o texto para uma pasta **temporária** do sistema.
3. `preparar-edital.ts` valida se o texto é de um edital (palavras-chave e decisão do LLM), calcula a pontuação
   e, se houver PDF, envia a cópia definitiva ao armazenamento (`downloads/<nome>`) e apaga a temporária.
4. O resultado vai para a tabela `editais` com `pdf_path` e o status de análise.

Se uma etapa falha para um edital, o runner marca aquele edital e continua com os demais. Falha fatal
aborta o job inteiro e o marca como `ERRO`.

### 4.3 Armazenamento de PDFs
- Interface `Armazenamento` em `lib/storage/armazenamento.ts` (`salvar`, `ler`, `existe`, `remover`, `listar`).
- Dois drivers: `ArmazenamentoLocal` (disco em `data/`) e `ArmazenamentoS3` (bucket S3-compatível, como o do Railway).
- Escolha por `ARMAZENAMENTO_DRIVER` (`local` por padrão). Com `s3`, exige `ARMAZENAMENTO_BUCKET`,
  `ARMAZENAMENTO_ENDPOINT`, `ARMAZENAMENTO_REGION`, `ARMAZENAMENTO_ACCESS_KEY_ID` e `ARMAZENAMENTO_SECRET_ACCESS_KEY`.
- Chaves são caminhos relativos, sem `..` e sem caminho absoluto. Exemplo: `downloads/2026-10-25-orgao-80.pdf`.
- **Atenção:** no Railway, com o driver `local`, o app emite um aviso no log. PDFs nesse modo somem a cada deploy.

### 4.4 Filtros e triagem
- **Whitelist e blacklist** (termos de TI e de exclusão) ficam em `data/filtros/*.json` e são carregadas por
  `lib/scraper/filtros/loaders.ts`, com cache em memória. A API de filtros (`app/api/v1/filtros/`) grava esses arquivos.
- **Triagem por eixo** (`lib/triagem/`): cada portal pertence a um eixo (Cultura ou Pesquisa). Os limiares
  ficam em `lib/triagem/limiares.ts`.
- **Decisão final:** pontuação em `lib/triagem/pontuacao.ts` combina regras e IA. Valores de limiar não estão
  neste guia de propósito: leia o arquivo.

### 4.5 IA
- `lib/ai/client.ts` concentra o cliente. O modelo que redige projetos é definido por `OPENAI_MODEL_REDACAO`.
- `lib/ai/analyzer.ts` analisa editais. `lib/ai/jev.ts` é a camada de decisão usada na validação de documentos.
- Prompts ficam em `lib/ai/prompts.ts`.

### 4.6 Progresso ao vivo
- A barra de progresso (`components/editais/ProgressoBuscaEditais.tsx`) consulta `/api/editais/busca/progresso` a cada 1,5 s.
- Hoje o progresso é guardado em memória do processo (`lib/scraper/progresso-busca.ts`, em `globalThis`).
  Reinício zera, e com mais de uma instância cada uma mostra um valor diferente. Está na lista de pendências.
- Os logs ao vivo (`lib/scraper/pipeline-logger.ts`) também são em memória.

### 4.7 Projetos (geração)
`lib/projetos/` gera o texto de projetos a partir de um edital. `guias-secao.ts` define o que cada seção deve
conter. `contexto-geracao.ts` monta o contexto enviado ao modelo.

---

## 5. Variáveis de ambiente que você precisa conhecer

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Postgres (obrigatória em produção e no `db:migrate`) |
| `DATABASE_PATH` | força o uso de SQLite (testes e desenvolvimento) |
| `SESSION_SECRET` | sessão |
| `SCAN_TOKEN` | autentica chamadas de varredura (cabeçalho `X-Scan-Token`) |
| `NEXT_PUBLIC_BASE_URL` | URL usada pelo agendador para chamar a API de varredura |
| `ARMAZENAMENTO_DRIVER` e `ARMAZENAMENTO_*` | onde os PDFs são guardados (ver 4.3) |
| `VARREDURA_TEMP_DIR` | pasta temporária da varredura (padrão: diretório temporário do sistema) |
| `OPENAI_MODEL_REDACAO` | modelo de geração de projetos |

Antes de qualquer deploy, confira `SESSION_SECRET`, `SCAN_TOKEN` e `NEXT_PUBLIC_BASE_URL` (está na memória do projeto).

---

## 6. Estado atual: o que está pronto e o que não está

**Pronto (commitado):**
- Índice de "uma busca por vez" no banco e heartbeat com recuperação de órfãos (`c7051bc`).
- Commit geral de alterações pendentes de geração de projetos e apresentação (`291b7a3`).

**Pronto (armazenamento e configurações):**
- Camada de armazenamento e seu uso em `FileService`, `EditalUploadService`, `ImportService` e na varredura
  (`preparar-edital.ts` e `pdf-downloader.ts`). Testes em `__tests__/storage/`.
- Script `scripts/migrar-pdfs-para-armazenamento.ts` (dry-run por padrão).
- Tabela `configuracoes`, filtros e sessão do Prosas no banco. Testes em `__tests__/config/`.
- Script `scripts/exportar-filtros.ts` para versionar os filtros do banco.

**Configurações (migradas para o banco, tabela `configuracoes`):**
- Filtros de TI (whitelist, blacklist, categorias): fonte da verdade é o banco. `data/filtros/*.json` só semeiam a
  primeira execução. Para versionar o estado atual, rode `npx tsx scripts/exportar-filtros.ts` e commite.
- Sessão do Prosas: banco (`prosas.sessao`).
- Portais: já estavam no banco (`PortalService`). `data/portais-config.json` é só legado.

**Ainda não feito:**
1. **Progresso e logs em memória:** mover para o banco (os campos de progresso já existem em `jobs`).
3. **Rate limit em memória** (`lib/api/middleware/rate-limit.ts`): problema com mais de uma instância.
4. **Bucket no Railway:** variáveis não confirmadas. Driver S3 não testado contra bucket real.
5. **Migração dos dados existentes:** rodar o script com `--executar` e depois o SQL que ele imprime.
   Até fazer isso, os registros antigos com `data/downloads/...` não são encontrados.
6. **Deadline geral do job:** não existe.

---

## 7. Checklist antes de declarar o armazenamento resolvido

- [ ] No Railway: `ARMAZENAMENTO_DRIVER=s3` e as cinco variáveis `ARMAZENAMENTO_*` definidas.
- [ ] Log do deploy sem o aviso de driver `local`.
- [ ] Um upload de teste pela aplicação: o arquivo aparece no bucket e é lido de volta.
- [ ] `npx tsx scripts/migrar-pdfs-para-armazenamento.ts` (simulação) e depois com `--executar`.
- [ ] SQL de normalização do `pdf_path` executado.
- [ ] `verificarIntegridade` sem itens em `faltando`.

---

## 8. Glossário

- **Edital:** chamada pública de fomento. No sistema, é a linha da tabela `editais`.
- **Varredura / job:** execução que busca, processa e pontua editais novos. Registro na tabela `jobs`.
- **Órfão:** job marcado como `RODANDO` cujo processo já morreu.
- **Heartbeat:** atualização periódica de `atualizado_em` que prova que o job segue vivo.
- **Whitelist / blacklist:** listas de termos que aprovam ou reprovam um documento.
- **Eixo:** Cultura ou Pesquisa; define regras de triagem por portal.
- **Chave (de armazenamento):** caminho relativo do arquivo, como `downloads/nome.pdf`.
- **Driver:** implementação concreta do armazenamento (local ou S3).
