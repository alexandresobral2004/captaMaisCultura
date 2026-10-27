# Plano: jobs com heartbeat, recuperação, fila e geração assíncrona

> **📍 Localização:** `docs/13-jobs-recuperacao/01-plano-jobs-heartbeat-fila.md`
> **📅 Data:** 27/10/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)
> **🎯 Origem:** tema técnico do Capta+ para a arguição do Serpro. Problema: a varredura roda no processo web; se o serviço reinicia no meio, o job fica "rodando" e novas varreduras são recusadas até alguém intervir. A geração de projeto é síncrona (cerca de 1 minuto por requisição) e não retoma se falhar.

---

## 1. Situação atual (verificada no código)

Há dois caminhos de varredura, e eles têm mecanismos diferentes.

**Caminho A: varredura semanal/agendada (fila + worker).** Já tem boa parte do desenho proposto.

| Proposta | Estado | Evidência |
|---|---|---|
| Heartbeat a cada 30 s | ✅ Feito | `lib/jobs/job-runner.ts:13` (`HEARTBEAT_MS = 30s`) e `:103-108` |
| Heartbeat a cada edital processado | ➖ Desnecessário | O loop por edital (`job-runner.ts:158` e `:198`) não bate heartbeat. Só `atualizarFase` grava `atualizadoEm`, por fase (`job-repository.ts:27-35`). O timer de 30 s já cobre fases longas. |
| Considerar vivo quem bateu nos últimos 5 min | ✅ Feito | `job-runner.ts:14` (`TEMPO_SEM_ATUALIZACAO_MS = 5 min`) |
| Recuperação com UPDATE condicional | ✅ Feito | `lib/jobs/job-repository.ts:122-131` (`encerrarOrfaos`) |
| Recuperação na subida do sistema | ❌ Falta | `encerrarOrfaos` só roda no início de `executar()`. `instrumentation.ts` só carrega filtros. |
| Fila com `FOR UPDATE SKIP LOCKED` | ⚠️ Equivalente, não igual | `job-repository.ts:171-196` faz SELECT e depois UPDATE condicional (`WHERE status = 'pendente'`). Há índice único parcial (`uniq_jobs_um_rodando`) que garante um único job rodando. Seguro, mas `SKIP LOCKED` só faria diferença com vários jobs rodando em paralelo. |
| Worker separado | ✅ Feito | `scripts/worker.ts`, ativado por `SERVICE_ROLE=worker` (`Dockerfile:22-24`) |
| Resposta 202 ao disparar | ✅ Feito | `app/api/jobs/run-weekly-scan/route.ts:65` |
| Resposta 409 quando já há job | ✅ Feito | `run-weekly-scan/route.ts:72` |

**Caminho B: varredura manual** (botão "Buscar novos editais"). É o caminho do problema descrito.

| Proposta | Estado | Evidência |
|---|---|---|
| Executa fora da requisição HTTP | ❌ Não | `app/api/editais/busca/route.ts` roda a varredura dentro do próprio `POST` |
| Heartbeat | ❌ Não | Não existe. A busca usa só `iniciada_em` |
| Recuperação | ⚠️ Lazy e com 2 horas | `lib/scraper/controle-busca.ts:36-43` e `:95-102` marcam como interrompida o que passou de `TEMPO_MAXIMO_MS` (2 h). Só roda quando alguém consulta a situação. |
| Resposta quando há busca rodando | ⚠️ 429, não 409 | `app/api/editais/busca/route.ts:21-27`. Com o `TEMPO_MAXIMO_MS` de 2 h, a recuperação acontece sozinha, mas com atraso de até 2 h. |

**Correção ao texto de origem:** "409 até alguém intervir" não é o comportamento atual. No caminho A, o órfão é encerrado sozinho após 5 minutos sem heartbeat, na próxima execução. No caminho B, é encerrado sozinho após 2 horas. O problema real é a latência de recuperação e a falta de retomada, não a necessidade de intervenção manual.

**Idempotência:**
- Parcial. `editalJaProcessado` (`lib/scraper/controle-busca.ts:152`) impede baixar de novo ou reanalisar com IA um edital que já tem PDF ou análise. Usado em `app/api/editais/busca/route.ts:62` e `lib/scraper/portal-generico.ts:174`.
- `processarFilaDeEditais` (`lib/scraper/pipeline.ts:107`) não usa `editalJaProcessado`. Seleciona só editais com `statusAnalise` `pendente` ou nulo, o que evita reanálise dos já processados. Editais com `erro` nunca são retentados pela fila.
- A tabela `analise_ia` tem `edital_id` único (`lib/database/schema.ts:117`). Logo, não há duas análises por edital. Uma segunda inserção falha em vez de duplicar. Falta confirmar se o código usa upsert ou insert puro, porque isso decide se a segunda tentativa vira erro ou sobrescreve.

**Geração de projeto:**
- ❌ Síncrona. `app/api/analise-cientifica/projetos/[id]/gerar-completo/route.ts` faz `await` na busca Tavily (linha 40) e na geração pelo LLM (linha 94) e só responde ao final. Não há resposta 202, não há `maxDuration` e não há retomada.

---

## 2. Plano

### Fase 1: recuperação na subida e no caminho manual
- Chamar `encerrarOrfaos` na inicialização do worker e do web (`instrumentation.ts`).
- Adicionar heartbeat à varredura manual, usando a mesma tabela `jobs` (ou `buscas_editais`, se o modelo for mantido). Com isso, o limite de 2 horas é trocado por 5 minutos.

### Fase 2: varredura manual pela fila
- A rota `POST /api/editais/busca` passa a só enfileirar (202, com `jobId`) e o worker executa. Reaproveita `enfileirarVarredura` (`lib/jobs/enfileirar.ts`).
- O botão passa a consultar o andamento pelo `jobId`, o que já conversa com o plano de progresso no Postgres (`docs/12-multi-instancia/01-plano-estado-em-memoria.md`).
- Efeito: o serviço web deixa de executar varreduras, e um redeploy não mata mais a busca.

### Fase 3: fila com `SKIP LOCKED`
- Trocar o SELECT + UPDATE de `reivindicarProximoPendente` por `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1` dentro de uma transação, seguido do UPDATE para `rodando`.
- Só vale a pena quando houver mais de um job em paralelo. Com o índice único parcial atual, o ganho é pequeno. Decidir se o paralelismo entra no roadmap antes de mexer.

### Fase 4: idempotência explícita
- Aplicar `editalJaProcessado` também em `processarFilaDeEditais`, em vez de depender só de `statusAnalise`.
- A unicidade por edital já existe em `analise_ia.edital_id`. Falta padronizar a escrita com `ON CONFLICT (edital_id) DO UPDATE` (ou `DO NOTHING`), para que reprocessar não gere erro nem duplicata.
- Decidir se editais com `erro` entram na fila de retentativa, com limite de tentativas.
- Antes de qualquer reanálise, checar se já existe resultado para a mesma versão do PDF e do prompt. Esse ponto evita cobrar IA de novo.

### Fase 5: geração de projeto assíncrona
- A rota `gerar-completo` cria um registro de geração com status (`pendente`, `gerando`, `pronto`, `erro`) e responde 202 com o id.
- A geração roda no worker, como um job do tipo `geracao_projeto`.
- A tela consulta o status por polling e, ao ficar pronta, carrega o resultado.
- Retomada: se o job falhar, fica em `erro` com a fase em que parou. O usuário pode reenfileirar, e as etapas já concluídas (ex.: busca Tavily) não são refeitas se o resultado estiver salvo.

### Fase 6: validação
- Matar o processo do worker no meio de uma varredura e confirmar que o órfão é encerrado em até 5 minutos e que a próxima varredura inicia sem 409 ou 429.
- Matar o web no meio da geração de projeto e confirmar que o job reaparece como erro e é reenfileirado com sucesso.
- Reenfileirar uma varredura e confirmar que nenhum edital é baixado nem analisado de novo.

---

## 3. Ordem sugerida

1. Fase 1 (recuperação na subida e heartbeat manual): pequena e reduz o sintoma já relatado.
2. Fase 2 (varredura manual pela fila): elimina a causa, mas depende da Fase 1.
3. Fase 5 (geração assíncrona): independente, pode ser feita em paralelo.
4. Fase 4 (idempotência): verificar antes de decidir o escopo.
5. Fase 3 (`SKIP LOCKED`): só se houver paralelismo planejado.

## 4. Decisões em aberto

- Manter a varredura manual com limite de 2 por semana, como está hoje?
- A geração de projeto deve entrar na mesma fila de jobs ou ter tabela própria?
- Quanto tempo sem heartbeat é aceitável para um job de IA com chamadas longas? O plano assume 5 minutos, com heartbeat a cada 30 s.
- Editais com `erro` devem ser retentados automaticamente? Se sim, com quantas tentativas?

---

**Status:** planejado, não iniciado.
