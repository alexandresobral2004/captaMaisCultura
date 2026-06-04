# CAPTAMAIS PROJECT EXPLORATION - COMPLETE SUMMARY

> **📍 Localização:** `docs/09-guias-referencias/04-exploration-summary.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)
> **📌 Origem:** Consolidado de `EXPLORATION_SUMMARY.txt`

> This exploration has analyzed the CaptaMais edital (public grant) scanning and AI analysis system to understand:
> 1. Current search flows and portal integrations
> 2. PDF analysis triggers and storage
> 3. Token consumption and waste points
> 4. Classification/detection systems
> 5. Storage architecture

---

## KEY FINDINGS

### CURRENT SYSTEM STATE
- 147 editais in database
- 102 analyzed with AI (69%)
- 106 PDF files downloaded
- 5 government portals scanned
- 99 editais with content from HTML pages (67% of database)

### TOKEN CONSUMPTION PROBLEM
- ~2.1M tokens per week consumed
- 99% of tokens spent on PDF analysis phase
- 7 sequential API calls per edital (major bottleneck)
- No text summarization before analysis (20K input tokens per call)
- Potential for 71% reduction (2.1M → 0.6M tokens/week)

### SYSTEM ARCHITECTURE
```
Entry Point: POST /api/editais/busca OR weekly scheduled scan
  ↓
Phase 1: Search 5 portals (Prosas, FINEP, CNPq, CAPES, Min. Ciência)
  ↓
Phase 2: Classify with OpenAI (15K tokens/week)
  ↓
Phase 3: Download PDFs (3-tier fallback: S3 → Link → HTML)
  ↓
Phase 4: Analyze with AI (2.1M tokens/week) ⚠️ BOTTLENECK
  ↓
Phase 5: Create notifications and await human review
```

---

## DOCUMENTATION FILES CREATED

### 1. Architecture Summary (415 lines)
- Complete system overview
- Search flows (5 portals)
- PDF analysis triggers (3-tier fallback)
- Classification system (3 layers)
- Storage structure
- API endpoints
- Detailed tables and statistics

Localização atual: [`../02-arquitetura/01-architecture-summary.md`](../02-arquitetura/01-architecture-summary.md)

### 2. Token Waste Analysis (288 lines)
- Detailed breakdown of token consumption
- 5 major waste points identified
- 7 optimization strategies with code examples
- Impact projections (90% reduction possible)
- Implementation priority roadmap

Localização atual: [`../08-testes-analise/03-token-waste-analysis.md`](../08-testes-analise/03-token-waste-analysis.md)

### 3. Quick Reference
- Visual system architecture diagram
- Key statistics and metrics
- File structure guide
- Classification system overview
- Top 5 token waste issues table
- Common issues and solutions

Localização atual: [`../01-introducao/03-quick-reference.md`](../01-introducao/03-quick-reference.md)

### 4. README Exploration
- Navigation guide for different audiences
- "I have 5 minutes" / "I want visuals" / "I need design" / "I need to optimize" paths

Localização atual: [`02-readme-exploracao.md`](02-readme-exploracao.md)

---

## SEARCH FLOW SUMMARY

### PORTALS SCANNED (in order)
1. **Prosas** - Session-based auth, ~20-50 editais per week
2. **FINEP** - RSS feed, innovation/tech focused
3. **CNPq** - HTML scraping, research grants
4. **CAPES** - HTML scraping, academic grants
5. **Ministério da Ciência** - HTML scraping, science events

### FLOW (per portal)
1. Authenticate (if needed)
2. Fetch list of editais
3. For each edital, fetch details
4. Validate against whitelist/blacklist
5. Call OpenAI for classification
6. Save to database

---

## PDF ANALYSIS TRIGGERS

### Manual/API
- `POST /api/editais/busca` — immediate analysis
- `POST /api/editais/analisar` — analyze specific or all pending

### Scheduled
- Worker background (every 30 min)
- Weekly scan (Monday 08:00)

### Three-Tier Fallback
1. S3 pre-signed URL (~30% success)
2. External link to PDF (~65% success)
3. HTML description fallback (~99% success)

---

## TOKEN WASTE: TOP 5 ISSUES

| # | Issue | Cost | Frequency | Total/Week |
|---|-------|------|-----------|-----------|
| 1 | 7 sequential analyzer calls | 100K | 102 editais | 2.1M |
| 2 | Full text to each prompt | 20K | per call | 2.1M |
| 3 | Classify before PDF | 600 | 25 editais | 15K |
| 4 | Whitelist + OpenAI double | 800 | 8 items | 6.4K |
| 5 | HTML page analysis | varies | 99 editais | varies |

---

## OPTIMIZATION ROADMAP

### Phase 1 (Quick Wins - 1 week)
- Cache classification (30 days)
- Skip OpenAI if whitelist > 90%
- Skip pre-validated portals

**Savings: ~27K tokens/week**

### Phase 2 (Medium Impact - 2-3 weeks)
- Combine 7 → 3 parallel calls
- Summarize PDFs > 30K chars

**Savings: ~3.1M tokens/week (71% combined reduction)**

### Phase 3 (High Impact - 1 month)
- Skip analysis for confidence < 50%
- Batch API for classification

**Savings: ~3.4M tokens/week (85% combined reduction)**

---

## STORAGE ARCHITECTURE

### Current (JSON)
```
data/
├── editais.json     (461 KB, 147 editais)
├── downloads/        (106 PDF files)
├── prosas-session.json
├── portais-config.json
└── notificacoes/
```

### New (SQLite)
```
data/
├── db/
│   └── editais.db   (SQLite + Drizzle + FTS5)
├── downloads/
└── ...
```

### Tables (15)
- editais (50+ columns)
- analise_ia
- analise_requisitos
- analise_itens_financiaveis
- analise_documentos
- analise_criterios
- analise_pontos_fracos
- palavras_chave
- arquivos_anexos
- motivos_pontuacao
- usuarios
- projetos
- areas_tematicas
- tipos_proponente
- + editais_fts (FTS5 virtual)

---

## CLASSIFICATION SYSTEM (3 LAYERS)

### Layer 1: Whitelist/Blacklist (FREE)
- 140+ technology keywords
- 130+ institution keywords
- 35+ non-TI keywords
- ~80% of non-TI filtered here

### Layer 2: OpenAI Classification (PAID - 600 tokens)
- Called when whitelist uncertain
- Validates isEdital (confidence >= 70%)
- Permissive fallback if timeout

### Layer 3: Full Content Analysis (PAID - 5-8K tokens)
- 7 specialized extractions
- Date, value, eligibility, documents, criteria, summary, validation
- Confidence per field

---

## RECOMMENDATIONS

### Immediate (Today)
- [ ] Implement classification cache
- [ ] Add whitelist threshold for OpenAI skip
- [ ] Fix sequential processing (parallelize)

### This Week
- [ ] Combine analyzer calls to 3 parallel
- [ ] Add PDF text summarization

### This Month
- [ ] Implement Batch API
- [ ] Add confidence-based skip logic

### Quarterly
- [ ] Monitor actual vs projected savings
- [ ] A/B test summary lengths
- [ ] Train custom model

---

## 📚 Documentação Relacionada

- **README Exploration (EN):** [`02-readme-exploracao.md`](02-readme-exploracao.md)
- **Resumo Exploração (PT-BR):** [`03-resumo-exploracao.md`](03-resumo-exploracao.md)
- **Architecture Summary:** [`../02-arquitetura/01-architecture-summary.md`](../02-arquitetura/01-architecture-summary.md)
- **Token Waste Analysis:** [`../08-testes-analise/03-token-waste-analysis.md`](../08-testes-analise/03-token-waste-analysis.md)
- **Quick Reference:** [`../01-introducao/03-quick-reference.md`](../01-introducao/03-quick-reference.md)
