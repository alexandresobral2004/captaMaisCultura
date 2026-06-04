# Token Waste Analysis & Optimization Opportunities

> **📍 Localização:** `docs/08-testes-analise/03-token-waste-analysis.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

## Token Consumption Breakdown

### Current State (Estimated):
```
Per Weekly Scan Cycle (finds ~20-50 editais):

1. Classification Phase (filtrarComClassificador)
   - 25 editais × 600 tokens/call = 15,000 tokens
   - Function: classificarSeEhEdital()
   - Happens BEFORE PDF download

2. PDF Analysis Phase (for 102 existing editais)
   - 102 editais × 7 calls × 3,000 tokens/call = ~2.1M tokens
   - Functions: 7 separate analyzer prompts
   - Text: 80,000 chars = ~20,000 tokens per prompt

3. Legacy Portal Validation (filtros-ti.ts)
   - 5-10 validarComOpenAI() calls × 800 tokens = 4,000-8,000 tokens
   - Called when whitelist finds tech keywords but before PDF

4. TOTAL PER WEEK: ~2.1M tokens (+ background runs every 30min)
```

## Main Token Waste Points

### ISSUE #1: Classification Before PDF (HIGH IMPACT)
**Location:** `fetcher.ts` line 67 + weekly-scan Phase 2
**Problem:**
- Every single edital goes through `classificarSeEhEdital()` twice
- Once during initial scrape, once during weekly scan
- Happens BEFORE checking if PDF even exists
- 600-800 tokens × 30 editais/week = 18,000-24,000 wasted tokens

**Example Flow:**
```
buscarEditaisPortais()
  ├─ Prosas finds edital
  ├─ Saves to DB
  ↓
filtrarComClassificador()
  ├─ classificarSeEhEdital() ← 600 tokens
  ├─ If valid: keep
  └─ If invalid: discard
```

### ISSUE #2: Full AI Analysis of PDFs (CRITICAL)
**Location:** `analyzer.ts` - 7 sequential calls
**Problem:**
- 7 separate API calls per edital
- Each call sends the FULL 80K char text = 20K input tokens
- Same text repeated 7 times = 140K input tokens per edital
- 102 editais × 7 × 20K = 14.3M input tokens just for analysis

### ISSUE #3: Duplicate Validation
**Location:** `filtros-ti.ts` whitelist + OpenAI
**Problem:**
- Whitelist finds keyword → OpenAI validates
- But if whitelist is highly confident, OpenAI is redundant
- Wastes 800 tokens per item

---

## Optimization Opportunities

### 1. Cache Classification Results (30 days)
**Savings:** 12,000 tokens/week
**Implementation:**
```typescript
// lib/ai/classification-cache.ts
const cache = new Map<string, ClassificacaoResult>();

async function classificarComCache(titulo, descricao) {
  const hash = hashString(`${titulo}|${descricao}`);
  if (cache.has(hash) && cache.get(hash).timestamp > Date.now() - 30*24*3600*1000) {
    return cache.get(hash).result;
  }
  // ... classificar e cachear
}
```

### 2. Skip OpenAI if Whitelist Score > 90%
**Savings:** 6,400 tokens/week
**Implementation:**
```typescript
if (whitelistScore >= 90) {
  return { aceito: true, score: 90, confianca: 90, fonte: 'whitelist' };
}
// Only call OpenAI if unsure
```

### 3. Skip Pre-validated Portals
**Savings:** 9,000 tokens/week
**Implementation:**
- FINEP, CNPq, CAPES: sempre acadêmicos/pesquisa
- Não precisam de OpenAI validation

### 4. **Combine 7 Analyzer Calls → 3 Parallel Calls** ⭐
**Savings:** 1.5M tokens/week (71% reduction)
**Implementation:**
```typescript
// ANTES: 7 sequential calls
for (const prompt of prompts) {
  await callOpenAI(prompt);
}

// DEPOIS: 3 parallel calls com schemas
const [datas, valores, elegibilidade] = await Promise.all([
  callOpenAI(promptDatas),
  callOpenAI(promptValores),
  callOpenAI(promptElegibilidade)
]);
```

### 5. Summarize PDFs > 30K chars
**Savings:** 1.6M tokens/week (75% text reduction)
**Implementation:**
```typescript
if (texto.length > 30000) {
  // Use GPT to create a 5K summary first
  const summary = await summarize(texto, 5000);
  textoParaAnalise = summary;
}
```

### 6. Skip Analysis for Confidence < 50%
**Savings:** 300,000 tokens/week
**Implementation:**
- Se whitelist + heurística < 50%, não vale analisar com IA
- Marcar como `foraDoEscopo` direto

### 7. Use OpenAI Batch API for Classification
**Savings:** 50% discount on classification
**Implementation:**
- Batch up to 100 classifications per request
- Process in 24h (não bloqueante)

---

## Implementation Priority Roadmap

### Phase 1: Quick Wins (1 semana)
1. ✅ **Cache de classificação (30 dias)** — 12K tokens salvos
2. ✅ **Skip OpenAI se whitelist > 90%** — 6.4K tokens salvos
3. ✅ **Skip portais pré-validados** — 9K tokens salvos

**Total Phase 1:** ~27K tokens salvos (~1.3% reduction)

### Phase 2: Medium Impact (2-3 semanas)
4. ⭐ **Combinar 7 chamadas em 3 paralelas** — 1.5M tokens salvos
5. ⭐ **Sumarizar PDFs > 30K chars** — 1.6M tokens salvos

**Total Phase 2:** ~3.1M tokens salvos (~71% reduction combined with Phase 1)

### Phase 3: High Impact (1 mês)
6. ⭐ **Skip análise para confidence < 50%** — 300K tokens salvos
7. ⭐ **Batch API para classificação** — 50% desconto

**Total Phase 3:** ~3.4M tokens salvos (~85% reduction vs current)

---

## Impact Projections

### Cost Reduction
- **Atual:** ~2.1M tokens/semana = ~$0.32/semana = ~$1.30/mês
- **Depois Phase 2:** ~0.6M tokens/semana = ~$0.09/semana = ~$0.40/mês
- **Depois Phase 3:** ~0.3M tokens/semana = ~$0.05/semana = ~$0.20/mês

### Performance
- **Atual:** 20-30 segundos por edital (7 sequential)
- **Depois:** 5-8 segundos por edital (3 parallel)
- **Speedup:** 4x

### Quality
- Mesma qualidade de análise
- Resumos mais focados (com summary prévio)
- Menos alucinações (texto mais limpo)

---

## Top 5 Token Waste Issues (Priority Matrix)

| # | Issue | Location | Cost | Frequency | Total/Week | Priority |
|---|-------|----------|------|-----------|-----------|----------|
| 1 | 7 sequential analyzer calls | analyzer.ts | 100K tokens | 102 editais | 2.1M | 🔴 CRITICAL |
| 2 | Full text to each prompt | analyzer.ts | 20K input tokens | per call | 2.1M | 🔴 CRITICAL |
| 3 | Classify before PDF exists | fetcher.ts | 600 tokens | 25 editais | 15K | 🟡 HIGH |
| 4 | Whitelist + OpenAI double check | filtros-ti.ts | 800 tokens | 8 items | 6.4K | 🟡 HIGH |
| 5 | HTML page analysis | pdf-downloader.ts | varies | 99 editais | varies | 🟢 MEDIUM |

---

## Recommended Action Plan

### Immediate (Today)
- [ ] Implement classification cache (30 days)
- [ ] Add threshold for OpenAI skip (whitelist >= 90%)

### This Week
- [ ] Refactor analyzer to 3 parallel calls
- [ ] Add PDF text summarization for > 30K chars

### This Month
- [ ] Implement Batch API for classification
- [ ] Add confidence-based skip logic

### Quarterly
- [ ] Monitor actual vs projected savings
- [ ] A/B test with different summary lengths
- [ ] Train custom model for classification

---

## 📚 Documentação Relacionada

- **Quick Reference (visual):** [`../01-introducao/03-quick-reference.md`](../01-introducao/03-quick-reference.md)
- **Architecture Summary:** [`../02-arquitetura/01-architecture-summary.md`](../02-arquitetura/01-architecture-summary.md)
- **Workflow test report:** [`02-workflow-test-report.md`](02-workflow-test-report.md)
