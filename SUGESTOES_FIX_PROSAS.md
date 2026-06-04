# SUGESTÕES DE FIX - buscarEditaisProsas()

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

**Problema:** Sessão pode estar expirada (12+ horas), função continua usando-a
**Localização:** Linhas 13-27 (carregarSessaoSalva)

```typescript
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 horas

function carregarSessaoSalva(): string[] | null {
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const data = fs.readFileSync(SESSION_FILE, 'utf8');
      const session = JSON.parse(data);
      
      // ✨ NOVO: Verificar expiração
      if (session && session.dataGeracao) {
        const sessionAge = Date.now() - new Date(session.dataGeracao).getTime();
        if (sessionAge > SESSION_MAX_AGE_MS) {
          console.warn(`[PROSAS] Sessão expirada (${(sessionAge / 60000).toFixed(0)} min atrás). Forçando re-autenticação.`);
          return null;
        }
        console.log(`[PROSAS] Sessão reutilizada (${(sessionAge / 60000).toFixed(0)} min atrás)`);
      }
      
      if (session && session.cookies && Array.isArray(session.cookies)) {
        return session.cookies;
      }
    } catch (e) {
      console.error('Erro ao ler sessão Prosas:', e);
    }
  }
  return null;
}
```

---

## FIX 3: Remover Limite de 10 Páginas (ou fazer configurável)

**Problema:** Hard-coded limit de 10 páginas, máximo 500 editais
**Localização:** Linhas 180-186

```typescript
// ANTES:
const totalPaginas = Math.min(Number.isFinite(totalPaginasDetectadas) ? totalPaginasDetectadas : 1, 10);

if (totalPaginasDetectadas > 10) {
  console.warn(`📄 [PROSAS] Total de páginas (${totalPaginasDetectadas}) acima do limite. Processando primeiras ${totalPaginas}.`);
}

// DEPOIS:
const MAX_PAGINAS = process.env.PROSAS_MAX_PAGES ? parseInt(process.env.PROSAS_MAX_PAGES) : totalPaginasDetectadas;
const totalPaginas = Math.min(Number.isFinite(totalPaginasDetectadas) ? totalPaginasDetectadas : 1, MAX_PAGINAS);

if (totalPaginasDetectadas > MAX_PAGINAS) {
  console.warn(`📄 [PROSAS] Total de páginas (${totalPaginasDetectadas}) acima do limite. Processando ${totalPaginas}.`);
  console.warn(`📄 [PROSAS] Para processar todas, set PROSAS_MAX_PAGES=${totalPaginasDetectadas} ou 0 para ilimitado`);
}
```

---

## FIX 4: Implementar Backoff Exponencial para Rate Limiting

**Problema:** Delay fixo de 500ms, sem detecção de 429 (Too Many Requests)
**Localização:** Linhas 207, 385 e novo tratamento de erro

```typescript
// ADICIONAR no topo da função
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 500;

// CRIAR função helper:
async function fazerRequisicaoComRetry(
  url: string,
  config: any,
  retryCount = 0
): Promise<any> {
  try {
    const response = await axios.get(url, config);
    return response;
  } catch (error: any) {
    if (error.response?.status === 429 && retryCount < MAX_RETRIES) {
      const delayMs = INITIAL_DELAY_MS * Math.pow(2, retryCount); // 500ms, 1s, 2s
      console.warn(`[PROSAS] Rate limited! Aguardando ${delayMs}ms antes de retry ${retryCount + 1}/${MAX_RETRIES}...`);
      await new Promise(res => setTimeout(res, delayMs));
      return fazerRequisicaoComRetry(url, config, retryCount + 1);
    }
    throw error;
  }
}

// USAR nas requisições de paginação:
const proxPagina = await fazerRequisicaoComRetry(
  'https://prosas.com.br/selecao/api/v2/third_party/oportunidades/inscricoes_abertas',
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    },
    params: {
      'include': 'area_interesses,incentivador',
      'page[page]': pagina,
      'page[size]': 50
    }
  }
);
```

---

## FIX 5: Paralelizar Requisições de Detalhe

**Problema:** 500 editais × 30s sequencial = 4+ horas
**Localização:** Linhas 217-392

```typescript
// ANTES: Loop sequencial
for (let idx = 0; idx < todasAsPaginas.length; idx++) {
  try {
    // ... busca detalhe ...
  }
}

// DEPOIS: Paralelização com limite de concorrência
const MAX_CONCURRENT = 5; // máximo 5 requisições simultâneas
const buscarDetalheEdital = async (item: any, idx: number): Promise<Edital | null> => {
  try {
    // ... mesmo código de busca de detalhe ...
    return edital;
  } catch (err) {
    console.warn(`  [${idx + 1}/${todasAsPaginas.length}] ⚠️ Erro ao buscar detalhe: ${err.message}`);
    return null;
  }
};

// Criar chunks de requisições
const chunks = [];
for (let i = 0; i < todasAsPaginas.length; i += MAX_CONCURRENT) {
  chunks.push(todasAsPaginas.slice(i, i + MAX_CONCURRENT).map((item, j) => 
    buscarDetalheEdital(item, i + j)
  ));
}

console.log(`[PROSAS] Processando ${todasAsPaginas.length} editais em ${chunks.length} lotes paralelos (MAX_CONCURRENT=${MAX_CONCURRENT})`);

for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
  const resultados = await Promise.all(chunks[chunkIdx]);
  totalEditais.push(...resultados.filter(e => e !== null));
  console.log(`[PROSAS] Lote ${chunkIdx + 1}/${chunks.length} processado`);
  // Aguardar entre lotes para não sobrecarregar
  await new Promise(res => setTimeout(res, 1000));
}
```

---

## FIX 6: Cache de Token OAuth2

**Problema:** Novo token para cada requisição, token dura 1 hora
**Localização:** Linhas 136-146

```typescript
// ADICIONAR no topo do arquivo
interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedTokenData: CachedToken | null = null;
const TOKEN_LIFETIME_MS = 55 * 60 * 1000; // 55 minutos (token dura 1h, cache 55m para segurança)

// SUBSTITUIR a obtenção de token:
// ANTES:
let token: string;
try {
  const tokenRes = await axios.post('https://prosas.com.br/auth/oauth2/token', {...});
  token = tokenRes.data.access_token;
}

// DEPOIS:
let token: string;
if (cachedTokenData && cachedTokenData.expiresAt > Date.now()) {
  console.log('[PROSAS] Reutilizando token em cache...');
  token = cachedTokenData.token;
} else {
  console.log('[PROSAS] Obtendo novo token OAuth2...');
  try {
    const tokenRes = await axios.post('https://prosas.com.br/auth/oauth2/token', {
      grant_type: 'client_credentials',
      client_id: 'lsf6jeu7-Wk04P2iSYMdcMhPZUNZqabK8CG6mAfRQ6M',
      scope: 'public'
    });
    token = tokenRes.data.access_token;
    cachedTokenData = {
      token,
      expiresAt: Date.now() + TOKEN_LIFETIME_MS
    };
    console.log('[PROSAS] Token armazenado em cache (55 minutos)');
  } catch (e: any) {
    throw new Error(`[PROSAS] Falha ao obter token de acesso: ${e.message}`);
  }
}
```

---

## FIX 7: Fallback para OpenAI Indisponível

**Problema:** Se OpenAI falha, zero editais retornam
**Localização:** Linhas 325-340

```typescript
// ANTES:
let validacaoIA;
try {
  console.log(`  [${idx + 1}/${todasAsPaginas.length}] 🤖 Validando com OpenAI: ${proc.nome.substring(0, 40)}...`);
  validacaoIA = await validarComOpenAI(...);
} catch (err) {
  console.log(`  [${idx + 1}/${todasAsPaginas.length}] ⚠️ Erro OpenAI: ${(err as Error).message}`);
  continue; // ❌ Perde este edital
}

// DEPOIS:
let validacaoIA;
try {
  console.log(`  [${idx + 1}/${todasAsPaginas.length}] 🤖 Validando com OpenAI: ${proc.nome.substring(0, 40)}...`);
  validacaoIA = await validarComOpenAI(...);
} catch (err) {
  console.warn(`  [${idx + 1}/${todasAsPaginas.length}] ⚠️ Erro OpenAI (${(err as Error).message}). Usando modo degradado.`);
  
  // Modo fallback: usar apenas whitelist + blacklist
  validacaoIA = {
    válido: validacaoWhitelist.válido && passuBlacklist,
    razão: validacaoWhitelist.válido ? 'Validado por whitelist' : 'Rejeitado por whitelist',
    tecnologia: validacaoWhitelist.tecnologiaDetectada || 'Outro - TI Geral',
    tipo: 'Desconhecido',
    score: validacaoWhitelist.confidence === 'alta' ? 80 : 60,
    confiança: 50 // Confiança reduzida por falta de IA
  };
}
```

---

## FIX 8: Tratamento Robusto de ID de Edital

**Problema:** Falha silenciosa se estrutura inesperada
**Localização:** Linhas 224-233

```typescript
// ANTES:
let itemId: string | undefined;
if (item.id) {
  itemId = String(item.id).trim();
} else if (item.attributes && item.attributes.id) {
  itemId = String(item.attributes.id).trim();
}

if (!itemId) {
  console.log(`  [${idx + 1}/${todasAsPaginas.length}] ⚠️ ID não encontrado na estrutura:`, Object.keys(item).slice(0, 5));
  continue;
}

// DEPOIS:
let itemId: string | undefined;
if (item.id) {
  itemId = String(item.id).trim();
} else if (item.attributes?.id) {
  itemId = String(item.attributes.id).trim();
}

if (!itemId) {
  console.error(`  [${idx + 1}/${todasAsPaginas.length}] ❌ ERRO: ID não encontrado!`);
  console.error(`     Estrutura recebida:`, Object.keys(item));
  console.error(`     Item completo:`, JSON.stringify(item).substring(0, 200));
  continue;
}
```

---

## FIX 9: Tratamento de Erro de Paginação com Fallback

**Problema:** Se uma página falha, continua com apenas primeira página
**Localização:** Linhas 209-211

```typescript
// ANTES:
} catch (paginationErr: any) {
  console.warn(`[PROSAS] Erro ao processar paginação: ${paginationErr.message}. Processando apenas primeira página.`);
}

// DEPOIS:
} catch (paginationErr: any) {
  console.error(`[PROSAS] Erro ao processar paginação na página ${pagina}/${totalPaginasDetectadas}:`);
  console.error(`  ${paginationErr.message}`);
  
  if (paginationErr.response?.status === 429) {
    console.warn(`[⚠️ PROSAS] Rate limit detectado. Aguardando 5 minutos...`);
    await new Promise(res => setTimeout(res, 5 * 60 * 1000));
    // Tentar novamente
    try {
      const retryRes = await axios.get(...);
      if (retryRes.data?.data) {
        todasAsPaginas = todasAsPaginas.concat(retryRes.data.data);
        console.log(`  [RETRY ${pagina}/${totalPaginasDetectadas}] ✅ Sucesso após aguardar`);
      }
    } catch (retryErr) {
      console.error(`  [RETRY] Falhou novamente. Continuando sem esta página.`);
    }
  } else {
    console.warn(`[PROSAS] Continuando sem páginas posteriores a ${pagina-1}.`);
  }
}
```

---

## CHECKLIST DE IMPLEMENTAÇÃO

- [ ] FIX 1: Adicionar debug logs (5 min)
- [ ] FIX 2: Validação de sessão com expiração (10 min)
- [ ] FIX 3: Remover limite de 10 páginas (5 min)
- [ ] FIX 4: Backoff exponencial para 429 (15 min)
- [ ] FIX 5: Paralelização de detalhes (30 min)
- [ ] FIX 6: Cache de token OAuth2 (15 min)
- [ ] FIX 7: Fallback para OpenAI (20 min)
- [ ] FIX 8: Tratamento de ID robusto (10 min)
- [ ] FIX 9: Tratamento de erro em paginação (15 min)

**Tempo Total Estimado:** ~2 horas

---

## PRIORIDADE DE IMPLEMENTAÇÃO

### 🔴 CRÍTICO (Hoje)
1. FIX 1 - Debug logs
2. FIX 2 - Validação de sessão

### 🟡 IMPORTANTE (Até amanhã)
3. FIX 7 - Fallback OpenAI
4. FIX 3 - Remover limite de páginas

### 🟢 OTIMIZAÇÃO (Semana)
5. FIX 5 - Paralelização
6. FIX 4 - Backoff exponencial
7. FIX 6 - Cache de token

---

## TESTE APÓS IMPLEMENTAÇÃO

```bash
# Executar teste com debug ativado
node scripts/teste-prosas.js

# Monitorar logs
tail -f logs/busca-editais-*.log

# Teste API Prosas diretamente
node scripts/explore-prosas-api.js
```

