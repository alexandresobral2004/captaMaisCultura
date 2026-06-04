# Fluxo de Exclusão e Análise Manual de Editais

> **📍 Localização:** `docs/03-fluxos/05-fluxo-exclusao-analise.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

## 📋 Resumo das Alterações

Este documento descreve as mudanças implementadas para permitir que o usuário controle completamente o fluxo de análise dos editais.

## ✅ O que foi implementado

### 1. Botão de Exclusão
- **Onde**: Em cada card de edital na lista
- **O que faz**: Deleta o edital do banco de dados E remove todos os seus PDFs
- **Confirmação**: Pede confirmação antes de deletar
- **Ícone**: Lixeira (Trash2)

### 2. Exclusão no Modal
- **Onde**: Footer do modal de detalhes
- **Comportamento**: Deleta e fecha o modal

### 3. API DELETE
```
DELETE /api/editais/deletar
Body: { id: string }
Response: { success: true, message, id }
```

**Deleta em cascata:**
- Arquivo PDF (`data/downloads/edital-*.pdf`)
- Arquivo de conteúdo (`data/downloads/edital-*-conteudo.txt`)
- Registro no banco SQLite (`data/db/editais.db`)

### 4. Análise Manual (Não Automática)

**Antes:**
```
Busca → Baixa PDFs → Analisa com IA → Salva
```

**Agora:**
```
Busca → Baixa PDFs → Salva com status PENDENTE
Usuário clica "Analisar" → IA analisa → Salva resultado
```

### 5. Novo Fluxo na Interface

```
┌──────────────────────────────────────────────────────────┐
│  1. Usuário clica "Disparar Busca Inteligente"          │
│     → API: POST /api/editais/busca                      │
│     → Editais aparecem com status "Pendente"            │
└────────────────────┬─────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│  2. Usuário clica "Analisar" no card                     │
│     → API: POST /api/editais/analisar { id }            │
│     → IA processa (5-8K tokens)                         │
│     → Status muda para "Analisado" + badge "✨ IA"      │
└────────────────────┬─────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│  3. Usuário revisa e deleta se necessário                │
│     → Botão lixeira no card ou modal                     │
│     → API: DELETE /api/editais/deletar { id }           │
│     → Cascata: PDF + registro removidos                 │
└──────────────────────────────────────────────────────────┘
```

---

## 🔧 Detalhes Técnicos da Exclusão

### Endpoint: `DELETE /api/editais/deletar`

**Request:**
```json
{
  "id": "prosas-12345"
}
```

**Response (sucesso):**
```json
{
  "success": true,
  "message": "Edital e arquivos removidos com sucesso",
  "id": "prosas-12345"
}
```

**Operações realizadas:**
1. Remove registro da tabela `editais` (cascade remove análises, palavras-chave, arquivos)
2. Deleta arquivo `data/downloads/edital-{id}.pdf`
3. Deleta arquivo `data/downloads/edital-{id}-conteudo.txt` (se existir)
4. Retorna sucesso

### Componente: Botão de Exclusão

**Localização:** `app/editais/page.tsx`

```typescript
<button
  onClick={handleDeletar}
  title="Deletar edital"
  className="btn-delete"
>
  <Trash2 size={16} />
</button>

async function handleDeletar() {
  if (!confirm('Tem certeza que deseja deletar este edital?')) return;

  const response = await fetch('/api/editais/deletar', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: edital.id })
  });

  if (response.ok) {
    // Remove da lista local
    setEditais(prev => prev.filter(e => e.id !== edital.id));
    toast.success('Edital deletado com sucesso');
  }
}
```

### Endpoint: `POST /api/editais/analisar`

**Request:**
```json
{
  "id": "prosas-12345"  // ID específico
}
// ou
{
  "analisarTodosPendentes": true  // Fila completa
}
```

**Response:**
```json
{
  "message": "Análise iniciada em background",
  "editalId": "prosas-12345"
}
```

---

## 📊 Status e Transições

### Status de Análise (`statusAnalise`)

```
'pendente'     → 'pdf_baixado'  → 'analisado'
                                  ↓
                            'erro' ou 'sem_pdf'
```

### Status de Revisão (`statusRevisao`)

```
'pendente' → 'aprovado'
           → 'rejeitado'
```

### Botões por Status

| Status | Botões Disponíveis |
|--------|-------------------|
| `pendente` | Analisar, Deletar, Ver Detalhes |
| `pdf_baixado` | Aguardando (worker background) |
| `analisado` | Aprovar, Rejeitar, Re-analisar, Deletar |
| `sem_pdf` | Tentar Novamente, Deletar |
| `erro` | Tentar Novamente, Deletar, Ver Erro |
| `descartado` | (final) |

---

## 🎨 Mudanças na Interface

### Card de Edital

```diff
  ┌─────────────────────────────────────┐
  │ Título do Edital                    │
  │ CNPq • Aberto • até 30/07/2026     │
  │                                      │
  │ Descrição resumida...               │
  │                                      │
  │ [Análise IA] [PDF] [Lixeira] ← novo│
  └─────────────────────────────────────┘
```

### Modal de Detalhes

```diff
  ┌─────────────────────────────────────┐
  │ Detalhes do Edital                  │
  │ ─────────────────────────────────── │
  │ Visão geral...                      │
  │                                      │
  │ Elegibilidade: ...                  │
  │ Requisitos: ...                     │
  │                                      │
  │ ─────────────────────────────────── │
  │ [Fechar] [Aprovar] [Rejeitar] [🗑️]│  ← novo
  └─────────────────────────────────────┘
```

---

## 🐛 Tratamento de Erros

### Erro ao Deletar

- **Causa:** Arquivo PDF não existe ou já foi removido
- **Comportamento:** Log de aviso, mas retorna sucesso (idempotente)
- **UX:** Toast de sucesso mesmo se PDF não existir

### Erro ao Analisar

- **Causa:** Sem PDF ou OpenAI indisponível
- **Comportamento:** Status muda para `erro` com mensagem
- **UX:** Botão "Tentar Novamente" habilitado

### Confirmação de Exclusão

```typescript
if (!confirm('⚠️ Tem certeza que deseja deletar este edital?\n\nEsta ação é IRREVERSÍVEL e removerá também o PDF.')) {
  return;
}
```

---

## 📚 Documentação Relacionada

- **Análise completa do pipeline:** [`02-fluxo-completo-pipeline.md`](02-fluxo-completo-pipeline.md)
- **Mudanças no pipeline:** [`06-mudancas-pipeline.md`](06-mudancas-pipeline.md)
- **API Documentation:** [`../02-arquitetura/05-api-documentacao.md`](../02-arquitetura/05-api-documentacao.md)
