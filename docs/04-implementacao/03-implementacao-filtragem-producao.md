# 🚀 GUIA DE IMPLEMENTAÇÃO - ATIVAR FILTRAGEM EM PRODUÇÃO

> **📍 Localização:** `docs/04-implementacao/03-implementacao-filtragem-producao.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

**Status:** ✅ Sistema testado e validado
**Acurácia:** 100% (7/7 cenários)
**Data:** 29 de Maio de 2026

---

## 📋 CHECKLIST RÁPIDO

- [ ] Ativar validação no weekly-scan
- [ ] Testar primeira execução
- [ ] Monitorar logs
- [ ] Revisar relatório após 1 semana
- [ ] Ajustar se necessário

---

## 🔧 PASSO 1: ATIVAR NA PIPELINE SEMANAL

### Arquivo: `app/api/jobs/run-weekly-scan/route.ts`

**Encontre a linha 95:**

```typescript
// ANTES (desativado)
const resultadoExtracao = await baixarELerPDFEdital(
  edital.id,
  opcoesDownload,
  edital.orgao,
  edital.titulo,
  edital.dataLimite
  // sem validarKeywords
);
```

**Altere para (ativado):**

```typescript
// DEPOIS (ativado)
const resultadoExtracao = await baixarELerPDFEdital(
  edital.id,
  opcoesDownload,
  edital.orgao,
  edital.titulo,
  edital.dataLimite,
  { validarKeywords: true }  // ← ADICIONAR
);
```

---

## 🔧 PASSO 2: CONFIGURAR VARIÁVEIS DE AMBIENTE

### Arquivo: `.env.local`

```bash
# OpenAI (obrigatório)
OPENAI_API_KEY=sk-proj-...

# Tavily (opcional, para geração de projetos)
TAVILY_API_KEY=tvly-...

# LlamaParse (opcional, para extração avançada de PDF)
LLAMACLOUD_API_KEY=llx-...

# Prosas (obrigatório para scraper)
PROSAS_EMAIL=seu_email@example.com
PROSAS_PASSWORD=sua_senha

# Agendamento
SCAN_TOKEN=seu_token_seguro
```

---

## 🔧 PASSO 3: TESTAR EM MODO DRY-RUN

```bash
./scripts/buscar-editais.sh --dry-run --verbose
```

**Saída esperada:**

```
[INFO] Configurando diretórios...
[✓] Diretórios criados/verificados
[INFO] Iniciando busca em modo simulação...
[INFO] Prosas: simulando 50 editais...
[INFO] Aplicando filtros com keywords...
[✓] Whitelist: 38 aprovados
[✓] OpenAI: 35 confirmados
[✓] Blacklist: 0 bloqueados
[INFO] Resultado: 35 editais válidos
```

---

## 🔧 PASSO 4: EXECUÇÃO REAL

```bash
./scripts/buscar-editais.sh --verbose
```

**Saída esperada:**

```
[INFO] Iniciando busca consolidada nos portais
[INFO] 1/4 - Prosas...
[PROSAS] Login realizado (cookies salvos)
[PROSAS] Token OAuth2 obtido
[PROSAS] 50 editais retornados pela API V2
[PROSAS] Buscando detalhes individuais...
[INFO] 2/4 - FINEP (RSS)...
[INFO] 3/4 - CNPq (HTML)...
[INFO] 4/4 - CAPES (HTML)...
[INFO] Filtros aplicados: 35 editais válidos
[INFO] Iniciando download de PDFs...
[INFO] PDF 1/35 - edital-prosas-123.pdf (524KB - pdf_s3)
[INFO] PDF 2/35 - edital-finep-456.pdf (200KB - pdf_link)
...
[INFO] Análise IA em background...
[INFO] Relatório salvo em: logs/busca-editais-20260529.log
```

---

## 🔧 PASSO 5: MONITORAR LOGS

### Logs em tempo real

```bash
tail -f logs/busca-editais-$(date +%Y%m%d).log
```

### Logs de validação

```bash
ls -lh data/logs/validacoes/
# validacoes-2026-05-29.jsonl
# validacoes-2026-05-28.jsonl
```

### Formato do log JSONL

```json
{"timestamp":"2026-05-29T10:30:45Z","editalId":"prosas-123","score":85,"confianca":90,"aprovado":true}
{"timestamp":"2026-05-29T10:30:47Z","editalId":"finep-456","score":45,"confianca":50,"aprovado":false,"motivo":"densidade_insuficiente"}
```

---

## 🔧 PASSO 6: AGENDAR COM CRON

```bash
./scripts/setup-cron.sh
# Escolher opção 1 (segunda 08:00) ou 2 (todos os dias 08:00)
```

**Crontab gerado:**

```cron
# Capta+ busca semanal de editais
0 8 * * 1 cd /Users/alexandrerocha/captaMais && ./scripts/buscar-editais.sh >> logs/cron.log 2>&1
```

---

## 📊 RELATÓRIO PÓS-EXECUÇÃO (após 1 semana)

### Comandos para análise

```bash
# Total de execuções
grep -c "Busca concluída" logs/busca-editais-*.log

# Editais capturados
grep "PDFs baixados" logs/busca-editais-*.log | tail -7

# Taxa de aprovação
echo "scale=2; $(grep -c 'aprovado' data/logs/validacoes/*.jsonl) / $(wc -l < data/logs/validacoes/*.jsonl) * 100" | bc
```

### Dashboard sugerido

```sql
SELECT
  DATE(timestamp) as dia,
  COUNT(*) as total,
  SUM(CASE WHEN aprovado THEN 1 ELSE 0 END) as aprovados,
  ROUND(AVG(score), 2) as score_medio
FROM validacoes
WHERE timestamp > datetime('now', '-7 days')
GROUP BY DATE(timestamp);
```

---

## 🐛 TROUBLESHOOTING

### Problema: Editais válidos sendo rejeitados

**Sintoma:** `foraDoEscopo = true` para editais de TI legítimos

**Solução:** Adicionar termos à whitelist em `lib/scraper/keyword-map.ts`

```typescript
// Adicionar termo novo
export const WHITIST_TI: string[] = [
  // ... existentes
  'seu_termo_aqui',  // ← adicionar
];
```

### Problema: OpenAI retornando timeout

**Sintoma:** Logs mostram "OpenAI timeout após 10s"

**Solução 1:** Aumentar timeout em `lib/scraper/filtros-ti.ts`:
```typescript
const OPENAI_TIMEOUT_MS = 20000; // 20s ao invés de 10s
```

**Solução 2:** Adicionar retry com backoff:
```typescript
async function validarComOpenAI(...) {
  for (let i = 0; i < 3; i++) {
    try {
      return await callOpenAI(...);
    } catch (err) {
      if (i === 2) return fallback;
      await delay(1000 * (i + 1));
    }
  }
}
```

### Problema: Custo OpenAI alto

**Sintoma:** Fatura OpenAI > $10/semana

**Solução:** Implementar cache persistente
```typescript
// lib/scraper/keyword-cache.ts
const cache = new Map<string, ValidacaoResult>();
// Salvar em data/cache/validacoes.json
```

---

## ✅ Critérios de Sucesso

Após 1 semana, validar:

- [ ] 100% dos editais válidos foram aprovados
- [ ] <5% de falsos positivos (editais não-TI marcados como TI)
- [ ] Tempo de execução < 15 minutos
- [ ] Custo OpenAI < $5/semana
- [ ] Logs estruturados e consultáveis
- [ ] Cron executando sem falhas

---

## 📚 Documentação Relacionada

- **Filtragem TI completa:** [`01-implementacao-ti-completa.md`](01-implementacao-ti-completa.md)
- **Avaliação de filtragem:** [`../05-filtragem-keywords/01-avaliacao-filtragem-keywords.md`](../05-filtragem-keywords/01-avaliacao-filtragem-keywords.md)
- **Guia de validação:** [`../05-filtragem-keywords/02-guia-validacao-keywords.md`](../05-filtragem-keywords/02-guia-validacao-keywords.md)
- **Resumo executivo:** [`../05-filtragem-keywords/03-resumo-executivo-keywords.md`](../05-filtragem-keywords/03-resumo-executivo-keywords.md)
