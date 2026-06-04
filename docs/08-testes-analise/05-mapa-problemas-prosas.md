# 🗺️ MAPA VISUAL DOS PROBLEMAS - buscarEditaisProsas()

> **📍 Localização:** `docs/08-testes-analise/05-mapa-problemas-prosas.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)
> **📌 Origem:** Consolidado de `MAPA_PROBLEMAS_PROSAS.txt`

> Arquivo: `lib/scraper/prosas-scraper.ts` | Linhas: 425

---

## FLUXO DE EXECUÇÃO COM PROBLEMAS IDENTIFICADOS

```
INÍCIO
  │
  ├─→ [1] Carrega Sessão (Linhas 13-27)
  │       ⚠️ PROBLEMA [7]: Sem verificação de expiração
  │       └─ Pode usar sessão de 12+ horas
  │
  ├─→ [2] Se vazia, realiza Login (Linhas 43-108)
  │       ⚠️ PROBLEMA [3]: Sem limite de re-tentativas
  │       ✅ CSRF token extraído corretamente
  │       ✅ Cookies salvos em arquivo
  │
  ├─→ [3] Solicita Token OAuth2 (Linhas 134-146)
  │       ⚠️ PROBLEMA [?]: Sem cache de token
  │       ✅ Client ID configurado
  │
  ├─→ [4] GET /inscricoes_abertas (Linhas 152-162)
  │       page[page]=1, page[size]=50
  │       🔴 PROBLEMA [1]: Sem logs de resposta vazia
  │       └─ Se response.data.data = [], retorna silenciosamente
  │       └─ RESULTADO ATUAL: 0 editais (problema crítico!)
  │
  ├─→ [5] Processar Paginação (Linhas 175-212)
  │       📄 page[page]=2 até 10
  │       ⚠️ PROBLEMA [4]: Limite hard-coded de 10 páginas
  │       ⚠️ PROBLEMA [6]: Delay fixo 500ms, sem detecção de 429
  │       ⚠️ PROBLEMA [?]: Sem tratamento de erro de página
  │       └─ Se paginação falha, continua com 50 editais apenas
  │
  ├─→ [6] Para cada edital: GET /oportunidades/{id} (Linhas 217-392)
  │       include=arquivos,sites | timeout=30s
  │       🔴 PROBLEMA [5]: Processamento sequencial (4+ horas!)
  │       ⚠️ PROBLEMA [?]: Sem reintenção em erro de API
  │       └─ Se falha, edital é perdido
  │
  ├─→ [7] Validação Whitelist TI (Linhas 313-323)
  │       ✅ Se encontrar termos, continua
  │       └─ Se não encontrar, REJEITA (continue)
  │
  ├─→ [8] Validação OpenAI (Linhas 329-339)
  │       🔴 PROBLEMA [2]: Se falha, ZERO editais retornam!
  │       └─ Sem fallback ou modo degradado
  │       └─ Bloqueador total de fluxo
  │
  ├─→ [9] Validação Blacklist (Linhas 344-354)
  │       ✅ Simples regex match
  │
  └─→ FIM: Retorna totalEditais[]
       RESULTADO ESPERADO: 100-500 editais
       RESULTADO ATUAL: 0 editais ❌
```

---

## TABELA DE PROBLEMAS DETALHADOS

| # | Problema | Linha | Severidade | Impacto | Causa Raiz |
|---|----------|-------|-----------|---------|-----------|
| 1 | Sem detecção de resposta vazia | 164-165 | 🔴 CRÍTICO | 0 editais retornados | `if (response.data.data)` aceita array vazio |
| 2 | OpenAI como bloqueador | 325-340 | 🔴 CRÍTICO | 0 editais se IA falhar | Sem fallback permissivo |
| 3 | Re-autenticação sem limite | 122-127 | 🔴 CRÍTICO | Loop infinito | Sem contador de tentativas |
| 4 | Limite hard-coded 10 páginas | 180 | 🟡 ALTO | Perde 50%+ editais | Máximo 500 vs 1000+ reais |
| 5 | Processamento sequencial | 217-392 | 🟡 ALTO | 4+ horas de execução | Sem paralelização |
| 6 | Delay fixo sem 429 | 190 | 🟡 ALTO | Rate limit não tratado | Backoff fixo 500ms |
| 7 | Sessão sem expiração | 13-27 | 🟡 MÉDIO | Usa sessão vencida | Sem timestamp check |
| 8 | Token OAuth2 sem cache | 134-146 | 🟢 BAIXO | +2s por execução | Sempre solicita novo |
| 9 | Sem retry em detalhes | 217-392 | 🟡 MÉDIO | Editais perdidos | Try-catch genérico |
| 10 | Sem logging estruturado | (vários) | 🟢 BAIXO | Debug difícil | console.log soltos |

---

## MATRIZ DE IMPACTO

| Problema | Performance | Dados | Operação | Debug | Segurança |
|----------|------------|-------|----------|-------|-----------|
| [1] Resposta vazia | Baixo | 🔴 ALTO | Médio | Alto | Baixo |
| [2] OpenAI bloqueador | Baixo | 🔴 ALTO | Médio | Baixo | Baixo |
| [3] Loop re-auth | 🔴 ALTO | Baixo | 🔴 ALTO | Médio | Médio |
| [4] Limite páginas | Baixo | 🟡 MÉDIO | Baixo | Baixo | Baixo |
| [5] Processamento sequencial | 🔴 ALTO | Baixo | Baixo | Baixo | Baixo |
| [6] Delay fixo | 🟡 MÉDIO | Baixo | Baixo | Baixo | Baixo |
| [7] Sessão expirada | Baixo | 🟡 MÉDIO | 🟡 MÉDIO | Alto | 🟡 MÉDIO |
| [8] Token cache | 🟢 BAIXO | Baixo | Baixo | Baixo | Baixo |
| [9] Retry detalhes | 🟡 MÉDIO | 🟡 MÉDIO | Baixo | Baixo | Baixo |
| [10] Logging | Baixo | Baixo | Baixo | 🔴 ALTO | Baixo |

---

## ANÁLISE DE CAUSA RAIZ (Zero Editais)

```
CAUSA PRIMÁRIA: Resposta vazia não detectada
│
├─ POR QUE? Código assume response.data.data sempre populado
│
├─ POR QUE? Falta de validação defensiva
│
├─ POR QUE? Falta de testes E2E com cenários vazios
│
└─ POR QUE? Pressão para entregar rápido sem cobertura completa

CONTRIBUINTES:
├─ OpenAI falha → amplifica o problema (também bloqueia)
├─ Sessão expirada → causa autenticação sem sucesso real
└─ Rate limit → pode estar silenciando requests
```

---

## ANÁLISE DE TEMPO DE EXECUÇÃO

| Etapa | Tempo | % Total |
|-------|-------|--------|
| Carregar sessão | <100ms | <0.01% |
| Login (se necessário) | ~70s | 4.7% |
| OAuth2 token | ~2s | 0.1% |
| Listagem paginada (10 páginas) | ~5s | 0.3% |
| **Detalhes individuais (500 × 30s)** | **~4h+** | **94.7%** 🔴 |
| Validação whitelist | <1s | <0.01% |
| Validação OpenAI | ~2-3s | <0.1% |
| **TOTAL** | **~4h+** | **100%** |

**Gargalo principal:** Processamento sequencial de detalhes (94.7% do tempo)

---

## RESUMO DE AÇÕES REQUERIDAS

### 🔴 Ações Imediatas (HOJE)
1. Adicionar logs de debug (FIX 1) — 5 min
2. Validar expiração de sessão (FIX 2) — 15 min
3. Remover limite de 10 páginas (FIX 3) — 10 min
4. Fallback OpenAI (FIX 7) — 10 min

### 🟡 Ações de Curto Prazo (2 DIAS)
5. Backoff exponencial (FIX 4) — 20 min
6. Paralelização (FIX 5) — 30 min
7. Tratamento de ID (FIX 8) — 15 min

### 🟢 Ações de Médio Prazo (SEMANA)
8. Cache de token (FIX 6) — 20 min
9. Tratamento de paginação (FIX 9) — 20 min

**Tempo total estimado:** ~2.5 horas

---

## 📚 Documentação Relacionada

- **Análise detalhada:** [`../06-integracoes/02-analise-prosas-detalhada.md`](../06-integracoes/02-analise-prosas-detalhada.md)
- **Sugestões de fix:** [`../06-integracoes/03-sugestoes-fix-prosas.md`](../06-integracoes/03-sugestoes-fix-prosas.md)
- **Índice de análise:** [`04-indice-analise-prosas.md`](04-indice-analise-prosas.md)
- **Resumo da análise:** [`06-resumo-analise-prosas.md`](06-resumo-analise-prosas.md)
