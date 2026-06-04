# CaptaMais Quick Reference Guide

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    ENTRY POINTS                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  POST /api/editais/busca     OR    /api/jobs/run-weekly   │
│  (Manual trigger)                  (Automated, weekly)      │
│                                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: SEARCH PORTALS (5-10 min)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  buscarEditaisPortais()                                      │
│  ├─ Prosas (authenticated session)                          │
│  ├─ FINEP (RSS feed)                                        │
│  ├─ CNPq (HTML scraping)                                    │
│  ├─ CAPES (HTML scraping)                                   │
│  └─ Ministério Ciência (HTML scraping)                      │
│                                                              │
│  Result: ~20-50 editais found                               │
│  Storage: data/editais.json                                 │
│                                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: CLASSIFY WITH IA [TOKEN WASTE POINT #1]           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  filtrarComClassificador()                                   │
│  └─ For each edital: classificarSeEhEdital()                │
│     Cost: ~600 tokens × 25 editals = 15K tokens             │
│     Check: Is this a REAL edital? (confidence >= 70%)       │
│                                                              │
│  Result: 102 editais marked "valid" or "fora_do_escopo"    │
│                                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: DOWNLOAD PDFs (3-TIER FALLBACK STRATEGY)          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  baixarELerPDFEdital()                                       │
│  ├─ Tier 1: S3 Pre-signed URL (success: ~30%)               │
│  ├─ Tier 2: External Link (success: ~65%)                   │
│  │          ├─ If .pdf → download direct                    │
│  │          └─ If HTML → search for PDF inside             │
│  └─ Tier 3: API Description HTML (success: ~99%)            │
│                                                              │
│  Result: 106 PDFs saved + text extracted                    │
│  Storage: data/downloads/edital-{id}.pdf                    │
│  Content Sources: 67% HTML, 30% PDF, 3% API                 │
│                                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 4: ANALYZE WITH AI [TOKEN WASTE POINT #2 - BIGGEST]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  analisarEditalComIA()                                       │
│  ├─ Split text into chunks (max 80K chars)                  │
│  ├─ Call 1: Extract dates (~400 tokens)                     │
│  ├─ Call 2: Extract financial values (~400 tokens)          │
│  ├─ Call 3: Extract eligibility (~800 tokens)               │
│  ├─ Call 4: Extract documents (~600 tokens)                 │
│  ├─ Call 5: Extract criteria (~600 tokens)                  │
│  ├─ Call 6: Generate summary (~600 tokens)                  │
│  └─ Call 7: Validate consistency (~400 tokens)              │
│                                                              │
│  Cost per edital: ~5,000-8,000 tokens                       │
│  Total done: 102 editals                                    │
│  Total wasted: ~57M tokens (could be 71% reduced)           │
│                                                              │
│  Output fields set:                                         │
│  ├─ analiseIA: {resumo, objetivo, requisitos, ...}         │
│  ├─ statusAnalise: "analisado"                              │
│  ├─ statusRevisao: "pendente" (awaiting human review)       │
│  └─ confiancaPorCampo: {field: confidence_score}            │
│                                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 5: CREATE NOTIFICATION                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Save notification file (data/notificacoes/{uuid}.json)      │
│  Alert: New editals await human review                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Statistics

### Current Database State
```
Total Editals: 147

By Status:
  102 (69%)  analisado      (fully analyzed with AI)
   36 (24%)  pdf_baixado    (PDF downloaded, awaiting analysis)
    4 (3%)   pendente       (waiting for PDF download)
    5 (3%)   sem_pdf        (no PDF/content found)

By Content Source:
   99 (67%)  html_link      (content extracted from HTML pages)
   43 (29%)  null/unknown   (missing source info)
    5 (3%)   sem_pdf        (no content available)

Stored PDFs: 106 files in data/downloads/
File Sizes: editais.json = 461 KB
```

### Token Consumption (Weekly)

| Phase | Calls/Week | Tokens/Call | Total Tokens | % of Total |
|-------|-----------|-------------|--------------|-----------|
| Classification | 25 | 600 | 15,000 | 0.7% |
| PDF Analysis | 102 × 7 | 3,000 | 2.1M | 99% |
| Legacy Validation | 8 | 800 | 6,400 | 0.3% |
| **TOTAL** | | | **~2.1M** | **100%** |

---

## File Structure

### Core API Routes
```
app/api/
├── editais/
│   ├── busca/route.ts          (POST: manual search trigger)
│   ├── analisar/route.ts       (POST: analyze pendentes)
│   ├── notificar/route.ts      (POST: send notifications)
│   └── revisar/route.ts        (POST: review/approve editals)
└── jobs/
    └── run-weekly-scan/route.ts (GET/POST: complete pipeline)
```

### Core Libraries
```
lib/
├── scraper/
│   ├── fetcher.ts              (search 5 portals, save to DB)
│   ├── prosas-scraper.ts       (authenticated session)
│   ├── portais-finep-cnpq-capes.ts (portal-specific scrapers)
│   ├── pdf-downloader.ts       (3-tier PDF download)
│   ├── pdf-extractor.ts        (PDF text extraction)
│   ├── filtros-ti.ts           (whitelist/blacklist validation)
│   ├── pipeline.ts             (process single/batch editals)
│   ├── config.ts               (portal configuration)
│   └── worker.ts               (background scheduler)
├── ai/
│   ├── analyzer.ts             (7-call analysis pipeline)
│   ├── classifier.ts           (is-it-edital classification)
│   ├── validator.ts            (field validation)
│   └── prompts.ts              (6 specialized prompts)
├── db/
│   └── editais-store.ts        (JSON file database)
└── jobs/
    └── scheduler.ts            (cron scheduler)
```

### Data Storage
```
data/
├── editais.json                (147 editals, 461 KB)
├── downloads/                  (106 PDF files)
├── prosas-session.json         (cached authentication)
├── portais-config.json         (portal list)
└── notificacoes/              (alert files)
```

---

## Classification System

### Layer 1: Whitelist/Blacklist (FREE)
```
Input:  Edital title + description
Output: valid=true/false, confidence=alta/média/baixa

Whitelist Terms: 140+ keywords
  - Technology: software, python, ia, cloud, docker, etc.
  - Institutions: universidade, instituto federal, etc.
  - Context: pesquisa, desenvolvimento, inovação, etc.

Blacklist Terms: 35+ keywords
  - Non-TI: artes, medicina, agricultura, direito, etc.

Success Rate: ~80% of non-TI items filtered out here
```

### Layer 2: OpenAI Classification (PAID - 600 tokens)
```
Called when: Whitelist found keywords OR portal not pre-validated
Validation: Is this a REAL edital? (confidence >= 70%)
Output: 
  - isEdital: true/false
  - confianca: 0-100%
  - scoreEstrutura: dates+values score
  - scoreContexto: portal context score
  - scoreConteudo: keyword score

Fallback: If OpenAI fails/timeout → ACCEPT (permissive)
```

### Layer 3: Full Content Analysis (PAID - 5-8K tokens)
```
Called when: Edital passed classification + has content
Process: 7 sequential API calls extracting:
  1. Dates (publication, opening, deadline, result)
  2. Financial values (min, max, per unit)
  3. Eligibility (who can apply, requirements)
  4. Documents (required submission docs)
  5. Criteria (evaluation scoring)
  6. Summary (concise overview)
  7. Validation (consistency check)

Output: All extracted data + confidence per field
Status set: statusAnalise = "analisado"
```

### Technology Categories (17 total)

**TI Tradicional (11):**
- IA & Machine Learning
- Big Data & Analytics
- Cloud Computing
- Segurança & Criptografia
- DevOps & Infraestrutura
- Web & Mobile
- Blockchain & Web3
- Computação Quântica
- IoT & Sistemas Embarcados
- Data Science
- Linguagens & Compiladores

**Pesquisa & Dev (5):**
- Pesquisa Acadêmica
- Desenvolvimento de Soluções
- Inovação Tecnológica
- Educação Digital
- Transformação Digital

**Eventos (1):**
- Evento Científico

---

## Token Waste: Top 5 Issues

| # | Issue | Location | Cost | Frequency | Total/Week | Priority |
|---|-------|----------|------|-----------|-----------|----------|
| 1 | 7 sequential analyzer calls | analyzer.ts | 100K tokens | 102 editals | 2.1M | CRITICAL |
| 2 | Full text to each prompt | analyzer.ts | 20K input tokens | per call | 2.1M | CRITICAL |
| 3 | Classify before PDF exists | fetcher.ts | 600 tokens | 25 editals | 15K | HIGH |
| 4 | Whitelist + OpenAI double check | filtros-ti.ts | 800 tokens | 8 items | 6.4K | HIGH |
| 5 | HTML page analysis | pdf-downloader.ts | varies | 99 editals | varies | MEDIUM |

---

## Optimization Opportunities

### Quick Wins (5-50K tokens/week saved)
1. Cache classification 30 days → 12K tokens
2. Skip OpenAI if whitelist score > 90% → 6.4K tokens
3. Skip pre-validated portals (FINEP, CNPq) → 9K tokens

### Medium Impact (50K-500K tokens/week saved)
4. **Combine 7 calls → 3 parallel calls** → 71% reduction = 1.5M tokens saved
5. Summarize PDFs > 30K chars → 75% text reduction = 1.6M tokens saved

### High Impact (500K+ tokens/week saved)
6. Skip analysis for confidence < 50% → 300K tokens
7. Use Batch API for classification → 50% discount on classification

**Potential Reduction: 71% after combining analyzer calls (2.1M → 0.6M tokens/week)**

---

## How Edital Detection & Classification Works

### Detection Phase (funnel filter)
```
100 items found on portal
  ↓
Apply Whitelist/Blacklist
  ├─ Tech keywords? ✅
  ├─ Institution keywords? ✅
  └─ Non-TI blacklist? ❌
  ↓
~20-30 items pass (77% filtered out)
  ↓
Call OpenAI (expensive) - only if whitelist unsure
  ├─ Is it a REAL edital?
  ├─ Confidence >= 70%?
  └─ Fallback: ACCEPT if error/timeout (permissive)
  ↓
~20-25 items validated (~70-90% of those that pass)
```

### Classification Phase
```
For each validated edital:
  ├─ Assign TecnologiaFoco (17 categories)
  ├─ Assign TipoFerramenta (8 types)
  ├─ Set scoreRelevancia (0-100)
  └─ Set scoreConfiancaIA (0-100)
```

### Analysis Phase (when PDF available)
```
For each edital with content:
  ├─ Split into chunks (max 80K chars)
  ├─ Send 7 extraction calls
  ├─ Set statusAnalise = "analisado"
  ├─ Set statusRevisao = "pendente"
  └─ Wait for human review (not automated)
```

---

## Performance Metrics

### Search Performance
- 5 portals: 5-10 minutes total
- Average per portal: 1-2 minutes
- Most time: HTML parsing + PDF extraction

### Classification Performance
- Whitelist check: ~10ms per item
- OpenAI call: ~2-3 seconds
- Total per 25 items: ~75 seconds

### Analysis Performance
- 7 API calls: ~15-20 seconds total
- 102 editals: ~25-35 minutes to analyze all
- Bottleneck: Sequential calls (could parallelize)

### Storage
- Database: 147 editals in 461 KB JSON
- PDFs: 106 files × ~1-500 KB each
- Total disk: ~1-10 MB (mostly PDFs)

---

## Common Issues & Solutions

### Issue: HTML pages analyzed instead of PDFs
**Reason:** PDF not available at source or download failed
**Evidence:** 67% of content from html_link source
**Solution:** Improve PDF detection in Strategy 2b

### Issue: High token consumption
**Reason:** 7 sequential API calls per edital + no text summarization
**Solution:** Combine calls to 3 parallel + summarize long PDFs

### Issue: Duplicate classifications
**Reason:** Edit classified twice (during search + weekly scan)
**Solution:** Implement 30-day cache on classificarSeEhEdital results

### Issue: False positives (non-IT editals marked valid)
**Reason:** Permissive fallback when OpenAI fails/timeouts
**Solution:** Use stricter heuristic fallback OR skip analysis

### Issue: Manual review bottleneck
**Reason:** All 102 analyzed editals require human approval
**Solution:** Implement auto-approval for high-confidence items (90%+)

---

## Environment Configuration

### Required Variables
```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Prosas Authentication
PROSAS_EMAIL=user@example.com
PROSAS_PASSWORD=password

# Security
SCAN_TOKEN=your-secret-token-here

# Optional: Database (current: JSON file)
# DATABASE_URL=...
```

### Optional
```bash
# Budget limits
MAX_TOKENS_PER_WEEK=2000000
COST_ALERT_THRESHOLD=50

# Logging
DEBUG=true
LOG_LEVEL=info
```

---

## Next Steps for Optimization

1. Implement multi-prompt analyzer (combine 7 calls → 3)
2. Add text summarization before analysis
3. Cache classification results (30 days)
4. Skip OpenAI for high-confidence whitelist matches
5. Add parallel processing for batch operations
6. Implement cost tracking dashboard
7. Add automatic approval workflow for 90%+ confidence items

