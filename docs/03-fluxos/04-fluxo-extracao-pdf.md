# Fluxo de Extração de PDF e Dados

> **📍 Localização:** `docs/03-fluxos/04-fluxo-extracao-pdf.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

## 📋 Resumo

O sistema segue um fluxo claro e bem documentado de extração de PDFs:

```
BAIXAR PDF → EXTRAIR TEXTO → ARMAZENAR → USAR PARA ANÁLISE
```

## 🔄 Fluxo Detalhado

### Etapa 1: Localizar e Baixar PDF

**Arquivo:** `lib/scraper/pdf-downloader.ts`

#### Estratégia 1: PDF do S3 (Prioridade Máxima)
- URL: Amazon S3 pré-assinada
- Tempo: Muito rápido
- Confiabilidade: ✅✅✅
- Origem: campo `arquivos[]` retornado por `include=arquivos` na API V2
- Validade: 1 hora

#### Estratégia 2a: Link Direto para PDF
- URL: Arquivo `.pdf` direto no servidor
- Tempo: Rápido
- Confiabilidade: ✅✅
- Detecção: extensão `.pdf` no final da URL

#### Estratégia 2b: PDF dentro de Página Web
1. Acessa a página web
2. Busca links de PDF na página (Cheerio)
3. Download do PDF encontrado
- Tempo: Moderado
- Confiabilidade: ✅
- Fallback: extrair texto do HTML se nenhum PDF for encontrado

#### Estratégia 3: Fallback HTML
- Se nenhum PDF funcionar, usa o HTML da página
- Extrai texto do HTML (remove scripts/styles/nav)
- Tempo: Rápido
- Confiabilidade: ⚠️ (menos completo)
- Limitador: HTML > 200 caracteres

#### Sem PDF: `fonteConteudo='sem_pdf'`
- Marcador para casos onde nenhuma estratégia funcionou
- Resultado esperado: <1% dos casos

### Etapa 2: Extrair Texto do PDF

**Arquivo:** `lib/scraper/pdf-extractor.ts` + `lib/scraper/llamaparse-extractor.ts`

```typescript
// 2 estratégias (prioridade em ordem)
1. LlamaParse (cloud) — preserva tabelas e formatação Markdown
2. pdf-parse (local) — fallback offline
```

#### LlamaParse (Prioridade)
- API: LlamaCloud
- Preserva: tabelas, formatação, estrutura
- Saída: Markdown limpo
- Variável: `LLAMACLOUD_API_KEY` em `.env.local`

#### pdf-parse (Fallback)
- Biblioteca: pdf-parse (Node.js)
- Funciona: offline, sem custo
- Limitação: perde formatação de tabelas
- Limitação: PDFs escaneados (imagens) não são processados

### Etapa 3: Armazenar PDF Localmente

**Localização:** `data/downloads/edital-{id}.pdf`

```
data/
└── downloads/
    ├── edital-prosas-12345.pdf    (~500KB - 5MB)
    ├── edital-finep-67890.pdf
    ├── edital-cnpq-11111.pdf
    └── edital-sem-pdf-22222.txt  (fallback HTML)
```

**Tamanho típico:**
- PDFs reais S3: 200KB - 5MB
- PDFs externos: 100KB - 2MB
- HTML fallback: 5KB - 50KB (.txt)
- **EVITAR:** PDFs mock de 617 bytes (gera falsos positivos)

### Etapa 4: Validar Conteúdo (Keywords)

**Arquivo:** `lib/scraper/keyword-validator.ts`

```typescript
validarERegistrarConteudo(texto, editalId) → {
  score: 0-100,
  confianca: 0-100,
  densidade: number,
  motivo: string,
  categorias: {
    obrigatorios: string[],
    provaveis: string[],
    academicos: string[],
    financeiros: string[]
  }
}
```

**Categorias validadas:**
- **Mandatory** (3x peso): edital, chamada pública, processo seletivo
- **Likely** (2x peso): objetivo, financiamento, cronograma
- **Academic**: pesquisa, universidade, bolsa
- **Funding**: valor, orçamento, contrapartida
- **Eligibility**: requisitos, proponente, público-alvo
- **Submission**: inscrição, formulário, documentos
- **Timeline**: datas, prazos, calendário
- **Evaluation**: critérios, julgamento, comissão

**Threshold:** 5+ palavras-chave = edital válido

### Etapa 5: Salvar Texto Extraído

**Arquivo:** `lib/database/repositories/edital.repository.ts`

```typescript
// Campos salvos no banco
{
  conteudoCompleto: string,  // Texto extraído
  pdfPath: string,           // Caminho local
  pdfUrl: string,            // URL original (se disponível)
  fonteConteudo: 'pdf_s3' | 'pdf_link' | 'html_link' | 'descricao_api' | 'sem_pdf',
  tamanhoBytes: number,
  validacaoKeywords: { score, confianca, densidade }
}
```

### Etapa 6: Usar Texto para Análise IA

**Arquivo:** `lib/ai/analyzer.ts`

```typescript
analisarEditalComIA(editalId, textoExtraido, options) → Edital
  // Modo completo: 1 chamada OpenAI com schema Zod
  // Modo simplificado: 1 prompt mais simples (fallback)
```

**Limite:** 60.000 caracteres por análise (textos maiores são truncados)

---

## 📊 Rastreabilidade

### Campo `fonteConteudo`

```typescript
type FonteConteudo =
  | 'pdf_s3'        // PDF real do S3 (~60%)
  | 'pdf_link'      // PDF externo direto (~25%)
  | 'html_link'     // PDF dentro de página web (~5%)
  | 'descricao_api' // HTML da descrição da API (~10%)
  | 'mock'          // Mock para testes (REMOVIDO)
  | 'sem_pdf'       // Sem PDF disponível (<1%)
```

### Campo `validacaoKeywords`

```typescript
{
  score: 0-100,        // Score geral
  confianca: 0-100,    // Confiança baseada em obrigatórios
  densidade: number,   // Palavras-chave por 1000 chars
  totalPalavras: number,
  contagem: {
    obrigatorios: number,
    provaveis: number,
    academicos: number,
    financeiros: number,
    // ...
  },
  motivo: string,      // Explicação
  aprovado: boolean    // 5+ keywords?
}
```

### Campo `fonteConteudo` no JSON Salvo

```json
{
  "id": "prosas-12345",
  "titulo": "Edital de IA",
  "fonteConteudo": "pdf_s3",
  "pdfPath": "data/downloads/edital-prosas-12345.pdf",
  "tamanhoBytes": 524288,
  "validacaoKeywords": {
    "score": 85,
    "confianca": 90,
    "aprovado": true
  }
}
```

---

## 🛠️ Estratégia de Erro e Recuperação

### Erros Comuns

| Erro | Causa | Recuperação |
|------|-------|-------------|
| 404 Not Found | URL expirou ou é inválida | Tenta próxima estratégia |
| 403 Forbidden | Sem permissão | Re-autentica (Prosas) |
| Timeout 30s | PDF muito grande | Tenta com chunked download |
| PDF corrompido | Arquivo inválido | Tenta pdf-parse (fallback) |
| Sem texto extraível | PDF escaneado | Usa LlamaParse (OCR) |

### Retry Logic

```typescript
// lib/scraper/pdf-downloader.ts
async function baixarComRetry(url, maxTentativas = 3) {
  for (let i = 0; i < maxTentativas; i++) {
    try {
      return await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    } catch (err) {
      if (i === maxTentativas - 1) throw err;
      await delay(2000 * (i + 1)); // Backoff exponencial
    }
  }
}
```

---

## 📈 Métricas e Performance

### Tempos Médios

| Operação | Tempo |
|----------|-------|
| Download S3 | ~500ms |
| Download link direto | ~800ms |
| Busca PDF em página HTML | ~3s |
| Fallback HTML | ~200ms |
| Extração texto (LlamaParse) | ~2s |
| Extração texto (pdf-parse) | ~500ms |
| Validação keywords | ~50ms |

### Taxa de Sucesso por Estratégia

```
Estratégia 1 (S3):         60% ✅
Estratégia 2a (link PDF):  25% ✅
Estratégia 2b (PDF em HTML): 5% ✅
Estratégia 3 (HTML):       9% ✅
Sem PDF:                    1% ❌
```

### Tamanhos Típicos

```
PDF real S3:        200KB - 5MB
PDF externo:        100KB - 2MB
HTML fallback:      5KB - 50KB
Texto extraído:     10KB - 200KB
```

---

## 📚 Documentação Relacionada

- **Mudanças no pipeline PDF:** [`06-mudancas-pipeline.md`](06-mudancas-pipeline.md)
- **Guia rápido do pipeline PDF:** [`../01-introducao/04-guia-rapido.md`](../01-introducao/04-guia-rapido.md)
- **Análise completa:** [`02-fluxo-completo-pipeline.md`](02-fluxo-completo-pipeline.md)
- **Filtragem por keywords:** [`../05-filtragem-keywords/`](../05-filtragem-keywords/)
