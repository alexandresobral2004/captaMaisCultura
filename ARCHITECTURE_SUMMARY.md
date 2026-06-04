# CaptaMais Project Architecture Summary

## Project Overview
CaptaMais is a comprehensive edital (public grant) scanning and analysis system that searches multiple Brazilian government portals, downloads PDFs, and uses AI to extract and classify information.

**Key Statistics:**
- 147 total editais in database
- 102 analyzed with AI (69%)
- 36 PDF downloaded but pending analysis
- 99 editais with content extracted from HTML pages (67%)
- 106 PDF files downloaded to disk
- 4 active scanning portals + legacy systems

---

## 1. CURRENT SEARCH FLOW

### Primary Portals Being Scanned (in order):
1. **Prosas** (Session-based authentication)
   - Type: Authenticated web scraper
   - URL: `https://prosas.com.br`
   - Credentials: `PROSAS_EMAIL`, `PROSAS_PASSWORD` (.env)
   - Session storage: `data/prosas-session.json`
   
2. **FINEP** (Federal Innovation Agency)
   - Type: RSS feed
   - URL: `http://www.finep.gov.br/chamadas-publicas?format=feed&type=rss`
   - Category: Innovation and Technology

3. **CNPq** (National Council for Scientific and Technological Development)
   - Type: HTML scraping
   - URL: `https://www.gov.br/cnpq/pt-br/financiamento/chamadas-abertas`
   - Category: Research and Academic

4. **CAPES** (Federal Educational Foundation)
   - Type: HTML scraping
   - URL: `https://www.gov.br/capes/`
   - Category: Academic and Research

5. **Ministério da Ciência do Brasil** (Ministry of Science)
   - Type: HTML scraping
   - New integration for science and innovation

### Legacy Portals (fallback):
- FAPESP (São Paulo Research Foundation)
- BNDES (National Development Bank)
- Various FAPs (State Research Foundations)

### Search Flow (in busca/route.ts):
```
1. buscarEditaisPortais()
   ├── For each of 5 primary portals:
   │   ├── Fetch content (RSS, HTML, or authenticated)
   │   ├── Extract edital links/titles
   │   ├── Parse publication dates
   │   └── Calculate deadline (estimated if not found)
   │
   ├── For legacy portals (if no results from primary):
   │   ├── Scrape HTML pages
   │   ├── Validate with whitelist/blacklist
   │   └── Call OpenAI for validation
   │
   └── Fallback: Generate simulation data (3 test editais)

2. For each edital found:
   ├── Save to database (data/editais.json)
   ├── Mark status as "pendente" (pending)
   └── Assign technology category

3. Statistics logged:
   - Portal success/failure rates
   - Number of editais per portal
   - Time spent per portal
   - Technology distribution
```

---

## 2. HOW PDF ANALYSIS IS TRIGGERED

### Two Parallel Entry Points:

#### Entry Point 1: POST /api/editais/busca (Manual/API trigger)
```
POST /api/editais/busca
└─> buscarEditaisPortais() [5-10 min]
    └─> For each edital:
        ├─> Download PDF with 3-tier fallback
        ├─> Extract text
        └─> Analyze with AI immediately
```

#### Entry Point 2: Background Worker (runs every 30 minutes + weekly scan)
- `lib/db/editais-store.ts`: Initializes on app boot
- `lib/jobs/scheduler.ts`: Schedules weekly full scan
- `app/api/jobs/run-weekly-scan/route.ts`: Complete pipeline execution
- Processes editais with status "pendente"

### PDF Download & Extraction (baixarELerPDFEdital):
Three-tier fallback strategy in **lib/scraper/pdf-downloader.ts**:

**Strategy 1: PDF from S3 (highest priority)**
- Field: `opcoes.pdfUrlS3`
- Pre-signed URL from API
- Direct download if available
- Success rate: ~30%

**Strategy 2: External Link** (medium priority)
- Field: `opcoes.linkExterno`
- 2a: If `.pdf` extension → download directly
- 2b: If HTML page → search for PDF link inside
  - Uses multiple extraction strategies
  - Validates URLs before download
  - Falls back to HTML text extraction
- Success rate: ~65%

**Strategy 3: HTML Description** (fallback)
- Field: `opcoes.descricaoHtml`
- API-provided description
- Clean HTML to plain text
- Creates mock PDF file for records
- Success rate: ~99% (always available)

**Result Fields:**
```typescript
{
  texto: string,           // Extracted/converted text
  fonte: 'pdf_s3' | 'pdf_link' | 'html_link' | 'descricao_api' | 'sem_pdf',
  pdfUrlEncontrada?: string  // URL of found PDF
}
```

---

## 3. WHERE HTML PAGE ANALYSIS IS CONSUMING TOKENS

### Primary Token Waste Points:

#### **BIGGEST ISSUE: Validation of Non-TI Editais (filtros-ti.ts)**
**Problem:** Every edital found gets validated with OpenAI before classification
- **Function:** `validarComOpenAI()` 
- **Called from:** `fetcher.ts:353-358` (for legacy portal items)
- **Trigger:** Any item found on portals without TI keywords
- **Cost per edital:** ~500-1000 tokens
- **Frequency:** Called for ~30% of items that pass whitelist
- **Total monthly waste:** Potentially 1000s of tokens

**Why it's wasteful:**
- Whitelist check already filters ~80% of non-TI items
- OpenAI is called even for obviously non-TI items
- 10s timeout fallback still allows rejection
- Cache exists but expires in 24h

**Current Solution:** Permissive fallback
- If OpenAI timeout/error → ACCEPTS edital (score: 50, confidence: 30%)
- Creates false positives that require manual review

#### **MEDIUM ISSUE: Classification of Each Edital (classifier.ts)**
**Function:** `classificarSeEhEdital()` in weekly scan
- **Cost:** ~400-800 tokens per call
- **Called:** For every edital before PDF download
- **Happens in:** Phase 2 of `run-weekly-scan`
- **Input:** Edital title, description, URL, agency
- **Output:** Is it a real edital? (0-100 confidence)

**Processing flow:**
```
buscarEditaisPortais()  [finds ~20-50 editais]
    ↓
filtrarComClassificador()  [calls clasificarSeEhEdital 20-50x]
    ↓ [TOKENS SPENT HERE]
For each valid edital:
    ├─ Fallback heuristic if no API key
    └─ Calls OpenAI gpt-4o-mini if key exists
```

**Why wasteful:**
- Many items already validated during initial scrape
- Called again during batch processing
- Duplicate classification for same items

#### **LARGE ISSUE: Full AI Analysis of PDFs (analyzer.ts)**
**Function:** `analisarEditalComIA()`
- **Cost per edital:** ~5000-8000 tokens (7 separate API calls)
- **What it does:** 6 specialized extractions + 1 validation
- **Called for:** Each edital with content (102 done + continuous)

**Breakdown of 7 calls (each uses gpt-4o-mini):**
1. `promptExtrairDatas()` - Extract dates (~400 tokens)
2. `promptExtrairValores()` - Extract financial values (~400 tokens)
3. `promptExtrairElegibilidade()` - Eligibility requirements (~800 tokens)
4. `promptExtrairDocumentos()` - Required documents (~600 tokens)
5. `promptExtrairCriterios()` - Evaluation criteria (~600 tokens)
6. `promptExtrairResumo()` - Create summary (~600 tokens)
7. `promptValidarConsistencia()` - Validate consistency (~400 tokens)

**Text Input:** Up to 80,000 chars = ~20,000 tokens per call
- Many calls repeat on same text
- No summarization of long PDFs
- Full text sent to each prompt

---

## 4. CURRENT CLASSIFICATION SYSTEM

### Three-Layer Classification:

#### **Layer 1: Whitelist/Blacklist (filtros-ti.ts)**
- **Whitelist TI**: 140+ technology keywords
  - IA, Machine Learning, Big Data, Cloud, Security, DevOps, Web, Mobile, etc.
  - University/Institute terms (130+ variations)
  - Research & Development terms
  
- **Blacklist**: 35+ non-TI keywords
  - Arts, Medicine, Agriculture, Law, Marketing, Design, etc.
  
- **Result:** Valid=true/false, confidence=alta/média/baixa

#### **Layer 2: OpenAI IA Classification (classifier.ts)**
**Function:** `classificarSeEhEdital()`
- **Input:** Title, description (500 chars), URL, agency
- **Output:** 
  ```typescript
  {
    isEdital: boolean,           // Is it a valid edital?
    confianca: 0-100,           // Confidence %
    motivo: string,             // Explanation
    palavrasChave: string[],    // Keywords found
    scoreEstrutura: 0-100,      // Structure score (dates+values)
    scoreContexto: 0-100,       // Context score (portal)
    scoreConteudo: 0-100        // Content score (keywords)
  }
  ```

**Confidence threshold:** ≥70% required to accept

#### **Layer 3: Full Content Analysis (analyzer.ts)**
**Function:** `analisarEditalComIA()`
- Extracts 6 data types from full PDF text
- Sets field: `statusAnalise` 
  - "pendente" → waiting for download
  - "pdf_baixado" → PDF extracted, awaiting analysis
  - "analisado" → completed successfully
  - "sem_pdf" → no content found
  - "erro" → processing error
  
- Sets field: `statusRevisao`
  - "pendente" → awaiting human review
  - "aprovado" → reviewed and approved
  - "rejeitado" → reviewed and rejected

### Technology Categories (17 types):
```
TI Tradicional (11):
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

Pesquisa & Desenvolvimento (5):
- Pesquisa Acadêmica
- Desenvolvimento de Soluções
- Inovação Tecnológica
- Educação Digital
- Transformação Digital

Eventos (1):
- Evento Científico
```

### Tool Types (8 categories):
- Framework, Linguagem, Banco de Dados, IDE, Plataforma, Biblioteca, Ferramenta, Outro

---

## 5. PDF STORAGE STRUCTURE

### Download Directory:
```
data/
├── downloads/                    # 106 PDF files stored here
│   ├── edital-prosas-ABCD1234.pdf    # From Prosas portal
│   ├── edital-finep-EFGH5678.pdf     # From FINEP
│   ├── edital-cnpq-IJKL9012.pdf      # From CNPq
│   ├── edital-capes-MNOP3456.pdf     # From CAPES
│   └── edital-simulado-1.pdf         # Test/simulation data
│
├── editais.json              # Main database (147 editais)
│   └── Structure:
│       {
│         id: string,
│         titulo: string,
│         orgao: string,
│         valor: string,
│         dataLimite: "DD/MM/YYYY",
│         status: "Aberto|Prorrogado|Em Análise|Fechado",
│         descricao: string,
│         link: string,
│         pdfUrl?: string,
│         pdfSalvoEm: "data/downloads/edital-{id}.pdf",
│         
│         fonteConteudo: "pdf_s3|pdf_link|html_link|descricao_api|mock|sem_pdf",
│         
│         tecnologiaFoco: TecnologiaFoco enum,
│         tipoFerramenta: TipoFerramenta enum,
│         scoreRelevancia: 0-100,
│         scoreConfiancaIA: 0-100,
│         validadoPorIA: boolean,
│         foraDoEscopo: boolean,
│         
│         statusAnalise: "pendente|pdf_baixado|analisado|sem_pdf|descartado|erro",
│         statusRevisao: "pendente|aprovado|rejeitado",
│         analiseIA: {...},  # Extracted data
│         confiancaPorCampo: {...},
│         criadoEm: ISO datetime,
│         atualizadoEm: ISO datetime
│       }
│
├── prosas-session.json       # Cached authentication
│   └── { cookies: [...], dataGeracao: ISO datetime }
│
├── portais-config.json       # Portal configuration
│   └── List of active portals
│
└── notificacoes/             # Notification files
    └── {uuid}.json          # One per new scan event
```

### Current Database Statistics:
- **Total editais:** 147
- **Analyzed (analisado):** 102 (69%)
- **PDF downloaded pending:** 36 (24%)
- **Awaiting PDF:** 4 (3%)
- **No PDF found:** 5 (3%)

- **Content sources:**
  - HTML pages: 99 (67%)
  - Null/Unknown: 43 (29%)
  - No content: 5 (3%)

### File Sizes:
- `editais.json`: ~461 KB (9,856 lines)
- `prosas-debug.html`: ~35 KB
- PDF files: ~442 bytes each (mock PDFs, actual PDFs larger)

---

## 6. API ENDPOINTS

### Main Search Endpoint:
```
POST /api/editais/busca
├── Searches 5 portals
├── Downloads PDFs with 3-tier fallback
├── Analyzes with AI immediately
├── Returns: {
│   success: boolean,
│   mensagem: string,
│   estatisticas: {
│     totalEditaisValidos: number,
│     processados: number,
│     comErro: number,
│     tempoMinutos: number,
│     porTecnologia: {...}
│   },
│   quantidade: number,
│   editais: Edital[]
├─ }
```

### Analysis Endpoint:
```
POST /api/editais/analisar
├── analisarTodosPendentes: true → background process all pending
├── id: string → process specific edital
└── Returns: { message: string }
```

### Weekly Scan Endpoint:
```
GET /api/jobs/run-weekly-scan?token={SCAN_TOKEN}
POST /api/jobs/run-weekly-scan { token: string }
├── 5 phases:
│   1. Search portals
│   2. Classify with IA
│   3. Download PDFs
│   4. Analyze with IA
│   5. Create notifications
└── Returns: { success, estatisticas }
```

---

## SUMMARY TABLE

| Aspect | Details |
|--------|---------|
| **Portals Scanned** | 5 primary + legacy fallback (Prosas, FINEP, CNPq, CAPES, MinistrérioCiência) |
| **Total Editais** | 147 |
| **Analyzed** | 102 (69%) |
| **PDF Strategy** | 3-tier: S3 → Link → HTML |
| **Token Waste** | Validation of non-TI items, duplicate classifications |
| **Classification** | 3 layers: whitelist/blacklist → OpenAI → full analysis |
| **Tech Categories** | 17 types across TI, Research, Events |
| **Storage** | JSON database + file system PDFs |
| **Automation** | Weekly scan + 30-min background worker |
| **Content Sources** | HTML pages (67%), direct PDFs (30%), descriptions (3%) |

