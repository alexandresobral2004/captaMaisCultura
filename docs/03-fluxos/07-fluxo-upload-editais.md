# Análise do Fluxo de Upload de Editais

## 📋 Resumo Executivo

**Status da Análise:** ✅ Concluída
**Problema Principal:** Upload de editais não está passando pelo processo completo de extração e análise
**Causa Raiz:** Múltiplos pontos de falha no fluxo de extração de texto e inconsistência entre sistemas de persistência

**Ações Implementadas:**
1. ✅ Adicionado logging detalhado em todo o fluxo
2. ✅ Adicionado diagnóstico de fallback no `analisarEditalComIA`
3. ✅ Criado script de diagnóstico (`scripts/testar-upload-rastreamento.ts`)

**Próximos Passos:** Executar o script de diagnóstico e testar novo upload

---

## Problema Relatado

Quando um edital é enviado por upload, ele deve passar pelo mesmo processo de extração e análise que os editais baixados dos sites. Atualmente, o upload está falhando com a mensagem:

```
❌ Nenhuma fonte de conteúdo disponível para o edital upload-xxx
⚠️ Edital [upload-xxx] sem conteúdo disponível. Marcando como 'sem_pdf'.
POST /api/editais/analisar 500
```

---

## Análise do Fluxo Atual (Passo a Passo)

### 1. Upload do PDF (`/api/v1/editais/upload-pdf/route.ts`)

```
POST /api/v1/editais/upload-pdf
  ↓
EditalUploadService.processarUpload()
  ↓
  1. Gerar ID único (upload-timestamp-random)
  2. Extrair título do nome do arquivo
  3. Salvar PDF via FileService.salvarPDF()
  4. Ler PDF salvo e extrair texto
  5. Validar com OpenAI (classificar se é TI)
  6. Criar edital no banco
  7. Chamar análise completa com IA
```

### 2. Extração de Texto (`edital-upload.service.ts:extrairTextoDePdf`)

```
extrairTextoDePdf(buffer: Buffer):
  1. Tentar pdf-parse (nativo)
  2. Se texto < 100 chars, tentar LlamaParse
  3. Retornar texto extraído
```

### 3. Salvamento do Edital (`edital-upload.service.ts:processarUpload`)

```typescript
const editalData = {
  id,
  titulo,
  orgao: 'Upload Manual',
  conteudoCompleto: textoExtraido || null,
  fonteConteudo: textoExtraido ? 'pdf_upload' : 'sem_pdf',  // ← PONTO CRÍTICO 1
  pdfPath: pdfPath || null,
  statusAnalise: textoExtraido ? 'pendente' : 'erro',  // ← PONTO CRÍTICO 2
  // ...
};

await this.editalService.criar(editalData);
```

### 4. Análise Completa (`edital-upload.service.ts:linha 136-172`)

```typescript
// Após criar edital, chama análise completa
if (textoExtraido && textoExtraido.length > 100) {
  const editalAnalisado = await analisarEditalComIA(id, textoExtraido, { modo: 'completo' });
}
```

### 5. Pipeline de Análise (`pipeline.ts:processarEditalUnico`)

```typescript
if (edital.fonteConteudo === 'pdf_upload') {
  // Pula download, usa conteudoCompleto diretamente
  const resultadoIA = await analisarEditalComIA(edital.id, edital.conteudoCompleto || '', { modo: 'completo' });
}
```

---

## Problemas Identificados

### 🔴 PROBLEMA 1: Texto não está sendo extraído corretamente

**Sintoma:** `textoExtraido` está vazio ou muito curto (< 100 chars)

**Causas possíveis:**
1. `FileService.salvarPDF()` falha silenciosamente
2. Caminho do arquivo salvo está incorreto
3. `pdf-parse` falha na extração
4. `LlamaParse` falha ou não está configurado
5. Buffer do PDF está corrompido

**Evidência no log:**
```
📥 [DOWNLOAD] Iniciando download do edital upload-xxx...
   - PDF S3: ❌
   - Link Externo: ✅
   - Descrição HTML: ❌
   ❌ Nenhuma fonte de conteúdo disponível
```

O log mostra que o fluxo está indo para `baixarELerPDFEdital()` em vez de usar o caminho de upload. Isso indica que:
- OU o edital não foi salvo com `fonteConteudo: 'pdf_upload'`
- OU o `conteudoCompleto` está vazio no banco

---

### 🔴 PROBLEMA 2: Inconsistência entre `editais-store` e `edital.service`

**Problema:** Existem dois sistemas de persistência:

1. **`lib/db/editais-store.ts`** - Sistema antigo (JSON file store)
2. **`lib/database/services/edital.service.ts`** - Sistema novo (SQLite com Drizzle)

O `analisarEditalComIA()` usa `getAllEditais()` e `saveEdital()` do sistema antigo (`editais-store.ts`), que busca do banco SQLite mas pode ter inconsistências.

---

### 🔴 PROBLEMA 3: `analisarEditalComIA` não encontra o edital

**Código em `analyzer.ts:linha 195-201`:**

```typescript
const todos = await getAllEditais(true);
const editalOriginal = todos.find((e: Edital) => e.id === editalId);

if (!editalOriginal) {
  console.warn(`⚠️  Edital ${editalId} não encontrado para análise.`);
  return null;  // ← Retorna null, não atualiza status!
}
```

**Problema:** Se o edital não for encontrado, a função retorna `null` sem atualizar o status para 'erro'. Isso deixa o edital em estado inconsistente.

---

### 🔴 PROBLEMA 4: `FileService.salvarPDF` pode estar falhando

**Caminho do arquivo:** O serviço salva em `data/uploads/` mas a extração lê de `data/` + `pdfPath`.

---

## Fluxo Ideal (Como Deveria Funcionar)

```
┌─────────────────────────────────────────────────────────────────┐
│                    UPLOAD DE EDITAL                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Receber PDF + metadados (titulo, orgao)                      │
│    - Validar se é PDF                                           │
│    - Validar tamanho (< 50MB)                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Salvar PDF fisicamente                                       │
│    - Gerar ID único                                             │
│    - Salvar em data/uploads/{id}.pdf                            │
│    - Retornar caminho relativo                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Extrair texto do PDF                                         │
│    - Prioridade 1: LlamaParse (preserva tabelas)                │
│    - Prioridade 2: pdf-parse (fallback)                         │
│    - Validar se texto > 100 chars                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Classificar com IA (OpenAI)                                  │
│    - Verificar se é edital de TI                                │
│    - Extrair tecnologiaFoco, tipoFerramenta                     │
│    - Calcular scoreRelevancia, confianca                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Salvar edital no banco (SQLite)                              │
│    - Todos os campos básicos                                    │
│    - fonteConteudo: 'pdf_upload'                                │
│    - conteudoCompleto: {texto extraído}                         │
│    - pdfPath: {caminho do arquivo}                              │
│    - statusAnalise: 'pendente'                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Disparar análise completa (background ou sync)               │
│    - Buscar edital no banco                                     │
│    - Passar texto para analisarEditalComIA()                    │
│    - Preencher todos os campos de analiseIA                     │
│    - Atualizar statusAnalise: 'analisado'                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Planejamento de Correções

### ✅ FASE 1: Diagnóstico e Logging

| # | Ação | Arquivo | Prioridade |
|---|------|---------|------------|
| 1.1 | Adicionar logs detalhados no `processarUpload` | `edital-upload.service.ts` | Alta |
| 1.2 | Logar caminho completo do PDF salvo | `edital-upload.service.ts` | Alta |
| 1.3 | Logar tamanho do texto extraído | `edital-upload.service.ts` | Alta |
| 1.4 | Logar resultado da busca do edital em `analisarEditalComIA` | `analyzer.ts` | Alta |

### ✅ FASE 2: Correções de Fluxo

| # | Ação | Arquivo | Prioridade |
|---|------|---------|------------|
| 2.1 | Garantir que `fonteConteudo` seja sempre 'pdf_upload' quando houver texto | `edital-upload.service.ts` | Alta |
| 2.2 | Garantir que `statusAnalise` seja 'pendente' após criação | `edital-upload.service.ts` | Alta |
| 2.3 | Tratar erro quando edital não for encontrado na análise | `analyzer.ts` | Média |
| 2.4 | Unificar `editais-store` com `edital.service` | Múltiplos | Baixa |

### ✅ FASE 3: Melhorias de Extração

| # | Ação | Arquivo | Prioridade |
|---|------|---------|------------|
| 3.1 | Melhorar fallback LlamaParse → pdf-parse | `edital-upload.service.ts` | Média |
| 3.2 | Adicionar retry em caso de falha na extração | `edital-upload.service.ts` | Baixa |
| 3.3 | Validar se PDF está corrompido antes de extrair | `edital-upload.service.ts` | Baixa |

### ✅ FASE 4: Pipeline Unificado

| # | Ação | Arquivo | Prioridade |
|---|------|---------|------------|
| 4.1 | Fazer `processarEditalUnico` buscar edital sempre do banco | `pipeline.ts` | Média |
| 4.2 | Garantir que upload dispare o mesmo pipeline que scraper | `pipeline.ts` | Alta |
| 4.3 | Criar endpoint dedicado para re-analisar edital | `app/api/editais/reanalisar/route.ts` | Baixa |

---

## Próximos Passos Imediatos

1. **Adicionar logs de diagnóstico** para identificar onde o fluxo está falhando
2. **Verificar se o PDF está sendo salvo corretamente** no diretório `data/uploads/`
3. **Verificar se o texto está sendo extraído** e com qual tamanho
4. **Verificar se o edital está sendo salvo** com `fonteConteudo: 'pdf_upload'` e `conteudoCompleto` preenchido
5. **Verificar se `analisarEditalComIA` está encontrando o edital** no banco

---

## Checklist de Validação

Após as correções, validar:

- [ ] Upload de PDF salva arquivo em `data/uploads/`
- [ ] Texto é extraído com sucesso (> 100 chars)
- [ ] Edital é criado com `fonteConteudo: 'pdf_upload'`
- [ ] Edital é criado com `conteudoCompleto` preenchido
- [ ] Edital é criado com `statusAnalise: 'pendente'`
- [ ] `analisarEditalComIA` encontra o edital no banco
- [ ] Análise completa preenche todos os campos de `analiseIA`
- [ ] Status é atualizado para `statusAnalise: 'analisado'`
- [ ] Frontend mostra dados completos da análise
