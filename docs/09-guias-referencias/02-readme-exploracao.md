# CaptaMais Project Exploration - Complete Documentation

> **📍 Localização:** `docs/09-guias-referencias/02-readme-exploracao.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

> Comprehensive analysis of the edital (public grant) scanning and AI analysis system

## Quick Start - Choose Your Reading Path

### 🎯 I have 5 minutes
Read: [`04-exploration-summary.md`](04-exploration-summary.md)
- High-level overview
- Key findings
- Quick statistics
- Navigation guide

### 📊 I want visual overviews
Read: [`../01-introducao/03-quick-reference.md`](../01-introducao/03-quick-reference.md)
- System architecture diagram
- Key statistics table
- File structure guide
- Common issues & solutions

### 🏗️ I need to understand the design
Read: [`../02-arquitetura/01-architecture-summary.md`](../02-arquitetura/01-architecture-summary.md)
- Complete system architecture
- Detailed search flows
- PDF analysis strategies
- Classification system
- Storage structure
- API endpoints

### 💰 I need to optimize token usage
Read: [`../08-testes-analise/03-token-waste-analysis.md`](../08-testes-analise/03-token-waste-analysis.md)
- Token consumption breakdown
- 5 critical waste points
- 7 optimization strategies with code examples
- Implementation priority roadmap
- Impact projections

---

## What This Project Does

**CaptaMais** is a sophisticated web scraping and AI analysis system that:

1. **Scans 5 Brazilian Government Portals** for public grants (editais)
   - Prosas (authenticated)
   - FINEP (RSS feed)
   - CNPq (HTML scraping)
   - CAPES (HTML scraping)
   - Ministério da Ciência (HTML scraping)

2. **Downloads PDFs** using intelligent 3-tier fallback
   - Strategy 1: S3 pre-signed URLs (30% success)
   - Strategy 2: External links (65% success)
   - Strategy 3: HTML fallback (99% success)

3. **Analyzes Content** using OpenAI with 7 specialized prompts
   - Extract dates, financial values, eligibility requirements
   - Extract required documents, evaluation criteria
   - Generate summaries and validate consistency

4. **Classifies Editais** by technology focus and relevance
   - 17 technology categories
   - 3-layer classification system
   - Confidence scoring per field

5. **Stores Results** in JSON database for human review
   - 147 editais currently analyzed
   - 102 fully processed (69%)
   - Metadata and analysis results stored

---

## Current System State

### Database Statistics
```
Total Editals: 147
├─ Analyzed:           102 (69%)
├─ Pending Analysis:    36 (24%)
├─ No Content:           5 (3%)
```

### Token Consumption (Weekly)
```
~2.1M tokens per week consumed
├─ 99% on PDF analysis phase
├─ 7 sequential API calls per edital
└─ Potential for 71% reduction (2.1M → 0.6M)
```

### Storage
- 147 editais in `editais.json` (461 KB)
- 106 PDF files in `data/downloads/`
- SQLite database for production (`data/db/editais.db`)

---

## 📚 Documentação Completa

Para a documentação completa, consulte o [`00-INDICE.md`](../00-INDICE.md).

### Documentos Criados na Exploração Original
1. **Architecture Summary** — [`../02-arquitetura/01-architecture-summary.md`](../02-arquitetura/01-architecture-summary.md) (415 linhas)
2. **Token Waste Analysis** — [`../08-testes-analise/03-token-waste-analysis.md`](../08-testes-analise/03-token-waste-analysis.md) (288 linhas)
3. **Quick Reference** — [`../01-introducao/03-quick-reference.md`](../01-introducao/03-quick-reference.md)
4. **Exploration Summary** — [`04-exploration-summary.md`](04-exploration-summary.md) (este arquivo)
5. **README Exploration** — este arquivo

---

## 📚 Documentação Relacionada

- **Quick Reference:** [`../01-introducao/03-quick-reference.md`](../01-introducao/03-quick-reference.md)
- **Architecture Summary:** [`../02-arquitetura/01-architecture-summary.md`](../02-arquitetura/01-architecture-summary.md)
- **Token Waste Analysis:** [`../08-testes-analise/03-token-waste-analysis.md`](../08-testes-analise/03-token-waste-analysis.md)
- **Exploration Summary:** [`04-exploration-summary.md`](04-exploration-summary.md)
- **Resumo da Exploração (PT-BR):** [`03-resumo-exploracao.md`](03-resumo-exploracao.md)
