# 🔑 GUIA COMPLETO - SISTEMA DE VALIDAÇÃO COM KEYWORDS

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
Threshold: **5+ palavras-chave** encontradas no documento
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

## 📂 ARQUIVOS CRIADOS/MODIFICADOS

### NOVOS ARQUIVOS

#### `lib/scraper/keyword-map.ts`
Define o mapa de palavras-chave por categoria
```typescript
export const keywordMap = {
  mandatoryTerms: [...],
  likelyTerms: [...],
  // ... 8 categorias no total
}
```

#### `lib/scraper/keyword-validator.ts`
Realiza a validação com contagem e score
```typescript
async function validarConteudoComKeywords(
  textoCompleto: string,
  densidadeMinima: number = 5
): Promise<ResultadoValidacaoKeywords>
```

Retorna:
```typescript
{
  isEdital: boolean,              // Passou?
  scoreTotal: number,             // 0-100
  confianca: number,              // 0-100%
  contagem: { ... },              // Por categoria
  densidadeKeywords: number,      // Por 1000 chars
  palavrasEncontradas: string[],  // Lista de palavras
  oportunidadesDetectadas: [],    // Tipos detectados
  motivo: string,
  avisos: string[]
}
```

#### `lib/scraper/keyword-logger.ts`
Registra e gera relatórios de validações
```typescript
registrarValidacao(...)  // Salva log
gerarRelatorioValidacoes(...)  // Gera relatório
exibirRelatorioPretty(...)  // Exibe formatado
```

#### `lib/scraper/edital-extractor.ts`
Extrai dados estruturados do edital
```typescript
async function extrairDadosEditais(
  textoCompleto: string,
  validacaoKeywords: ResultadoValidacaoKeywords,
  titulo?: string
): Promise<DadosEditaisExtraidos>
```

Retorna:
```typescript
{
  titulo: string,
  resumo: string,
  objetivo: string,
  datas: { ... },
  financeiro: { ... },
  elegibilidade: { ... },
  cronograma: string,
  confiancaExtracao: number,
  metodosUsados: string[],
}
```

#### `lib/scraper/pipeline-keywords.ts`
Integra tudo na pipeline de busca
```typescript
async function processarEditalComKeywords(
  edital: Edital,
  opcaoDownload: OpcoesDownload,
  habilitarExtracao: boolean = true
)
```

### MODIFICADOS

#### `lib/scraper/pdf-downloader.ts`
Adiciona validação opcional ao download
```typescript
async function baixarELerPDFEdital(
  id: string,
  opcoes: OpcoesDownload,
  orgao: string,
  titulo: string,
  dataLimite: string,
  validarKeywords: boolean = false  // ← NOVO PARÂMETRO
)
```

Retorna campo adicional:
```typescript
{
  validacaoKeywords?: {
    isEdital: boolean,
    scoreTotal: number,
    // ...
  }
}
```

#### `lib/db/editais-store.ts`
Expande schema com novos campos:
```typescript
interface Edital {
  // ... campos existentes ...
  
  scoreValidacaoKeywords?: number;
  contadorPalavrasChave?: { ... };
  densidadeKeywords?: number;
  oportunidadesDetectadas?: string[];
  validacaoConteudoResultado?: 'aprovado' | 'rejeitado' | ...;
  dadosExtraidos?: { ... };
  // ... mais campos
}
```

Função nova:
```typescript
function salvarValidacaoKeywords(
  editalId: string,
  validacaoResult: any,
  dadosExtraidos?: any
): Edital | null
```

---

## 🚀 COMO USAR

### 1. VALIDAÇÃO AUTOMÁTICA NA PIPELINE SEMANAL

Por padrão, a validação com keywords está **DESATIVADA** na pipeline semanal para não quebrar compatibilidade.

Para **ATIVAR**, você precisa:

#### Opção A: Ativar no weekly-scan
Editar `/Users/alexandrerocha/captaMais/app/api/jobs/run-weekly-scan/route.ts`:

```typescript
// LINHA 95 - Mudar:
const resultadoExtracao = await baixarELerPDFEdital(
  edital.id,
  opcoesDownload,
  edital.orgao,
  edital.titulo,
  edital.dataLimite
  // false  ← ANTES (desativado)
);

// Para:
const resultadoExtracao = await baixarELerPDFEdital(
  edital.id,
  opcoesDownload,
  edital.orgao,
  edital.titulo,
  edital.dataLimite,
  true  // ← AGORA (ativado)
);
```

#### Opção B: Usar função da pipeline
```typescript
import { processarLoteComKeywords } from '@/lib/scraper/pipeline-keywords';

const resultado = await processarLoteComKeywords(
  editais,
  (ed) => ({
    pdfUrlS3: ed.pdfUrl,
    linkExterno: ed.link,
    descricaoHtml: ed.descricao
  }),
  true  // habilitar extração
);
```

### 2. VALIDAÇÃO MANUAL EM CÓDIGO

```typescript
import { validarConteudoComKeywords } from '@/lib/scraper/keyword-validator';
import { registrarValidacao } from '@/lib/scraper/keyword-logger';

// Extrair texto do PDF
const texto = await extrairTextoPdf(buffer);

// Validar
const resultado = await validarConteudoComKeywords(texto);

// Registrar
registrarValidacao(
  'edital-123',
  'prosas',
  resultado,
  texto.length,
  123, // tempo em ms
  'Título do Edital'
);

// Usar resultado
if (resultado.isEdital) {
  console.log('✅ Aprovado:', resultado.scoreTotal);
} else {
  console.log('❌ Rejeitado:', resultado.motivo);
}
```

### 3. EXTRAIR DADOS ESTRUTURADOS

```typescript
import { extrairDadosEditais, formatarDadosExtraidos } from '@/lib/scraper/edital-extractor';

const dados = await extrairDadosEditais(
  textoCompleto,
  validacaoResult,
  'Título do Edital'
);

console.log(formatarDadosExtraidos(dados));

// Salvar no banco
salvarValidacaoKeywords(
  edital.id,
  validacaoResult,
  dados
);
```

### 4. GERAR RELATÓRIO

```typescript
import { 
  gerarRelatorioValidacoes,
  exibirRelatorioPretty,
  salvarRelatorioJSON 
} from '@/lib/scraper/keyword-logger';

// Últimos 7 dias
const relatorio = gerarRelatorioValidacoes();

// Exibir no console
exibirRelatorioPretty(relatorio);

// Salvar em arquivo
salvarRelatorioJSON(relatorio, 'meu-relatorio.json');
```

---

## 📊 EXEMPLO DE FLUXO COMPLETO

```typescript
// 1. Baixar PDF
const resultado = await baixarELerPDFEdital(
  'prosas-123',
  {
    pdfUrlS3: 'https://...',
    linkExterno: 'https://...',
    descricaoHtml: '<p>...</p>'
  },
  'FINEP',
  'Edital FINEP 2024',
  '31/12/2024',
  true  // ← Validar com keywords
);

// 2. Resultado de validação
if (resultado.validacaoKeywords?.isEdital) {
  // Score: 78% (encontrou 12 palavras-chave)
  // Contagem: mandatory=3, likely=5, academic=4
  // Densidade: 8.5 / 1000 chars
  
  // 3. Extrair dados
  const dados = await extrairDadosEditais(
    resultado.texto,
    resultado.validacaoKeywords,
    'Edital FINEP 2024'
  );
  
  // 4. Salvar
  salvarValidacaoKeywords(
    'prosas-123',
    resultado.validacaoKeywords,
    dados
  );
  
  // Edital foi processado com sucesso!
} else {
  // Edital foi rejeitado
  // Motivo: "Apenas 2 palavras-chave encontradas (mínimo: 5)"
}
```

---

## 📈 CAMPOS ADICIONADOS AO BANCO

Quando um edital é processado com validação de keywords, ele passa a ter:

```json
{
  "id": "prosas-123",
  "titulo": "Edital FINEP 2024",
  
  "scoreValidacaoKeywords": 78,
  "contadorPalavrasChave": {
    "mandatoryTerms": 3,
    "likelyTerms": 5,
    "academicTerms": 4,
    "fundingTerms": 2
  },
  "densidadeKeywords": 8.5,
  "oportunidadesDetectadas": ["editalPesquisa", "bolsaPos"],
  "validacaoConteudoResultado": "aprovado",
  
  "dadosExtraidos": {
    "resumo": "Chamada pública...",
    "objetivo": "Apoio a pesquisa científica",
    "datas": {
      "encerramento": "31/12/2024",
      "resultado": "15/01/2025"
    },
    "financeiro": {
      "valorTotal": "R$ 500.000",
      "tipo": "Subvenção"
    },
    "elegibilidade": {
      "tiposProponentes": ["Universidades", "Institutos de Pesquisa"],
      "requisitosMinimos": ["Ter grupo de pesquisa", "Estar filiado ao CNPq"]
    },
    "cronograma": "Inscrição até 31/12, resultado em 15/01",
    "confiancaExtracao": 85,
    "metodosUsados": ["keywords", "ia", "heuristica"]
  }
}
```

---

## 📋 LOGS E RELATÓRIOS

### Localização dos logs
```
data/logs/validacoes/
├── validacoes-2026-05-29.jsonl
├── validacoes-2026-05-30.jsonl
└── relatorio-validacoes-2026-05-29-102543.json
```

### Formato JSONL (um objeto por linha)
```json
{"timestamp":"2026-05-29T10:25:43.123Z","editalId":"prosas-123","resultado":{"isEdital":true,"scoreTotal":78,...}}
```

### Gerar relatório programaticamente
```typescript
const relatorio = gerarRelatorioValidacoes(
  new Date('2026-05-22'),  // Início
  new Date('2026-05-29')   // Fim
);

console.log(`Taxa aprovação: ${relatorio.taxaAprovacao}%`);
console.log(`Score médio: ${relatorio.scoreMediaAprovados}%`);
```

---

## ⚙️ CONFIGURAÇÕES

### Threshold (densidade mínima)
Padrão: **5 palavras-chave**

Para mudar:
```typescript
const resultado = await validarConteudoComKeywords(
  texto,
  10  // ← Novo threshold (10 palavras)
);
```

### Pesos das categorias
Padrão:
- Mandatory: 3x
- Likely: 2x
- Others: 1x

Para mudar, editar `keyword-validator.ts` na função `scoreTotal`.

### Timeout de extração IA
Padrão: **30.000 ms** (30 segundos)

Se quiser ajustar, editar `edital-extractor.ts`.

---

## 🐛 TROUBLESHOOTING

### "Edital rejeitado: Apenas 2 palavras-chave"
✅ **Solução:** Aumentar threshold ou revisar mapa de keywords

### "Erro ao validar keywords - aceitando por padrão"
✅ **Solução:** Verificar logs em `data/logs/validacoes/`

### "Logs não estão sendo criados"
✅ **Solução:** Verificar permissões de escrita em `data/logs/`

### "Dados extraídos incompletos"
✅ **Solução:** IA pode não ter encontrado os dados; revisar texto do PDF

---

## 🎯 PRÓXIMOS PASSOS

1. **ATIVAR** validação na pipeline semanal
2. **MONITORAR** relatórios de validação por 1-2 semanas
3. **AJUSTAR** threshold se necessário
4. **INTEGRAR** com interface do dashboard (mostrar scores)
5. **EXPORTAR** relatórios para análise

---

## 📞 SUPORTE

Logs detalhados estão em: `data/logs/validacoes/`
Relatórios em: `data/logs/validacoes/relatorio-*.json`

Para debug, verificar:
1. `data/editais.json` - Campo `scoreValidacaoKeywords`
2. `data/logs/validacoes/*.jsonl` - Log detalhado
3. Console do servidor - Mensagens de validação
