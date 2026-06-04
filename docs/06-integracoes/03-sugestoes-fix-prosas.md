# SUGESTÕES DE FIX - buscarEditaisProsas()

> **📍 Localização:** `docs/06-integracoes/03-sugestoes-fix-prosas.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

## FIX 1: Adicionar Debug Logs para Identificar Razão de Zero Editais

**Problema:** Teste retornou 0 editais após 70s com sucesso na autenticação
**Localização:** Linhas 164-166

```typescript
// ANTES:
if (response.data && response.data.data) {
  const processos = response.data.data;
  console.log(`[PROSAS] ${processos.length} editais retornados pela API V2. Buscando detalhes com arquivos...`);

// DEPOIS:
console.log(`[DEBUG] Response status: ${response.status}`);
console.log(`[DEBUG] Response headers: ${JSON.stringify(response.headers)}`);
console.log(`[DEBUG] Response data keys: ${Object.keys(response.data || {})}`);
console.log(`[DEBUG] Response data.data type: ${typeof response.data?.data}, length: ${response.data?.data?.length}`);

if (response.data && response.data.data && Array.isArray(response.data.data)) {
  const processos = response.data.data;
  console.log(`[PROSAS] ${processos.length} editais retornados pela API V2. Buscando detalhes com arquivos...`);

  if (processos.length === 0) {
    console.warn(`[⚠️ PROSAS] API retornou lista VAZIA! Possíveis causas:`);
    console.warn(`  1. Credenciais sem permissão para ver editais`);
    console.warn(`  2. Sessão expirada (última: ${session?.dataGeracao})`);
    console.warn(`  3. Rate limiting agressivo`);
  }
} else {
  console.error(`[❌ PROSAS] Response.data.data é inválido!`);
  console.error(`  Expected: Array, Got: ${typeof response.data?.data}`);
  console.error(`  Full response:`, JSON.stringify(response.data).substring(0, 500));
  throw new Error('API retornou resposta inesperada');
}
```

---

## FIX 2: Validação de Sessão com Expiração

**Problema:** Sessão sem timestamp de expiração, pode usar cookies de 12+ horas
**Localização:** Linhas 13-27

```typescript
// ANTES:
async function carregarSessaoSalva() {
  if (fs.existsSync(SESSION_FILE)) {
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
  }
  return null;
}

// DEPOIS:
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

async function carregarSessaoSalva() {
  if (!fs.existsSync(SESSION_FILE)) return null;

  const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));

  // Validar timestamp de expiração
  if (!session.dataGeracao) {
    console.warn('[PROSAS] Sessão sem timestamp, descartando...');
    return null;
  }

  const idade = Date.now() - new Date(session.dataGeracao).getTime();
  if (idade > SESSION_TTL_MS) {
    console.warn(`[PROSAS] Sessão expirada (${Math.round(idade / 3600000)}h), descartando...`);
    fs.unlinkSync(SESSION_FILE);
    return null;
  }

  console.log(`[PROSAS] Sessão válida (${Math.round(idade / 60000)}min de idade)`);
  return session;
}
```

---

## FIX 3: Remover Limite de 10 Páginas

**Problema:** Hard-coded em 10 páginas, perdendo 50%+ dos editais
**Localização:** Linha 180

```typescript
// ANTES:
const MAX_PAGINAS = 10;
for (let page = 1; page <= MAX_PAGINAS; page++) { ... }

// DEPOIS:
const MAX_PAGINAS = 100; // Aumentado para 5000 editais potenciais
// Ou baseado em response.meta.total:
let page = 1;
let totalPages = 1;
do {
  const response = await api.get(`/inscricoes_abertas?page[page]=${page}&page[size]=50`);
  totalPages = response.data.meta?.total_pages || 1;
  // ... processar
  page++;
} while (page <= totalPages);
```

---

## FIX 4: Backoff Exponencial para Rate Limiting

**Problema:** Delay fixo de 500ms, sem tratamento de 429
**Localização:** Linha 190

```typescript
// ANTES:
await delay(500);

// DEPOIS:
async function delayComBackoff(attempt: number = 0): Promise<void> {
  const baseDelay = 500;
  const maxDelay = 10000;
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  await new Promise(r => setTimeout(r, delay));
}

// Em caso de 429:
if (error.response?.status === 429) {
  const retryAfter = parseInt(error.response.headers['retry-after'] || '5');
  console.warn(`[PROSAS] Rate limit atingido, aguardando ${retryAfter}s...`);
  await new Promise(r => setTimeout(r, retryAfter * 1000));
  return await this.fazerRequisicao(); // retry
}
```

---

## FIX 5: Paralelizar Requisições de Detalhes

**Problema:** 500 editais × 30s = 4+ horas
**Localização:** Linhas 217-392

```typescript
// ANTES:
for (const edital of processos) {
  const detalhe = await axios.get(`/oportunidades/${edital.id}?include=arquivos,sites`);
  // ... processar
}

// DEPOIS (Promise.all com limite de concorrência):
import pLimit from 'p-limit';
const limit = pLimit(5); // 5 requisições simultâneas

const promessasDetalhes = processos.map(edital =>
  limit(async () => {
    try {
      const detalhe = await axios.get(
        `/oportunidades/${edital.id}?include=arquivos,sites`,
        { timeout: 30000 }
      );
      return mapearParaEdital(detalhe.data, edital);
    } catch (err) {
      console.warn(`[PROSAS] Erro no edital ${edital.id}: ${err.message}`);
      return null;
    }
  })
);

const editaisDetalhados = (await Promise.all(promesasDetalhes)).filter(Boolean);
console.log(`[PROSAS] ${editaisDetalhados.length}/${processos.length} editais processados em paralelo`);
```

**Resultado esperado:** 4+ horas → 30-40 minutos

---

## FIX 6: Cache de Token OAuth2

**Problema:** Token solicitado a cada execução
**Localização:** Linhas 134-146

```typescript
// lib/scraper/prosas-token-cache.ts (novo arquivo)
import fs from 'fs';

const TOKEN_CACHE_FILE = 'data/prosas-token-cache.json';
const TOKEN_TTL = 50 * 60 * 1000; // 50 minutos (token dura 1h)

export async function obterTokenComCache(clientId: string, clientSecret: string): Promise<string> {
  // Tentar cache
  if (fs.existsSync(TOKEN_CACHE_FILE)) {
    const cache = JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, 'utf-8'));
    if (cache.clientId === clientId && Date.now() - cache.timestamp < TOKEN_TTL) {
      console.log('[PROSAS] Token reutilizado do cache');
      return cache.token;
    }
  }

  // Solicitar novo
  const response = await axios.post('https://prosas.com.br/auth/oauth2/token', {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'public'
  });

  const token = response.data.access_token;
  fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify({
    clientId,
    token,
    timestamp: Date.now()
  }));

  return token;
}
```

---

## FIX 7: Fallback para OpenAI Indisponível

**Problema:** Se OpenAI falha, 0 editais retornam
**Localização:** Linhas 325-340

```typescript
// ANTES:
async function validarComOpenAI(edital) {
  // Se falhar, throw error → 0 editais
}

// DEPOIS:
async function validarComOpenAI(edital): Promise<ValidacaoResult> {
  try {
    const resultado = await openai.chat.completions.create({ ... });
    return { valido: true, score: 80, fonte: 'openai' };
  } catch (err) {
    console.warn(`[OPENAI] Falha para edital ${edital.id}: ${err.message}`);
    // FALLBACK PERMISSIVO
    return {
      valido: true,
      score: 50,
      confianca: 30,
      fonte: 'fallback_heuristica',
      motivo: 'OpenAI indisponível, usando whitelist como aprovação'
    };
  }
}
```

---

## FIX 8: Tratamento Robusto de ID de Edital

**Problema:** IDs inválidos causam 404 que não são tratados
**Localização:** Linha 217

```typescript
// ANTES:
const detalhe = await axios.get(`/oportunidades/${edital.id}?include=arquivos,sites`);

// DEPOIS:
async function buscarDetalheSeguro(id: string | number): Promise<any | null> {
  // Validar ID
  if (!id || (typeof id === 'string' && id.trim() === '')) {
    console.warn(`[PROSAS] ID inválido: ${id}`);
    return null;
  }

  try {
    const response = await axios.get(
      `/oportunidades/${id}?include=arquivos,sites`,
      { timeout: 30000 }
    );
    return response.data;
  } catch (err) {
    if (err.response?.status === 404) {
      console.warn(`[PROSAS] Edital ${id} não encontrado (404)`);
    } else if (err.response?.status === 429) {
      console.warn(`[PROSAS] Rate limit no edital ${id}`);
      await delayComBackoff(2);
      return await buscarDetalheSeguro(id); // 1 retry
    } else {
      console.error(`[PROSAS] Erro no edital ${id}: ${err.message}`);
    }
    return null;
  }
}
```

---

## FIX 9: Tratamento de Erro de Paginação

**Problema:** Se uma página falha, o loop continua mas dados são perdidos
**Localização:** Linhas 175-212

```typescript
// DEPOIS:
let sucessos = 0;
let falhas = 0;

for (let page = 1; page <= MAX_PAGINAS; page++) {
  try {
    const response = await axios.get(
      `https://prosas.com.br/selecao/api/v2/third_party/oportunidades/inscricoes_abertas?page[page]=${page}&page[size]=50`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000
      }
    );

    if (!response.data?.data || !Array.isArray(response.data.data)) {
      console.warn(`[PROSAS] Página ${page} retornou dados inválidos, parando paginação`);
      break;
    }

    processos.push(...response.data.data);
    sucessos++;

    if (response.data.data.length < 50) {
      console.log(`[PROSAS] Última página alcançada: ${page}`);
      break;
    }

    await delayComBackoff();
  } catch (err) {
    falhas++;
    console.error(`[PROSAS] Erro na página ${page}: ${err.message}`);

    if (falhas >= 3) {
      console.error(`[PROSAS] 3 falhas consecutivas, abortando paginação`);
      break;
    }

    await delayComBackoff(falhas);
  }
}

console.log(`[PROSAS] Paginação: ${sucessos} sucessos, ${falhas} falhas, ${processos.length} editais`);
```

---

## 📋 Checklist de Implementação

### Prioridade CRÍTICA (fazer primeiro)
- [ ] **FIX 1:** Adicionar debug logs (5 min)
- [ ] **FIX 2:** Validação de expiração de sessão (15 min)
- [ ] **FIX 3:** Remover limite de 10 páginas (10 min)
- [ ] **FIX 7:** Fallback OpenAI (10 min)

### Prioridade ALTA
- [ ] **FIX 4:** Backoff exponencial (20 min)
- [ ] **FIX 5:** Paralelização (30 min)
- [ ] **FIX 8:** Tratamento de ID (15 min)

### Prioridade MÉDIA
- [ ] **FIX 6:** Cache de token (20 min)
- [ ] **FIX 9:** Tratamento de paginação (20 min)

**Tempo total estimado:** ~2.5 horas

---

## 🎯 Prioridade de Implementação

```
🔴 CRÍTICO (afetam funcionalidade):
   1. FIX 1 (logs) - entender o problema
   2. FIX 7 (fallback OpenAI) - não perder editais
   3. FIX 3 (limite de páginas) - capturar 100% dos editais

🟡 ALTO (afetam performance):
   4. FIX 5 (paralelização) - 4h → 40min
   5. FIX 4 (backoff) - evitar rate limits
   6. FIX 2 (sessão) - evitar re-auths desnecessárias

🟢 MÉDIO (qualidade de código):
   7. FIX 8, 9, 6 - melhorias incrementais
```

---

## 🧪 Teste Após Implementação

```bash
# 1. Teste com logs verbosos
./scripts/buscar-editais.sh --verbose

# 2. Verificar se editais são retornados
# Esperado: 100-500 editais (não mais 0)

# 3. Verificar paralelização
# Esperado: Tempo total < 1 hora (não 4+ horas)

# 4. Verificar retry
# Simular 429: PROSAS_RATE_LIMIT=true ./scripts/buscar-editais.sh
```

---

## 📚 Documentação Relacionada

- **Análise detalhada:** [`02-analise-prosas-detalhada.md`](02-analise-prosas-detalhada.md)
- **Mapa de problemas:** [`../08-testes-analise/05-mapa-problemas-prosas.md`](../08-testes-analise/05-mapa-problemas-prosas.md)
- **Fluxo Prosas:** [`../03-fluxos/03-fluxo-prosas-completo.md`](../03-fluxos/03-fluxo-prosas-completo.md)
- **Índice de análise:** [`../08-testes-analise/04-indice-analise-prosas.md`](../08-testes-analise/04-indice-analise-prosas.md)
