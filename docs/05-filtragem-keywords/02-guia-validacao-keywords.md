# 🔑 GUIA COMPLETO - SISTEMA DE VALIDAÇÃO COM KEYWORDS

> **📍 Localização:** `docs/05-filtragem-keywords/02-guia-validacao-keywords.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

## 📋 VISÃO GERAL

O sistema de validação com keywords filtra automaticamente editais baseado na densidade de termos específicos encontrados no conteúdo dos PDFs. Se um documento contém 5+ palavras-chave de um mapa pré-definido, ele é classificado como edital válido e processado.

**Status:** ✅ Totalmente implementado e integrado
**Data:** 29 de Maio de 2026

---

## 🎯 COMO FUNCIONA

### 1. VALIDAÇÃO COM KEYWORDS

Procura por termos em 8 categorias:
- **Obrigatórios** (3x peso): edital, chamada pública, processo seletivo, etc
- **Prováveis** (2x peso): objetivo, financiamento, cronograma, etc
- **Acadêmicos**: pesquisa, universidade, bolsa de pesquisa, etc
- **Financeiros**: valor, orçamento, contrapartida, auxílio, etc
- **Elegibilidade**: requisitos, proponente, público-alvo, etc
- **Submissão**: inscrição, formulário, documentos, etc
- **Cronograma**: datas, prazos, calendário, etc
- **Avaliação**: critérios, julgamento, comissão, etc

### 2. DENSIDADE MÍNIMA

**Threshold:** 5+ palavras-chave encontradas no documento
- Calculado por 1000 caracteres
- Score total: 0-100%
- Confiança: 0-100% (baseada em score + termos obrigatórios)

### 3. LOG DETALHADO

Cada validação é registrada em:
```
data/logs/validacoes/validacoes-YYYY-MM-DD.jsonl
```

- Um objeto JSON por linha (JSONL format)
- Contém: timestamp, ID, score, contagem, motivo, etc

---

## 📂 ESTRUTURA DE ARQUIVOS

```
lib/scraper/
├── keyword-map.ts           # 200+ palavras-chave em 8 categorias
├── keyword-validator.ts     # Lógica de validação
├── keyword-logger.ts        # Logging estruturado
├── edital-extractor.ts      # Extração de dados estruturados
└── pipeline-keywords.ts     # Integração com pipeline

__tests__/
├── keyword-validator.test.ts
├── keyword-map.test.ts
└── keyword-logger.test.ts
```

---

## 🚀 USO BÁSICO

### Importação

```typescript
import { validarComKeywords } from '@/lib/scraper/keyword-validator';
import { extrairDadosEdital } from '@/lib/scraper/edital-extractor';

const texto = await extrairTexto(pdfPath);
const validacao = await validarComKeywords(texto, editalId);

if (validacao.aprovado) {
  // Prosseguir com análise IA
  const dados = await extrairDadosEdital(texto);
  await salvarEdital({ ...edital, ...dados });
}
```

### Validação Rápida

```typescript
import { quickValidate } from '@/lib/scraper/keyword-validator';

const ok = await quickValidate(texto);
// true se aprovado, false se rejeitado
```

---

## 📊 SCHEMA DE VALIDAÇÃO

```typescript
interface ValidacaoKeywords {
  // Identificação
  editalId: string;
  timestamp: string; // ISO 8601

  // Resultado
  aprovado: boolean;
  score: number;        // 0-100
  confianca: number;    // 0-100
  densidade: number;    // keywords / 1000 chars
  totalPalavras: number;

  // Contagem por categoria
  contagem: {
    obrigatorios: number;  // peso 3x
    provaveis: number;     // peso 2x
    academicos: number;
    financeiros: number;
    elegibilidade: number;
    submissao: number;
    cronograma: number;
    avaliacao: number;
  };

  // Detalhes
  keywordsEncontradas: string[];
  motivo: string;        // Explicação da decisão

  // Texto
  textoLength: number;
  textoHash: string;     // Para cache/deduplicação
}
```

---

## 🔧 CONFIGURAÇÃO AVANÇADA

### Ajustar Thresholds

```typescript
// lib/scraper/keyword-validator.ts
export const CONFIG = {
  // Mínimo de keywords para aprovação
  minKeywords: 5,

  // Confiança mínima (0-100)
  minConfianca: 70,

  // Score mínimo (0-100)
  minScore: 60,

  // Tamanho mínimo de texto (chars)
  minTextoLength: 500,

  // Tamanho máximo (truncar)
  maxTextoLength: 100000,

  // Habilitar log
  enableLog: true,

  // Caminho do log
  logPath: 'data/logs/validacoes/'
};
```

### Customizar Pesos

```typescript
// lib/scraper/keyword-map.ts
export const PESOS = {
  obrigatorios: 3.0,
  provaveis: 2.0,
  academicos: 1.0,
  financeiros: 1.0,
  elegibilidade: 1.0,
  submissao: 1.0,
  cronograma: 1.0,
  avaliacao: 1.0
};
```

### Adicionar Novas Keywords

```typescript
// lib/scraper/keyword-map.ts
export const KEYWORDS_ACADEMICOS = [
  // ... existentes
  'pesquisa translacional',  // ← NOVO
  'medicina personalizada',  // ← NOVO
  'agroindustria 4.0',        // ← NOVO
];
```

---

## 🧪 TESTES

### Testes Unitários

```bash
npm run test keyword-validator
npm run test keyword-map
```

### Cobertura Atual

```
✓ keyword-validator.test.ts (15 casos)
✓ keyword-map.test.ts (8 casos)
✓ keyword-logger.test.ts (6 casos)
```

### Caso de Teste Real

```typescript
import { validarComKeywords } from '@/lib/scraper/keyword-validator';

const texto = `
EDITAL DE CHAMADA PÚBLICA Nº 01/2026

A Fundação de Amparo à Pesquisa do Estado de São Paulo (FAPESP)
torna público o presente edital de pesquisa científica...

OBJETIVO: Fomentar projetos de pesquisa em Inteligência Artificial
aplicada à saúde digital.

FINANCIAMENTO: R$ 500.000,00 por projeto.

REQUISITOS:
- Doutorado em área afim
- Vínculo institucional com universidade
- Publicações nos últimos 5 anos

INSCRIÇÕES: até 30/07/2026
`;

const resultado = await validarComKeywords(texto, 'test-edital-1');

console.log(resultado);
// {
//   aprovado: true,
//   score: 95,
//   confianca: 100,
//   densidade: 38.5,
//   totalPalavras: 250,
//   contagem: { obrigatorios: 12, academicos: 15, ... },
//   motivo: 'Aprovado: 12 obrigatórios + 15 acadêmicos...'
// }
```

---

## 📈 MONITORAMENTO

### Estatísticas em Tempo Real

```bash
# Total de validações hoje
wc -l data/logs/validacoes/validacoes-$(date +%Y-%m-%d).jsonl

# Taxa de aprovação
echo "scale=2; $(grep -c '"aprovado":true' data/logs/validacoes/*.jsonl) / $(wc -l < data/logs/validacoes/*.jsonl) * 100" | bc

# Score médio
cat data/logs/validacoes/*.jsonl | jq -r '.score' | awk '{sum+=$1; n++} END {print sum/n}'
```

### Dashboard Sugerido

```sql
SELECT
  DATE(timestamp) as dia,
  COUNT(*) as total_validacoes,
  SUM(CASE WHEN aprovado THEN 1 ELSE 0 END) as aprovados,
  ROUND(AVG(score), 2) as score_medio,
  ROUND(AVG(confianca), 2) as confianca_media,
  ROUND(AVG(densidade), 2) as densidade_media
FROM validacoes
WHERE timestamp > datetime('now', '-7 days')
GROUP BY DATE(timestamp)
ORDER BY dia DESC;
```

---

## 🐛 TROUBLESHOOTING

### Problema: Editais válidos sendo rejeitados

**Diagnóstico:**
```bash
# Ver quais editais foram rejeitados
grep '"aprovado":false' data/logs/validacoes/*.jsonl | tail -5 | jq .
```

**Solução:** Adicionar termos específicos à whitelist.

### Problema: Muitos falsos positivos

**Diagnóstico:**
```bash
# Ver amostras de aprovados
grep '"aprovado":true' data/logs/validacoes/*.jsonl | tail -3 | jq .
```

**Solução:** Aumentar thresholds em `CONFIG`.

### Problema: Logs crescendo muito

**Solução:** Adicionar rotação de logs:
```bash
# Adicionar ao crontab
0 0 * * 0 find data/logs/validacoes/ -name "*.jsonl" -mtime +30 -delete
```

---

## 📚 Documentação Relacionada

- **Avaliação completa:** [`01-avaliacao-filtragem-keywords.md`](01-avaliacao-filtragem-keywords.md)
- **Resumo executivo:** [`03-resumo-executivo-keywords.md`](03-resumo-executivo-keywords.md)
- **Resultado teste expansão:** [`04-resultado-teste-expansao.md`](04-resultado-teste-expansao.md)
- **Implementação em produção:** [`../04-implementacao/03-implementacao-filtragem-producao.md`](../04-implementacao/03-implementacao-filtragem-producao.md)
