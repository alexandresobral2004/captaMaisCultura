# Plano: remover estado em memória do processo (multi-instância)

> **📍 Localização:** `docs/12-multi-instancia/01-plano-estado-em-memoria.md`
> **📅 Data:** 27/10/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)
> **🎯 Origem:** ponto de atenção do deck de arquitetura: com duas instâncias, o progresso da varredura e os logs ao vivo podem ficar invisíveis para o usuário.

---

## 1. Problema

O progresso da varredura, os logs ao vivo e alguns caches ficam na memória do processo Node. Com uma instância, funciona. Com duas, o usuário pode consultar o progresso e cair numa instância que não tem a informação.

## 2. Estado atual (verificado no código)

| Item | Onde está | Situação |
|---|---|---|
| Sessão | `lib/api/auth.ts` usa cookie `usuario_logado` assinado com HMAC (`SESSION_SECRET`) | ✅ **Resolvido.** Sem estado no servidor. Só exige a mesma `SESSION_SECRET` em todas as instâncias. |
| Controle de busca (limite de 2 por semana, "já tem busca rodando") | Tabela `buscas_editais` no Postgres (`lib/database/schema.ts:622`, `lib/scraper/controle-busca.ts`) | ✅ **Resolvido.** Já compartilhado entre instâncias. |
| Progresso da varredura | `lib/scraper/progresso-busca.ts:36` usa `globalThis.__progressoBusca`. A rota `app/api/editais/busca/progresso/route.ts` lê dali. | ❌ **Não resolvido.** Sintoma: "ociosa" ou "Calculando..." numa instância que não executa a busca. |
| Logs ao vivo | `lib/scraper/pipeline-logger.ts:22-23` guarda buffer de 200 eventos e lista de assinantes em memória. SSE em `app/api/v1/scraper/logs/stream/route.ts`. | ❌ **Não resolvido.** Logs só aparecem na instância que executa a busca. |
| Cache dos filtros | `lib/scraper/filtros/loaders.ts:21-23`. Invalidação só na instância que gravou. | ❌ **Não resolvido.** Edição de filtro em A não chega a B até reiniciar. |
| Outros caches | `lib/scraper/config.ts:22` tem TTL (razoável). `lib/triagem/cultura.ts:10` e `lib/triagem/pontuacao.ts:47` sem invalidação. | ⚠️ Verificar se são constantes do deploy ou dados editáveis. |
| Critério "nenhuma rota depende de variável global" | Sem checagem automática. | ❌ **Não adotado.** |

**Ponto adicional:** a varredura roda dentro do próprio `POST` de `app/api/editais/busca/route.ts`. Se a instância reiniciar durante a busca (por exemplo, num redeploy), a busca morre e a linha fica "em andamento" até o limite de 2 horas (`TEMPO_MAXIMO_MS` em `controle-busca.ts`).

## 3. Plano

### Fase 1: progresso para o Postgres
- Criar tabela `busca_progresso`, com uma linha por `busca_id` (FK para `buscas_editais`) e os campos de `ProgressoBusca`.
- Reescrever `progresso-busca.ts` com funções `async` que leem e gravam no banco. Remover o `globalThis`.
- Atualizar as chamadas em `app/api/editais/busca/route.ts` para `await`.
- A rota `progresso` lê a busca ativa, ou a última.
- Se o volume de escrita incomodar, agrupar atualizações (no máximo uma por segundo).

### Fase 2: logs para o Postgres
- Reaproveitar a tabela `logs_sistema` (`lib/database/schema.ts:394`), já existente, usando um canal ou `busca_id`. Não criar tabela nova.
- O `pipeline-logger` passa a gravar no banco. Remover buffer e assinantes em memória.
- O SSE lê por cursor (`id > último`) a cada 1,5 s, em vez de assinar eventos em memória.

### Fase 3: caches
- **Filtros editáveis** (`loaders.ts`): TTL curto (30 a 60 s) com recálculo ao expirar. São poucos dados. Não usar Redis agora (dependência nova).
- **Constantes de deploy** (ex.: `data/filtros/pontuacao.json`): podem ficar em cache por processo, desde que nada escreva neles. Confirmar antes.
- **`lib/database/db.ts` (`_conn`):** conexão por processo é o comportamento esperado. Fica como está.

### Fase 4: critério
- Teste automatizado que falha se aparecer `globalThis.__` ou `let` mutável em `app/` ou `lib/`, com uma lista curta de exceções explícitas.

### Fase 5: validação
- Subir duas réplicas (Railway, ou dois processos com portas diferentes localmente).
- Iniciar busca numa e consultar progresso e logs na outra.

## 4. Decisão em aberto

**Mover a execução da varredura para um worker separado.** Resolve a morte da busca em redeploy, mas é mudança maior. Recomendação: tratar depois das fases 1 a 3.

## 5. Ordem sugerida

1. Fase 1 (progresso) → 2. Fase 2 (logs) → 3. Fase 3 (caches) → 4. Fase 4 (critério) → 5. Fase 5 (validação)

---

**Status:** planejado, não iniciado.
