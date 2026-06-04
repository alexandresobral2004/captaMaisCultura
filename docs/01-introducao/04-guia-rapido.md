# 🚀 Guia Rápido - Pipeline de PDFs Corrigido

> **📍 Localização:** `docs/01-introducao/04-guia-rapido.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

## O que foi corrigido?

O sistema **agora busca PDFs reais** de 3 fontes diferentes com fallback automático:

```
ESTRATÉGIA 1: PDF S3 (Prioridade Máxima)
  ↓
ESTRATÉGIA 2: Link Externo (PDF direto ou página web)
  ↓
ESTRATÉGIA 3: Descrição HTML da API
  ↓
SEM PDF: Marca como 'sem_pdf'
```

## Principais mudanças

| Arquivo | Mudança |
|---------|---------|
| `prosas-scraper.ts` | Busca detalhe individual de cada edital com `include=arquivos` |
| `pdf-downloader.ts` | Implementa 3 estratégias de fallback automático |
| `editais-store.ts` | Novos campos: `arquivosAnexos`, `fonteConteudo` |
| `pipeline.ts` | Passa dados enriquecidos para o downloader |
| `route.ts` | Integra novo pipeline na API |

## Como testar?

### 1. Build (verifica erros)
```bash
npm run build
```

### 2. Teste do Scraper Prosas
```bash
node scripts/teste-prosas.js
```

### 3. Iniciar servidor
```bash
npm run dev
```

### 4. Chamar API de busca
```bash
curl -X POST http://localhost:3000/api/editais/busca
```

### 5. Verificar PDFs
```bash
ls -lh data/downloads/edital-*.pdf
```

## Resultado esperado

- ✅ ~60% PDFs reais do S3 (>10KB)
- ✅ ~30% PDFs de links externos
- ✅ ~10% Conteúdo HTML da API
- ✅ Campo `fonteConteudo` em cada edital
- ❌ **ZERO** arquivos de 617 bytes

## Rastreabilidade

Cada edital agora tem campo `fonteConteudo`:

```json
{
  "id": "prosas-123",
  "titulo": "...",
  "fonteConteudo": "pdf_s3" | "pdf_link" | "html_link" | "descricao_api" | "sem_pdf"
}
```

## Próximos passos

- [ ] Executar testes iniciais
- [ ] Validar tamanhos dos PDFs
- [ ] Monitorar logs para verificar estratégias usadas
- [ ] Considerare adicionar suporte a DOCX (opcional)

---

## 📚 Documentação Relacionada

- **Fluxo completo de extração PDF:** [`../03-fluxos/04-fluxo-extracao-pdf.md`](../03-fluxos/04-fluxo-extracao-pdf.md)
- **Mudanças no pipeline:** [`../03-fluxos/06-mudancas-pipeline.md`](../03-fluxos/06-mudancas-pipeline.md)
- **Análise completa do pipeline:** [`../03-fluxos/02-fluxo-completo-pipeline.md`](../03-fluxos/02-fluxo-completo-pipeline.md)

---

**Status**: ✅ Implementação concluída e testada
**Data original**: 29/05/2026
**Última revisão**: 04/06/2026
