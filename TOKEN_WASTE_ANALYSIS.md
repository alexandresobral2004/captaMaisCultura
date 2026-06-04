# Token Waste Analysis & Optimization Opportunities

## Token Consumption Breakdown

### Current State (Estimated):
```
Per Weekly Scan Cycle (finds ~20-50 editais):

1. Classification Phase (filtrarComClassificador)
   - 25 editals × 600 tokens/call = 15,000 tokens
   - Function: classificarSeEhEdital()
   - Happens BEFORE PDF download

2. PDF Analysis Phase (for 102 existing editals)
   - 102 editals × 7 calls × 3,000 tokens/call = ~2.1M tokens
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
- 600-800 tokens × 30 editals/week = 18,000-24,000 wasted tokens

**Example Flow:**
```
buscarEditaisPortais()
  ├─ Prosas finds edital
  ├─ Saves to DB
  ├─ PHASE 2: filtrarComClassificador() <- DUPLICATE CALL HERE
  │  └─ "Is it a real edital?" (already partially validated)
  └─ Result: Accept at 70%+
       └─ Phase 3: Download PDF...
            └─ Phase 4: Analyze PDF (7 more calls)
```

**Solution:** Cache classification for 30 days, skip duplicate checks

### ISSUE #2: 7 Sequential Calls Per PDF (VERY HIGH IMPACT)
**Location:** `analyzer.ts` lines 86-250
**Problem:**
- Each edital analysis sends full text 7 times
- No parallel processing (sequential calls)
- No summarization before analysis
- 80,000 chars per call × 7 calls = 560K tokens total
- Happens for 102 editals = 57M tokens already spent

**Current Calls:**
```typescript
1. analisarEditalComIA()
   ├─ openai.chat.completions.create() → Extract Dates
   ├─ openai.chat.completions.create() → Extract Values
   ├─ openai.chat.completions.create() → Extract Eligibility
   ├─ openai.chat.completions.create() → Extract Documents
   ├─ openai.chat.completions.create() → Extract Criteria
   ├─ openai.chat.completions.create() → Generate Summary
   └─ openai.chat.completions.create() → Validate Consistency
```

**Solution:** Combine into 2-3 parallel calls with JSON schema

### ISSUE #3: Whitelist + OpenAI Double Validation
**Location:** `fetcher.ts` line 353-365 (legacy portal scraping)
**Problem:**
- Items from legacy portals go through:
  1. validarWhitelistTI() - free, keyword matching
  2. validarComOpenAI() - expensive, full validation
- Both check if edital is IT-relevant
- 800 tokens × 5-10 items = 4,000-8,000 tokens

**Solution:** Skip OpenAI if whitelist confidence >= 90%

### ISSUE #4: HTML Page Analysis (MEDIUM IMPACT)
**Location:** `pdf-downloader.ts` lines 212-260
**Problem:**
- When PDF not available, extracts HTML from web page
- Strategy 2b: "procurar PDF" fetches entire webpage
- Extracts 2000+ character text to use as fallback
- 99 editals use html_link source = high token content

**Solution:** Limit HTML extraction to first 1000 chars, summarize text

### ISSUE #5: Full Text to Each Prompt (HIGH IMPACT)
**Location:** All prompts in `analyzer.ts`
**Problem:**
- Text is 80,000 chars max per PDF
- ~20,000 input tokens per API call
- Sent to ALL 7 prompts with full context
- No chunking or summarization

**Example:**
```
Call 1: {text: 80,000 chars} → "Extract dates" (20K tokens in)
Call 2: {text: 80,000 chars} → "Extract values" (20K tokens in)
Call 3: {text: 80,000 chars} → "Extract eligibility" (20K tokens in)
... repeat 4 more times
```

**Solution:** 
- Summarize text to 10,000 chars before analysis
- Use gpt-4o-mini for summarization (cheaper)
- Or use Claude Haiku for preprocessing

---

## Optimization Roadmap

### Quick Wins (5,000-50,000 tokens/week saved)

**1. Cache Classification Results (30 days)**
```typescript
// Before: Every edital classified twice
// After: Check cache first

const resultado = await classificarSeEhEditalComCache(edital);

// Savings: 600 tokens × 20 duplicates = 12,000 tokens/week
```

**2. Skip OpenAI if Whitelist Confidence > 90%**
```typescript
const whitelist = validarWhitelistTI(titulo, descricao);
if (whitelist.confidence === 'alta') {
  // Skip expensive OpenAI call
  // Use heuristic fallback instead
  return heuristicClassification(edital);
}
// Savings: 800 tokens × 8 calls = 6,400 tokens/week
```

**3. Skip Classification for Pre-Validated Portals**
```typescript
// Prosas, FINEP, CNPq, CAPES are already government IT portals
// Skip classification for these
if (edital.orgao === 'FINEP' || edital.orgao === 'CNPq') {
  edital.validadoPorIA = true;
  edital.scoreConfiancaIA = 95;
  // Skip the 600-token classification call
}
// Savings: 600 tokens × 15 items = 9,000 tokens/week
```

### Medium Impact (50,000-500,000 tokens/week saved)

**4. Combine 7 Calls into 2-3 Parallel Calls**
```typescript
// Before: 7 sequential calls × 20K tokens = 140K tokens
// After: 2-3 parallel calls with shared context = 40K tokens

await Promise.all([
  // Call 1: Extract everything numeric (dates, values)
  openai.chat.completions.create({
    messages: [
      { role: 'system', content: combinePrompts(['datas', 'valores']) },
      { role: 'user', content: textoParaAnalise }
    ]
  }),
  
  // Call 2: Extract everything about people/eligibility
  openai.chat.completions.create({
    messages: [
      { role: 'system', content: combinePrompts(['elegibilidade', 'documentos']) },
      { role: 'user', content: textoParaAnalise }
    ]
  }),
  
  // Call 3: Analyze & summarize
  openai.chat.completions.create({
    messages: [
      { role: 'system', content: combinePrompts(['criterios', 'resumo']) },
      { role: 'user', content: textoParaAnalise }
    ]
  })
]);

// Savings: 102 editals × 100K tokens = 10.2M tokens already saved
// Future savings: ~71% reduction (7 calls → 3 calls)
```

**5. Summarize Long PDFs Before Analysis**
```typescript
// If PDF > 30,000 chars, summarize first with cheaper model
if (textoCompleto.length > 30000) {
  const summarizado = await summarizeWithClaude(textoCompleto);
  // Use 10K chars instead of 80K chars
  // Cost reduction: 80K → 10K = 75% less tokens
}

// Alternative: Use gpt-4o-mini (cheaper than gpt-4)
const summary = await openai.chat.completions.create({
  model: 'gpt-4o-mini',  // Already used elsewhere
  messages: [
    { role: 'user', content: `Summarize in 10,000 chars: ${textoCompleto}` }
  ]
});

// Savings: 75% per PDF analysis = 2.1M tokens/week
```

### High Impact (500K+ tokens/week saved)

**6. Skip Analysis for Low-Value Editals**
```typescript
// If classification confidence < 50% (bad match for IT)
// Don't spend 7 analysis calls
if (edital.scoreConfiancaIA < 50) {
  edital.statusAnalise = 'descartado';
  saveEdital(edital);
  return; // Skip 7 expensive calls
}

// Savings: 3-5 editals × 100K tokens = 300K-500K tokens/week
```

**7. Use Batch API for Classification**
```typescript
// Instead of:
for (edital of editais) {
  await classificarSeEhEdital(edital); // Wait for each
}

// Use Batch API:
const batch = editais.map(e => ({
  custom_id: e.id,
  method: 'POST',
  url: '/v1/chat/completions',
  body: { /* classification prompt */ }
}));

await openai.beta.batches.create({
  input_file_id: uploadedFile.id,
  endpoint: '/v1/chat/completions',
  timeout_hours: 24
});

// Cost: 50% discount vs regular API
// Savings: 600 tokens × 20 × 0.5 = 6,000 tokens/week (but takes 24h)
```

---

## Projected Impact

### Current State:
- ~2.1M tokens per week
- ~8.4M tokens per month
- Cost: ~$0.50/month (gpt-4o-mini)

### After Quick Wins (#1-3):
- Savings: ~27,400 tokens/week
- New total: ~2.07M tokens/week
- Reduction: ~1.3%

### After Medium Wins (#4-5):
- Savings: ~12.3M tokens/week (combining + summarization)
- New total: ~0.3M tokens/week
- Reduction: ~85%
- Cost: ~$0.08/month

### After High Impact (#6-7):
- Savings: Additional ~300K-500K tokens/week
- New total: ~0.2M tokens/week
- Reduction: ~90%
- Cost: ~$0.05/month

---

## Implementation Priority

1. **CRITICAL:** Combine 7 analyzer calls into 2-3 → Saves 71% immediately
2. **HIGH:** Cache classification 30 days → Quick win, simple
3. **HIGH:** Skip OpenAI if whitelist confidence > 90% → Easy implementation
4. **MEDIUM:** Summarize long PDFs → Requires Claude/extra call
5. **MEDIUM:** Skip analysis for low confidence items → Saves compute
6. **LOW:** Use Batch API → Requires async redesign
7. **LOW:** Skip pre-validated portals → Requires trust in portal lists

