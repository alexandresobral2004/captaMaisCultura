# ANÁLISE DETALHADA: buscarEditaisProsas()

> **📍 Localização:** `docs/06-integracoes/02-analise-prosas-detalhada.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

> **📌 Conteúdo mesclado de `INDICE_ANALISE_PROSAS.txt` + `RESUMO_ANALISE_PROSAS.txt` + `ANALISE_PROSAS_DETALHADA.md`**

**Data da Análise:** 29 de maio de 2026
**Arquivo:** `lib/scraper/prosas-scraper.ts`
**Versão:** Linhas 1-425

---

## 1. STATUS DE AUTENTICAÇÃO E CREDENCIAIS

### ✅ Credenciais Configuradas Corretamente
- **Email:** `alexandresobral2004@gmail.com` (configurado em `.env.local`)
- **Password:** `P@ssw0rd` (configurado em `.env.local`)
- **Verificação:** O código valida a presença de credenciais (linhas 44-49)

### 🔄 Fluxo de Autenticação (3 Etapas)

```
1. Carrega Sessão Salva (Linhas 13-27)
   └─ Arquivo: data/prosas-session.json
   └─ Status: ✅ Última geração: 2026-05-29T02:24:18.906Z

2. Se Sessão Inválida → Re-autenticação (Linhas 43-108)
   ├─ GET /users/sign_in (obter CSRF token)
   ├─ POST /users/sign_in (com formulário)
   └─ Extrai cookies de autenticação

3. Token OAuth2 (Linhas 134-146)
   ├─ POST /auth/oauth2/token (Client Credentials)
   ├─ client_id: lsf6jeu7-Wk04P2iSYMdcMhPZUNZqabK8CG6mAfRQ6M
   └─ scope: public
```

### ⚠️ Problemas de Autenticação Identificados

| Problema | Localização | Severidade | Descrição |
|----------|-------------|-----------|-----------|
| Cookies não têm timestamp de expiração | Linha 18 | MÉDIA | Reactive vs proactive |
| Re-autenticação sem limite | Linha 122-127 | ALTA | Sem proteção contra loops |
| Tratamento de 401 inadequado | Linha 124 | MÉDIA | Sem try-catch específico |
| Sessão sem validação de expiração | Linha 13-27 | MÉDIA | Pode usar sessão de 12+ horas |

---

## 2. LOGS DE ERRO RECENTES

### Análise do Teste em 2026-05-29 14:25:17

```
✅ Autenticação: Sucesso (70 segundos de resposta)
✅ Token OAuth2: Obtido com sucesso
✅ Requisição à API: Completada
❌ Resultado: 0 editais após todo o processamento
```

### Possíveis Causas

1. **Credenciais sem permissão** para ver editais
2. **Sessão expirada** (arquivo de 2026-05-29T02:24:18.906Z = 12+ horas atrás)
3. **Rate limiting agressivo** da API Prosas
4. **Estrutura de resposta da API mudou**, código não detectou

---

## 3. PROBLEMAS CRÍTICOS

### 🔴 [1] Sem detecção de resposta vazia
- **Linhas:** 164-165
- **Problema:** Código assume `response.data.data` sempre existe
- **Se vazio:** Retorna silenciosamente array vazio
- **Impacto:** Impossível diagnosticar por que zero editais

### 🔴 [2] OpenAI como bloqueador de fluxo
- **Linhas:** 325-340
- **Problema:** Se OpenAI falha, zero editais retornam
- **Sem fallback** ou modo de degradação
- **Impacto:** 1 erro de IA = perda de tudo

### 🔴 [3] Re-autenticação sem limite
- **Linhas:** 122-127
- **Problema:** Sem proteção contra loops infinitos
- **Impacto:** Pode travar em autenticação cíclica

---

## 4. PROBLEMAS ALTOS (Degradam Performance)

### 🟡 [4] Limite hard-coded de 10 páginas
- **Linhas:** 180
- **Problema:** Máximo 500 editais (50 × 10)
- **API pode ter 1000+ editais**
- **Impacto:** Perde 50% dos dados

### 🟡 [5] Processamento sequencial de detalhes
- **Linhas:** 217-392
- **Problema:** 500 editais × 30s timeout = 4+ horas
- **Sem paralelização**
- **Impacto:** Execução inviável em produção

### 🟡 [6] Delay fixo sem detecção de 429
- **Linhas:** 190
- **Problema:** 500ms fixo, sem backoff exponencial
- **Impacto:** Rate limit não tratado

### 🟡 [7] Sem verificação de expiração de sessão
- **Linhas:** 13-27
- **Problema:** Usa sessão de 12+ horas
- **Impacto:** Falhas intermitentes de autenticação

---

## 5. PROBLEMA RAIZ: Zero Editais

### Análise da Causa Raiz

```
INÍCIO
  │
  ├─→ [1] Carrega Sessão (Linhas 13-27)
  │       ⚠️ Pode usar sessão de 12+ horas
  │
  ├─→ [2] Se vazia, realiza Login (Linhas 43-108)
  │       ✅ CSRF token extraído
  │       ✅ Cookies salvos
  │
  ├─→ [3] Solicita Token OAuth2 (Linhas 134-146)
  │       ✅ Token obtido
  │
  ├─→ [4] GET /inscricoes_abertas (Linhas 152-162)
  │       page[page]=1, page[size]=50
  │       🔴 PROBLEMA [1]: Sem logs de resposta vazia
  │       └─ Se response.data.data = [], retorna silenciosamente
  │       └─ RESULTADO ATUAL: 0 editais
  │
  └─→ FIM: Retorna totalEditais[]
       RESULTADO ESPERADO: 100-500 editais
       RESULTADO ATUAL: 0 editais ❌
```

---

## 6. ANÁLISE DE TEMPO

### Tempo de Execução Atual

| Etapa | Tempo |
|-------|-------|
| Carregar sessão | <100ms |
| Login (se necessário) | ~70s |
| OAuth2 token | ~2s |
| Listagem paginada (10 páginas) | ~5s |
| Detalhes individuais (500 editais × 30s) | **~4+ horas** 🔴 |
| Validação whitelist | <1s |
| Validação OpenAI (se aplicável) | ~2-3s |
| **TOTAL** | **~4+ horas** |

### Gargalos

1. 🔴 **Processamento sequencial de detalhes** (4+ horas)
2. 🟡 Limite de 10 páginas (perde 50% dos dados)
3. 🟡 Delay fixo de 500ms

---

## 7. RESTRIÇÕES E LIMITAÇÕES

### Limitações Técnicas
- **Rate limit:** ~50 requests/min (estimado)
- **Paginação máxima:** 10 páginas hard-coded
- **Timeout:** 30s por detalhe
- **Sessão:** Expira em ~8 horas (sem validação)

### Limitações da API V2
- **Endpoint:** `/selecao/api/v2/third_party/oportunidades/inscricoes_abertas`
- **Param:** `page[page]`, `page[size]` (max 50)
- **Detalhe:** `/oportunidades/{id}?include=arquivos,sites`
- **Autenticação:** Bearer token (1h validade)

---

## 8. RESUMO EXECUTIVO DE PROBLEMAS

```
❌ ZERO EDITAIS RETORNADOS EM TESTE RECENTE (2026-05-29 14:25:17)
   └─ Autenticação: ✅ Sucesso (70 segundos)
   └─ Token OAuth2: ✅ Obtido
   └─ Requisição à API: ✅ Completada
   └─ Resultado: ❌ 0 editais

PROBLEMAS POR SEVERIDADE:
🔴 CRÍTICOS (3): [1] Resposta vazia, [2] OpenAI bloqueador, [3] Re-auth loop
🟡 ALTOS (4): [4] Limite de páginas, [5] Sequencial, [6] Delay fixo, [7] Sessão
🟢 MÉDIOS: Vários de logging e validação
```

---

## 9. RECOMENDAÇÕES TÉCNICAS

### Imediatas (Hoje)
1. Adicionar logs explícitos de resposta vazia
2. Implementar fallback quando OpenAI falha
3. Limitar tentativas de re-autenticação (max 3)

### Curto Prazo (2 dias)
1. Paralelizar requisições de detalhes (Promise.all com limite)
2. Implementar backoff exponencial
3. Adicionar cache de token OAuth2

### Médio Prazo (semana)
1. Remover limite hard-coded de 10 páginas
2. Implementar validação proativa de sessão
3. Adicionar testes E2E com mocks

---

## 📚 Documentação Relacionada

- **Sugestões de fix:** [`03-sugestoes-fix-prosas.md`](03-sugestoes-fix-prosas.md)
- **Mapa de problemas (detalhado):** [`../08-testes-analise/05-mapa-problemas-prosas.md`](../08-testes-analise/05-mapa-problemas-prosas.md)
- **Fluxo Prosas:** [`../03-fluxos/03-fluxo-prosas-completo.md`](../03-fluxos/03-fluxo-prosas-completo.md)
- **Mapa de problemas:** [`../08-testes-analise/05-mapa-problemas-prosas.md`](../08-testes-analise/05-mapa-problemas-prosas.md)
- **Índice de análise:** [`../08-testes-analise/04-indice-analise-prosas.md`](../08-testes-analise/04-indice-analise-prosas.md)
- **Resumo da análise:** [`../08-testes-analise/06-resumo-analise-prosas.md`](../08-testes-analise/06-resumo-analise-prosas.md)
