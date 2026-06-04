# ANÁLISE DETALHADA: buscarEditaisProsas()

**Data da Análise:** 29 de maio de 2026
**Arquivo:** `/Users/alexandrerocha/captaMais/lib/scraper/prosas-scraper.ts`
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
| Cookies não têm timestamp de expiração | Linha 18 | MÉDIA | O código comenta que deveria verificar expiração, mas apenas tenta usar e re-autentica se falhar (reactive vs proactive) |
| Re-autenticação sem limite | Linha 122-127 | ALTA | Sem proteção contra loops infinitos de re-autenticação |
| Tratamento de 401 inadequado | Linha 124 | MÉDIA | Comenta 401 mas não há try-catch específico para 401 |
| Ordem de validação do CSRF | Linha 67-69 | BAIXA | Só adiciona authenticity_token se existir, pode falhar se token for obrigatório |

---

## 2. LOGS DE ERRO RECENTES

### 📊 Resultados dos Últimos 3 Testes

#### Teste 1: 2026-05-29 14:28:59 (142859)
- **Status:** Incompleto (truncado)
- **Erro:** Script disparou mas não completou
- **Indicador:** Server acessível, requisição iniciada

#### Teste 2: 2026-05-29 14:25:17 (142517) ✅
- **Status:** Sucesso na integração
- **Tempo Total:** 70 segundos
- **Editais Validados:** 0
- **Editais Analisados:** 0
- **Log:** ⚠️ "Nenhum log de validação encontrado"
- **Problema:** API respondeu, mas zero editais retornados

#### Teste 3: 2026-05-29 14:22:13 (142213)
- **Status:** DRY-RUN mode
- **Resultado:** Nenhuma execução real

### 🔴 Problema Crítico Encontrado

```
❌ ZERO EDITAIS RETORNADOS PELA API
- 70 segundos de resposta
- Token obtido com sucesso
- API chamada mas retorna estrutura vazia ou dados nulos
```

---

## 3. ANÁLISE DA PAGINAÇÃO

### 📄 Implementação de Paginação (Linhas 169-212)

```typescript
Configuração:
├─ Tamanho da página: 50 editais por página
├─ Limite máximo: 10 páginas
├─ Rate limiting: 500ms entre requisições
└─ Detecção de última página: via response.data.links.last

Fluxo:
1. Primeira requisição retorna links.last
2. Extrai número da página final via URL searchParams
3. Se > 10 páginas, limita a 10 e loga aviso (linha 182-184)
4. Loop de páginas 2 até totalPaginas (linha 188)
5. Concatena resultados em todasAsPaginas
```

### ⚠️ Problemas de Paginação

| Problema | Linha | Severidade | Impacto |
|----------|-------|-----------|---------|
| Limite hard-coded de 10 páginas | 180 | ALTA | Máximo 500 editais quando API pode ter mais |
| Sem tratamento de erro em paginação | 209-211 | MÉDIA | Se uma página falhar, para tudo e usa apenas primeira página |
| Delay insuficiente para rate limit | 207 | MÉDIA | 500ms pode ser insuficiente se API tem limite < 2 req/s |
| Sem validação de response.data.links | 175 | ALTA | Se links não existir, cai silenciosamente |
| Concatenação sem deduplicação | 202 | BAIXA | Se há paginação sobreposta, pode duplicar editais |

---

## 4. ANÁLISE DE REQUISIÇÕES DE DETALHE

### 🔍 Busca de Detalhes Individual (Linhas 217-392)

```
Para CADA edital retornado:
├─ Extrai itemId (com 2 estruturas possíveis: item.id ou item.attributes.id)
├─ GET /selecao/api/v2/third_party/oportunidades/{id}
├─ include: arquivos,sites
├─ timeout: 30 segundos
├─ validateStatus: 200-399
├─ Rate limit: 500ms entre requests
└─ Processa arquivos anexos e extrai PDFs do S3
```

### 🚨 Problemas Críticos Identificados

| Problema | Linha | Severidade | Descrição |
|----------|-------|-----------|-----------|
| **Falha silenciosa se estrutura inesperada** | 224-233 | 🔴 ALTA | Se itemId não encontrado, continua silenciosamente (continue line 232) |
| **Loop de validação OpenAI não tem escape** | 325-339 | 🔴 ALTA | Se OpenAI falhar em 1 edital, cai exception mas continua - sem backoff |
| **Nenhuma proteção contra timeout em massa** | 247 | 🟡 MÉDIA | Se todas as requisições demoram 30s, processamento de 500 editais = 250 minutos |
| **Sem reintenção em erro de API** | 388-390 | 🟡 MÉDIA | Um erro de rede numa requisição individual perde esse edital |
| **Memory leak potencial** | 202,217 | 🟡 MÉDIA | todasAsPaginas cresce sem limite, concatenação contínua |
| **Sem cache de tokens** | 138-146 | 🟡 MÉDIA | Novo token por requisição, deveria reutilizar por 1h |

---

## 5. PROBLEMAS DE RESPOSTA DA API

### 🔴 Principal Problema: Zero Editais Retornados

**Cenário observado (teste 2026-05-29 14:25:17):**
```
✅ Token obtido com sucesso
✅ Requisição à API completada (70 segundos)
✅ Status HTTP provavelmente 200
❌ response.data.data está vazio ou undefined
❌ Resultado final: 0 editais após 70s de processamento
```

### Possíveis Causas:

1. **API retorna resposta vazia por credenciais limitadas**
   - Email pode não ter permissão para ver editais
   - Pode estar bloqueado por IP

2. **Response structure mudou**
   - Linhas 164-165 verificam `response.data.data`
   - Se API mudou para outro formato, falha silenciosamente

3. **Rate limiting agressivo**
   - Prosas pode ter rejeitado requisição após X requests
   - Retorna 200 com body vazio como penalidade

4. **Sessão inválida em produção**
   - `prosas-session.json` de 2026-05-29T02:24:18.906Z = 12+ horas atrás
   - Session pode ter expirado

### 📋 Verificação Necessária

```javascript
// Linha 164-166 deveria ter logs mais detalhados:
if (response.data && response.data.data) {
  const processos = response.data.data;
  console.log(`[PROSAS] ${processos.length} editais...`)
}
// FALTA: Fazer log se data for undefined ou array vazio
```

---

## 6. VALIDAÇÃO COM IA (FILTROS-TI)

### 🤖 Pipeline de Validação (Linhas 310-354)

```
1. Whitelist TI (linha 313)
   └─ Busca termos técnicos em título/descrição
   └─ Se não encontrar: REJEITA (continue linha 322)

2. Validação OpenAI (linha 329)
   ├─ Chama API OpenAI
   ├─ Retorna: tecnologia, tipo, score, confiança
   └─ Se erro: REJEITA (continue linha 338)

3. Blacklist (linha 344)
   └─ Remove termos vedados
   └─ Se match: REJEITA (continue linha 353)
```

### ⚠️ Problemas na Validação

| Problema | Linha | Severidade | Impacto |
|----------|-------|-----------|---------|
| **OpenAI é sincronizador de fluxo** | 329-339 | 🔴 ALTA | Se OpenAI falha/demora, PARA todo processamento |
| **Nenhum cache de validações OpenAI** | 329 | 🟡 MÉDIA | Mesma descrição = nova chamada OpenAI |
| **Sem fallback se OpenAI indisponível** | 337 | 🔴 ALTA | Se OpenAI está offline, zero editais retornam |
| **Score OpenAI não documentado** | 374 | 🟡 MÉDIA | Qual é escala do scoreRelevancia? (0-100, 0-1?) |
| **Confiança sem threshold** | 375 | 🟡 MÉDIA | scoreConfiancaIA armazenado mas não validado |

---

## 7. RESTRIÇÕES E LIMITAÇÕES ENCONTRADAS

### Hard-coded Limits

```typescript
1. Limite de Páginas: 10 (linha 180)
   └─ Máximo 500 editais (50 por página × 10)
   └─ Prosas pode ter 1000+ editais

2. Rate Limiting: 500ms (linhas 207, 385)
   └─ 2 requisições por segundo
   └─ Para 500 editais × 30s cada detalhe = 4+ horas

3. Timeout de Detalhe: 30s (linha 247)
   └─ Se API lenta, vai falhar muitos

4. Page Size: 50 (linha 160, 197)
   └─ Fixo, não negociável
```

### Comportamento Esperado vs Atual

| Aspecto | Esperado | Atual | Diferença |
|--------|----------|-------|-----------|
| **Tempo para 500 editais** | < 10min com paginação | 4+ horas com detalhe individual | ⬆️ 40x mais lento |
| **Editais retornados** | 100-500 | 0 | ❌ Não retorna nada |
| **Recuperação de falha** | Re-autentica automaticamente | Continua com sessão antiga | ⚠️ Pode usar sessão expirada |
| **Proteção contra rate limit** | Backoff exponencial | Sleep fixo de 500ms | ⚠️ Inadequado |
| **Resiliência de paginação** | Tenta todas as páginas | Para no erro | ⚠️ Perde dados |

---

## 8. RESUMO EXECUTIVO DE PROBLEMAS

### 🔴 CRÍTICOS (Impedem funcionamento)

1. **Zero editais retornados apesar de sucesso de autenticação**
   - Teste mostrou 0 editais após 70s
   - API responde mas não retorna dados
   - Causa provável: credenciais limitadas ou sessão expirada

2. **Sem detecção de resposta vazia**
   - Código assume `response.data.data` sempre existe
   - Se vazio, silenciosamente retorna array vazio
   - Linhas 164-165 faltam validação

3. **Bloqueio em falha de OpenAI**
   - Se API OpenAI falha, zero editais retornam
   - Sem fallback ou modo de degradação
   - Linha 337: `continue` em erro simples

### 🟡 ALTOS (Degradam performance)

1. **Limite de 10 páginas é arbitrário**
   - Prosas pode ter 50+ páginas
   - Máximo 500 editais processados

2. **Rate limiting insuficiente**
   - 500ms pode ser inadequado
   - Sem detecção de 429 (Too Many Requests)
   - Sem backoff exponencial

3. **Processamento sequencial de detalhes**
   - 500 editais × 30s = 4+ horas
   - Sem paralelização

4. **Sem cache de token OAuth2**
   - Novo token para cada requisição
   - Token válido por 1h, poderia reutilizar

### 🟢 OBSERVAÇÕES

1. ✅ Estrutura geral está correta (autenticação → listagem → detalhe → validação)
2. ✅ Tratamento de cookies implementado
3. ✅ Validação com OpenAI integrada
4. ✅ Extração de PDFs do S3 implementada
5. ✅ Logs detalhados de progresso

---

## 9. RECOMENDAÇÕES

### Imediato (Fix agora)

1. **Adicionar logs de debug:**
   ```typescript
   // Linha 164-165, adicionar:
   console.log(`[DEBUG] response.status: ${response.status}`);
   console.log(`[DEBUG] response.data keys: ${Object.keys(response.data || {})}`);
   console.log(`[DEBUG] response.data.data: ${JSON.stringify(response.data?.data).substring(0, 100)}`);
   ```

2. **Verificar sessão expirada:**
   ```typescript
   // Linha 13-27, adicionar verificação de timestamp
   const MAX_SESSION_AGE_MS = 12 * 60 * 60 * 1000; // 12 horas
   if (sessionAgeMs > MAX_SESSION_AGE_MS) {
     console.warn('Sessão expirada, forcing re-autenticação');
     return null;
   }
   ```

3. **Adicionar tratamento para resposta vazia:**
   ```typescript
   // Após linha 164:
   if (!response.data.data || response.data.data.length === 0) {
     throw new Error('API retornou lista vazia. Verifique permissões ou rate limit.');
   }
   ```

### Curto Prazo (1-2 dias)

1. **Aumentar limite de páginas dinamicamente:**
   - Remover limite de 10, usar todas disponíveis
   - Ou fazer configurável via env var

2. **Implementar detecção de rate limiting:**
   - Checar status 429
   - Implementar backoff exponencial

3. **Paralelizar requisições de detalhe:**
   - Usar Promise.all com max concorrência de 5
   - Reduzir de 4h para ~30 minutos

4. **Cache de token OAuth2:**
   - Armazenar token com timestamp de expiração
   - Reutilizar até 1 hora

### Médio Prazo (1-2 semanas)

1. **Modo degradado se OpenAI falhar:**
   - Usar apenas whitelist/blacklist como fallback
   - Não parar processamento inteiro

2. **Retry com backoff em erros de rede**

3. **Monitoramento de performance:**
   - Logs de tempo por fase (auth, listagem, detalhe, validação)
   - Alertas se execução > 30 min

---

## CONCLUSÃO

A função `buscarEditaisProsas()` está **tecnicamente correta estruturalmente** mas tem **problemas práticos graves**:

1. **Não retorna editais** (0 em teste recente) - problema imediato
2. **Performance inadequada** - processamento sequencial é 40x mais lento que necessário
3. **Sem resiliência** - para em qualquer erro de OpenAI ou API
4. **Rate limiting inadequado** - pode ser bloqueado por Prosas

**Recomendação:** Priorizar debugging de "por que zero editais" antes de otimizações de performance.

