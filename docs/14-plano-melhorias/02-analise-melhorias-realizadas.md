# Análise das melhorias realizadas no Capta+

Data da análise: 04/11/2026
Base: commits de `main` desde o plano de 31/10/2026 (`9b5b97e`), merges das branches de fase (`feat/fase-1-jobs`, `feat/fase-2-estado-compartilhado`, `feat/fase-3-custo-ia`, `feat/plano-melhorias-fase-0`) e verificação direta no código.

Este documento confere o que o plano `01-pendencias-e-fases.md` previa contra o que existe no código hoje. Os status abaixo foram checados com busca no código e execução de `tsc` e da suíte de testes, não só pela mensagem dos commits.

---

## 1. Resumo

| Situação | Quantidade (de 44 pendências) |
|---|---|
| Concluído | 10 |
| Parcial | 5 |
| Pendente ou sem evidência no código | 29 |

**Fases:**

| Fase | Estado | Observação |
|---|---|---|
| 0. Saneamento | Concluída | `tsc --noEmit` sai com 0 e os flags `ignoreBuildErrors` e `ignoreDuringBuilds` foram removidos |
| 1. Jobs e recuperação | Concluída, com ressalva | Busca manual vai pela fila, com heartbeat e órfãos em 5 min. Falta teste de queda real do worker no meio de uma varredura |
| 2. Estado compartilhado | Parcial | Progresso, logs e rate limit saíram da memória do processo. Falta P10 (cache de portais) |
| 3. Custo e vazão da IA | Parcial | Custo registrado e com alerta (P14). Limitador, retry com backoff, cache por hash e triagem antes da IA (P11, P12, P13, P15) não foram feitos |
| 4. Idempotência e geração assíncrona | Não iniciada | P07 (geração de projeto em 202) e P16 (idempotência total) pendentes |
| 5. Banco e armazenamento | Parcial | Driver S3 existe, mas o padrão ainda é `local`. Pool sem `max` e modo SQLite ainda ativo |
| 6. Segurança e observabilidade | Não iniciada | Só há início em P34 (painel de custos e de logs) |
| 7. Testes de portais e carga | Não iniciada | Sem teste de contrato, de integração com PostgreSQL real nem k6 |
| 8. Recuperação e ambientes | Não iniciada | Há `Dockerfile` e pre-deploy no Railway, mas sem RPO/RTO, restauração testada nem homologação |

---

## 2. Status item a item

Legenda: ✅ concluído · 🟡 parcial · ⬜ pendente ou sem evidência.

### Fase 0: saneamento

| ID | Status | Evidência |
|---|---|---|
| P01 | ✅ | `tsc --noEmit` com código 0 em 04/11/2026. Flags removidos do build (commit `0864f4f`) |
| P02 | ✅ | Contagem registrada. Em 04/11/2026: 87 arquivos (77 passando, 10 pulados) e 590 casos (566 passando, 24 pulados). A medição de 31/10 (43 arquivos, 433 casos) estava desatualizada |
| P03 | ✅ | Árvore de trabalho limpa no início da sessão de 04/11/2026 |

### Fase 1: jobs e recuperação

| ID | Status | Evidência |
|---|---|---|
| P04 | ✅ | `POST /api/editais/busca` responde 202 com `jobId`; o worker executa (`lib/scraper/busca-manual.ts`). Commit `26afe8a` |
| P05 | ✅ | Heartbeat de 30 s e órfão em 5 min também na busca manual (`lib/jobs/job-runner.ts`, `lib/scraper/controle-busca.ts`). Antes o limite era de 2 horas |
| P06 | ✅ | 409 para job ativo de qualquer tipo; 429 só para o limite de 2 buscas por semana |
| P17 | ✅ | Editais com erro são retentados até 3 vezes (`tentativas_analise`). Commit `26afe8a` |

Ressalva: o critério de aceite da fase pede matar o worker no meio de uma varredura e medir o órfão. Há testes de órfãos (`__tests__/busca-manual-orfaos.test.ts`), mas o teste de queda real não foi registrado.

### Fase 2: estado compartilhado

| ID | Status | Evidência |
|---|---|---|
| P08 | ✅ | Progresso gravado por `jobId` no banco; logs do pipeline com cursor. Sem `globalThis` em código de produção (só em comentários), protegido pelo teste `__tests__/sem-globalthis.test.ts`. Commit `fb71fac` |
| P09 | ✅ | Rate limit em tabela do PostgreSQL (`limites_taxa`), com IP pelo proxy confiável (`TRUSTED_PROXY_HOPS`). Commit `fb71fac` |
| P10 | ⬜ | Cache de configuração de portais em `lib/scraper/config.ts` continua sem tratamento |

### Fase 3: custo e vazão da IA

| ID | Status | Evidência |
|---|---|---|
| P14 | ✅ | Tabela `uso_ia` com tokens por chamada, fase, edital e projeto. Painel em `/configuracoes/custos-ia`. Alerta mensal (padrão US$ 15) gravado uma vez por mês em `notificacoes`. Commits `a87ee7c` e `92f89bc` |
| P11 | ⬜ | Não há limitador único de chamadas de IA |
| P12 | ⬜ | Não há retry com backoff exponencial |
| P13 | ⬜ | Não há cache de análise por hash do PDF e da versão do prompt |
| P15 | ⬜ | Não verificado: `lib/scraper/pipeline.ts` ainda chama `analisarEditalComIA` para o edital, sem triagem comprovada antes |

### Fase 4: idempotência e geração assíncrona

| ID | Status | Evidência |
|---|---|---|
| P07 | ⬜ | `gerar-completo` ainda não responde 202 nem tem polling |
| P16 | 🟡 | Há `ON CONFLICT` em `notificacoes` e `limites_taxa`, e `editalJaProcessado` em `controle-busca.ts`. Falta `ON CONFLICT (edital_id)` na gravação de editais |

### Fase 5: banco e armazenamento

| ID | Status | Evidência |
|---|---|---|
| P18 | ⬜ | `lib/database/db.ts:59` abre o `postgres(DATABASE_URL, …)` sem `max` |
| P19 | 🟡 | Paginação em `/api/v1/editais`, `/api/v1/editais/search` e `/api/v1/logs`. Demais listagens não verificadas |
| P20 | 🟡 | Há índices no schema, mas sem medição com `EXPLAIN` |
| P21 | ⬜ | `setupFTS` no caminho PostgreSQL continua vazio (`lib/database/db.ts:67`) |
| P22 | ⬜ | O modo SQLite continua ativo (`lib/database/db.ts`) |
| P23 | 🟡 | Driver S3 e script de normalização de `pdf_path` existem (commits `3671345`, `a03ed21`). O padrão continua `local` (`lib/storage/armazenamento.ts:143`) |
| P24 | ⬜ | Não há `getSignedUrl` nem `presign` no código. A afirmação do estudo continua sem comprovação |
| P25 | ⬜ | Exportações DOCX e PDF continuam fora do bucket |
| P26 | ⬜ | Política de retenção e versionamento não definida |

### Fase 6: segurança, conformidade e observabilidade

| ID | Status | Evidência |
|---|---|---|
| P27 | ⬜ | `audit-logger` cobre só decisões do filtro de TI, não ações de admin nem exportação |
| P28 | ⬜ | Sessão do Prosas segue em `configuracoes`, sem criptografia |
| P29 | ⬜ | Mapa de dados pessoais não existe |
| P30 | ⬜ | Revisão com o encarregado do IFCE não iniciada |
| P31 | ⬜ | Política sobre envio à OpenAI não encontrada |
| P32 | ⬜ | Contrato com a OpenAI não verificável no código |
| P33 | ⬜ | Sem log estruturado com `requestId` e `jobId` |
| P34 | 🟡 | Painel de custos de IA, logs e portais existem. Falta painel de editais, erros por portal e tempo por etapa |
| P35 | ⬜ | Sem alerta de varredura travada nem de taxa de 429 |

### Fase 7: portais e carga

| ID | Status | Evidência |
|---|---|---|
| P36 | ⬜ | Resposta vazia do Prosas é logada como aviso, mas não separada de erro (`lib/scraper/prosas-scraper.ts:221`) |
| P37 | ⬜ | Sem testes de contrato dos portais |
| P38 | ⬜ | Termos de uso dos portais não verificados |
| P39 | ⬜ | Sem teste de integração do fluxo com PostgreSQL real |
| P40 | ⬜ | Sem teste de carga com k6 |

### Fase 8: recuperação e ambientes

| ID | Status | Evidência |
|---|---|---|
| P41 | ⬜ | RPO e RTO não definidos |
| P42 | ⬜ | Restauração do banco não testada |
| P43 | ⬜ | Sem ambiente de homologação |
| P44 | ⬜ | Sem infraestrutura como código |

---

## 3. Entregas que não estavam no plano

Estas mudanças foram feitas no período e não aparecem nas 44 pendências:

- **Banco dual:** migração para PostgreSQL com modo SQLite (`b3ccf19`), conexão lazy e contagens numéricas (`856df6d`), `DATABASE_SSL=disable` para Postgres local (`f8c7ae9`).
- **Worker separado:** `SERVICE_ROLE` escolhe web ou worker no mesmo Dockerfile (`477cfdb`, `40805ba`).
- **Armazenamento:** driver S3 e chave de bucket no banco (`3671345`).
- **Upload de editais:** `pdf-parse` externalizado para o worker do pdfjs (`9c5cb0d`); título vem do PDF, busca ignora acentos (`fe5ad36`); aviso quando o prazo já venceu (`00a0a87`).
- **Notificações no banco:** a central saiu de arquivos em disco, que se perdiam a cada deploy no Railway (`92f89bc`).
- **Custo de IA por fase e por edital**, com painel e alerta mensal (`a87ee7c`).
- **Auditoria de download de editais:** o scraper não baixa mais PDF de outro edital, notícia ou resultado; a validação confere o número N/AAAA do edital (`bbe57a7`). Os testes passam, mas o problema de produção ainda não foi explicado (seção 4).
- **Correções de dados:** `criado_em` deixou de gravar o texto `now()`, com migração 0009 que corrige os registros antigos (`e560329`). SQLite ativa WAL sem disputa de lock entre processos (`47d520b`).

---

## 4. Riscos abertos

1. **Download de editais em produção.** A varredura semanal validou 231 editais e baixou 3, sem erro registrado. Hipótese principal: `editalJaProcessado` (`lib/scraper/controle-busca.ts:250`) trata `pdf_baixado` como concluído, então editais que pararam nesse status podem ser pulados em varreduras seguintes. Não confirmado; precisa de consulta à tabela de produção.
2. **Notificação "4 editais baixados" sem origem identificada** no código atual. Pode vir de dados antigos.
3. **Pool de conexões sem `max`** (P18). Com mais de uma instância, o número de conexões cresce sem teto.
4. **Armazenamento padrão `local`.** No Railway, o disco é efêmero. O sistema avisa no log, mas o padrão continua perigoso se a variável não for definida.
5. **Sessão do Prosas em texto puro** no banco (P28).
6. **Sem teste de carga nem de contrato de portais.** Mudanças de layout só aparecem em produção.

---

## 5. Correções ao estudo de arguição

O plano de 31/10 pediu correções ao estudo. Situação atual:

- **Tema 2:** a varredura manual também passa pela fila e pelo worker desde `26afe8a`. O item deixou de ser verdadeiro.
- **Tema 5:** URL pré-assinada do S3 continua sem comprovação no código (P24).
- **Tema 6:** login continua com rate limit de 5 tentativas em 15 minutos, agora no PostgreSQL (P09).
- **Tema 8:** a contagem de testes mudou. Em 04/11/2026 são 590 casos em 87 arquivos (566 passando, 24 pulados). Os 433 de 31/10 e os 405 do estudo ficaram para trás.

---

## 6. Próximos passos sugeridos

Em ordem, respeitando as dependências do plano:

1. **Explicar o download de 3 de 231 editais** (riscos 1 e 2). É a pendência mais urgente porque afeta o produto em produção. Começar pela consulta de `statusAnalise`, `erroAnalise` e `fonteConteudo` dos editais validados.
2. **Fechar a Fase 3** (P11, P12, P13, P15): limitador de IA, backoff, cache por hash e triagem antes da análise. É onde mais se gasta, e P14 já dá a medição para validar o ganho.
3. **Definir `max` no pool** (P18) e o padrão de armazenamento (P23) antes de subir uma segunda instância em produção.
4. **Fechar a Fase 2** com P10 e registrar o teste de queda do worker da Fase 1.
5. **Decidir as perguntas em aberto** do plano (seção 4 do `01-pendencias-e-fases.md`): SQLite (P22), FTS (P21) e retenção (P26).
