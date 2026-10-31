# Plano de melhorias do Capta+: pendências e fases

Data: 31/10/2026
Base: verificação do código e dos commits em 31/10/2026, cruzada com o estudo de arguição (temas 1 a 11) e com os planos `docs/12-multi-instancia` e `docs/13-jobs-recuperacao`.

Este documento não substitui os dois planos existentes. Ele junta as pendências de todos os temas em um só lugar e as ordena em fases. Quando uma fase já tem plano detalhado, o item aponta para ele.

---

## 1. Pendências

Tamanho: **P** (até 1 dia), **M** (2 a 4 dias), **G** (mais de uma semana).

| ID | Pendência | Tema | Evidência no código | Tamanho |
|---|---|---|---|---|
| P01 | Corrigir 3 erros de TypeScript nos testes e remover `ignoreBuildErrors` e `ignoreDuringBuilds` do build | 8 | `tsc` sai com código 1; `__tests__/repositories/palavra-chave.repository.test.ts` (linhas 39, 52, 75); `next.config` com as duas flags em `true` | P |
| P02 | Confirmar a contagem de testes com `vitest` e registrar o número real | 8 | **Medido em 31/10/2026** com `npx vitest run`: 43 arquivos, 432 passando, 1 pulado, 433 no total, 0 falhas. O estudo cita 405 e deve ser corrigido | P (feito) |
| P03 | Commitar ou descartar as mudanças pendentes (`package.json`, `lib/utils.ts` com `tailwind-merge`, documentos em `docs/`) | Saneamento | `git status` no início da sessão | P |
| P04 | Varredura manual passa a ser só enfileirada (202) e executada pelo worker | 2 | `app/api/editais/busca/route.ts` roda a varredura dentro do `POST` | M |
| P05 | Heartbeat e recuperação também na varredura manual (hoje o limite é de 2 horas) | 2 | `docs/13`, seção 1 | M |
| P06 | Resposta de conflito na varredura manual: 409 em vez de 429 | 2 | `app/api/editais/busca/route.ts:21-27` devolve 429 quando há busca em andamento | P |
| P07 | Geração de projeto assíncrona (202, status, polling, retomada) | 2 | `gerar-completo/route.ts` faz `await` na Tavily e no LLM | G |
| P08 | Progresso e logs ao vivo da varredura no PostgreSQL | 1 | `lib/scraper/progresso-busca.ts:36` (`globalThis`) | M |
| P09 | Rate limit de login e de rotas de IA em armazenamento compartilhado | 1 e 6 | `lib/api/middleware/rate-limit.ts:8` é um `Map` por processo; com N réplicas, o limite vira N vezes maior | M |
| P10 | Cache de configuração de portais em memória com recálculo aceito | 1 | `lib/scraper/config.ts:22-24` | P |
| P11 | Limitador único de chamadas de IA, com teto por minuto | 3 | Não há limitador; 429 tratado só em `lib/ai/analyzer.ts:304` e `lib/ai/jev.ts:99` | M |
| P12 | Retry com espera exponencial e teto de tentativas em todas as chamadas de IA | 3 | Retry pontual em `lib/ai/jev.ts:99`; sem backoff exponencial | P |
| P13 | Cache de análise por hash do PDF e da versão do prompt | 3 | `createHash` só aparece em arquivos e chunks; `docs/13` fase 4 | M |
| P14 | Custo de IA registrado por projeto e por edital, com alerta | 3 e 7 | Não há registro de tokens nem custo | M |
| P15 | Confirmar a triagem antes da análise completa: a IA só recebe o que passa pelos filtros | 3 | `lib/scraper/pipeline.ts:30,85` chama `analisarEditalComIA` diretamente; ordem a confirmar | P |
| P16 | Idempotência explícita: `ON CONFLICT (edital_id)` e uso de `editalJaProcessado` em `processarFilaDeEditais` | 2 e 3 | `docs/13` fase 4 | M |
| P17 | Decidir a retentativa de editais com `erro`, com limite de tentativas | 2 | `docs/13`, seção 4 | P |
| P18 | Pool de conexões com `max` definido por instância | 4 | `lib/database/db.ts:57` usa `postgres(DATABASE_URL, …)` sem `max` | P |
| P19 | Paginação obrigatória em todas as listagens | 4 | Só `/api/v1/editais` pagina | M |
| P20 | Índices pelas consultas mais usadas, medidos com `EXPLAIN` | 4 | Não medidos | M |
| P21 | Decidir a busca textual em produção: FTS no PostgreSQL ou outra solução | 4 | `setupFTS` é vazio no caminho PostgreSQL (`lib/database/db.ts`); FTS5 só existe no SQLite (`lib/database/ddl.ts:6`) | M |
| P22 | Remover o modo SQLite, ou documentar por que ele fica | 4 | Dois modos ativos (`lib/database/db.ts:5-6`) | G |
| P23 | Migrar todos os PDFs para o bucket e gravar só a chave e o hash no banco | 5 | Driver S3 existe (`lib/storage/armazenamento.ts`), mas o padrão continua `local` | M |
| P24 | Confirmar o uso de URL pré-assinada para download de editais | 5 | Não encontrei `getSignedUrl` nem `presign` em `*.ts` | P |
| P25 | Exportações DOCX e PDF no bucket, com URL pré-assinada de validade curta | 5 | Não verificado | M |
| P26 | Política de retenção e de versionamento de editais republicados | 5 | Não definida | M |
| P27 | Trilha de auditoria para ações de admin e exportação de propostas | 6 | Só existe `audit-logger`, para decisões do filtro de TI | M |
| P28 | Mover a sessão do Prosas para cofre de segredos ou banco criptografado | 6 | Hoje está em `configuracoes` (`lib/scraper/prosas-scraper.ts:9`), sem criptografia confirmada | M |
| P29 | Mapa de dados pessoais: o que é coletado, por quê, por quanto tempo e quem acessa | 6 e 11 | Não existe | M |
| P30 | Revisar o cadastro de perfis com o encarregado de dados do IFCE | 6 | Não existe | P |
| P31 | Política escrita sobre o que pode ir para a OpenAI, com remoção de dados pessoais antes do envio | 11 | Não encontrada | M |
| P32 | Confirmar contrato e condições de uso de dados da OpenAI, por escrito | 11 | Não verificável no código | P |
| P33 | Logs em JSON com `requestId` e `jobId` | 7 | Não há biblioteca de log estruturado (pino, winston) | M |
| P34 | Painel e métricas mínimas: editais, erros por portal, tempo por etapa, tokens, custo | 7 | Não existem | G |
| P35 | Alertas de varredura travada e de taxa de 429 acima do limite | 7 | Não existem | M |
| P36 | Resposta vazia do Prosas registrada como erro, nunca como zero editais | 10 | Não há tratamento específico confirmado | P |
| P37 | Testes de contrato dos portais, rodando diariamente | 10 | Não existem | M |
| P38 | Verificar os termos de uso de cada portal e preferir API oficial ou RSS | 10 | Não verificado | M |
| P39 | Testes de integração do fluxo de varredura com PostgreSQL real | 8 | Não existem | M |
| P40 | Teste de carga com k6 em 20, 50 e 100 usuários, com critério de aceite escrito antes | 8 | Não existe | M |
| P41 | Definir RPO e RTO por tipo de dado: editais, propostas e logs | 9 | Não definidos | P |
| P42 | Testar a restauração do banco em ambiente separado e registrar o tempo | 9 | Não testado | M |
| P43 | Separar ambientes de desenvolvimento, homologação e produção | 9 | Não existe homologação | M |
| P44 | Descrever a infraestrutura como código, pensando na migração para a nuvem do Serpro | 9 | Não existe | G |

---

## 2. Fases

Ordem pensada para: primeiro sanear o que quebra o build, depois fazer o sistema rodar com mais de uma instância, depois controlar custo e dados. Cada fase só começa quando a anterior tiver critério de aceite cumprido.

### Fase 0: saneamento (1 semana)

**Objetivo:** o build deixa de esconder erros e o estado do repositório fica limpo.

- P01, P02, P03.

**Critério de aceite:** `tsc --noEmit` sai com código 0; build de produção falha se houver erro de tipo; contagem de testes registrada.

### Fase 1: jobs e recuperação (2 a 3 semanas)

**Objetivo:** nenhuma varredura fica travada, e um redeploy não mata a busca.

- Executa o plano `docs/13-jobs-recuperacao/01-plano-jobs-heartbeat-fila.md`, fases 1 e 2.
- Itens: P04, P05, P06, P17.
- Depende de P08 (o progresso precisa estar no banco para a tela consultar pelo `jobId`).

**Critério de aceite:** matar o worker no meio de uma varredura; o órfão é encerrado em até 5 minutos; a próxima varredura inicia sem 409 nem 429 indevido.

### Fase 2: estado compartilhado entre instâncias (2 semanas)

**Objetivo:** duas ou três réplicas do web funcionam sem depender de memória de processo.

- Executa o plano `docs/12-multi-instancia/01-plano-estado-em-memoria.md`.
- Itens: P08, P09, P10.
- Critério de cada rota: nenhuma depende de variável global para estado de negócio.

**Critério de aceite:** com três réplicas, a consulta de progresso retorna o mesmo resultado em qualquer uma; o limite de login vale para o conjunto de réplicas, não para cada uma.

### Fase 3: custo e vazão da IA (2 semanas)

**Objetivo:** cada edital é analisado uma vez por versão do PDF e do prompt, e o custo é conhecido.

- Itens: P11, P12, P13, P14, P15.
- Para os casos de decisão de classificação, avaliar o Jev (`lib/ai/jev.ts`) como alternativa ao prompt atual, medindo qualidade e custo na base real antes de trocar.

**Critério de aceite:** em uma varredura de teste, nenhum edital já analisado é enviado de novo à IA; o custo por edital aparece no painel com medição real, não estimativa.

### Fase 4: idempotência e geração assíncrona (2 semanas)

**Objetivo:** reprocessar nunca duplica resultado nem cobra IA de novo, e a geração de projeto não bloqueia a requisição.

- Executa o plano `docs/13`, fases 4 e 5.
- Itens: P07, P16.

**Critério de aceite:** reenfileirar uma varredura não baixa nem analisa editais de novo; a geração de projeto responde 202 e chega a `pronto` ou `erro` com a fase onde parou.

### Fase 5: banco e armazenamento (3 semanas)

**Objetivo:** o banco tem um só comportamento e os arquivos não dependem do disco do servidor.

- Banco: P18, P19, P20, P21, P22.
- Armazenamento: P23, P24, P25, P26.
- Decisão de P22 e P21 deve vir antes de começar, porque o modo SQLite e o FTS mudam o desenho da busca.

**Critério de aceite:** nenhum PDF novo é gravado em `data/downloads`; `EXPLAIN` das três consultas mais usadas está registrado; o pool tem `max` definido e a soma de conexões com N instâncias cabe no limite do banco.

### Fase 6: segurança, conformidade e observabilidade (3 semanas)

**Objetivo:** o sistema responde quem fez o quê, quais dados saem e o que está acontecendo agora.

- Segurança e dados: P27, P28, P29, P30, P31, P32.
- Observabilidade: P33, P34, P35.
- P31 precisa ser escrita com o encarregado de dados do IFCE antes de qualquer piloto com proposta real.

**Critério de aceite:** toda exportação de proposta e toda ação de admin aparece na trilha com usuário, data e objeto; um alerta dispara quando uma varredura passa do prazo.

### Fase 7: testes de portais e de carga (2 semanas)

**Objetivo:** a capacidade é medida, não estimada, e uma mudança de layout em portal aparece no dia seguinte.

- Portais: P36, P37, P38.
- Testes: P39, P40.
- O critério de aceite de P40 (p95 e taxa de erro) é escrito antes do teste.

**Critério de aceite:** relatório do k6 com 20, 50 e 100 usuários, comparado com o critério escrito; teste de contrato rodando diariamente.

### Fase 8: recuperação de desastre e ambientes (2 a 4 semanas)

**Objetivo:** o sistema pode ser recriado e restaurado dentro de metas definidas.

- Itens: P41, P42, P43, P44.
- P44 deve seguir os padrões de nuvem e segurança do Serpro. Antes de desenhar, pedir esses padrões ao time do Serpro.

**Critério de aceite:** restauração do banco em ambiente separado feita e cronometrada, dentro do RTO definido; homologação ativa com deploy próprio.

---

## 3. Dependências entre fases

```
Fase 0 ──► Fase 1 ──► Fase 2
                │
                └──► Fase 4
Fase 3 (independente após Fase 0; usa o progresso da Fase 2 para o painel)
Fase 5 ──► Fase 6 (trilha e métricas dependem do banco organizado)
Fase 7 (depende de Fase 2 e Fase 5 para o teste ser representativo)
Fase 8 (depende de Fase 5; ambientes podem começar antes)
```

---

## 4. Decisões em aberto

1. **Varredura manual:** manter o limite de 2 por semana? (`docs/13`, seção 4)
2. **Geração de projeto:** entra na mesma fila de jobs ou tem tabela própria? (`docs/13`, seção 4)
3. **Heartbeat:** 5 minutos é suficiente para chamadas longas de IA? (`docs/13`, seção 4)
4. **SQLite:** remover totalmente (P22) ou manter só para testes?
5. **Busca textual:** FTS no PostgreSQL ou outra solução (P21)?
6. **Retenção:** prazo de guarda de editais e exportações (P26).
7. **Jev:** usar nos casos de classificação da Fase 3, depois de medir qualidade e custo.

---

## 5. Pontos do estudo que precisam de correção

Os itens abaixo estão no estudo de arguição e não batem com o código atual. Corrigir antes de apresentar:

- Tema 2: a varredura automática já passa pela fila e pelo worker; só a manual ainda roda no web.
- Tema 5: a afirmação de URL pré-assinada do S3 não foi encontrada no código (P24).
- Tema 6: login já tem rate limit (5 tentativas por 15 minutos); sessão do Prosas já está no banco.
- Tema 8: o número de testes medido em 31/10/2026 é 433 casos (432 passando, 1 pulado) em 43 arquivos. O estudo cita 405 e deve ser corrigido (P02).
