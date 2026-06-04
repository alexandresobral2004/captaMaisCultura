# Fluxo de Exclusão e Análise Manual de Editais

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

Deleta:
- Arquivo PDF (`data/downloads/edital-*.pdf`)
- Arquivo de conteúdo (`data/downloads/edital-*-conteudo.txt`)
- Registro em `data/editais.json`

### 4. Análise Manual (Não Automática)
**Antes:**
- Busca → Baixa PDFs → Analisa com IA → Salva

**Agora:**
- Busca → Baixa PDFs → Salva com status PENDENTE
- Usuário clica "Analisar" → IA analisa → Salva resultado

### 5. Novo Fluxo na Interface

#### Status: PENDENTE
```
[Detalhes] [Analisar] [Excluir]
```

#### Status: ANALISADO
```
[Ver Catálogo IA] [Excluir]
```

## 🔄 Novo Fluxo de Uso

### Passo 1: Buscar
1. Usuário vai para `/editais`
2. Clica em "Disparar Busca Inteligente"
3. Sistema baixa PDFs do Prosas
4. Editais aparecem com status **PENDENTE**

### Passo 2: Revisar
1. Usuário vê lista de editais
2. Pode filtrar por área, tipo, instituição
3. Pode buscar por palavra-chave

### Passo 3: Excluir Inúteis (Opcional)
1. Vê um edital que não interessa
2. Clica no botão de lixeira
3. Confirma exclusão
4. Edital é removido do banco e da lista

### Passo 4: Analisar com IA
1. Vê um edital interessante
2. Clica em "Analisar"
3. Sistema exibe "Analisando..."
4. IA:
   - Lê o PDF/conteúdo
   - Faz resumo
   - Extrai requisitos
   - Extrai itens financiáveis
   - Calcula score
5. Status muda para **ANALISADO**
6. Botão muda para "Ver Catálogo IA"

### Passo 5: Revisar Resultado
1. Clica em "Ver Catálogo IA" ou "Detalhes"
2. Abre modal com análise completa:
   - Resumo
   - Objetivo
   - Requisitos obrigatórios
   - Itens financiáveis
   - Documentos necessários
   - Critérios de avaliação
   - Alertas/Pontos fracos
3. Botão "Ir para Portal Oficial"

## 📝 Arquivos Modificados

### Nova Rota
- `app/api/editais/deletar/route.ts` - Implementa DELETE

### Alteradas
- `app/editais/page.tsx` - UI com botões de exclusão e análise
- `app/api/editais/busca/route.ts` - Removou análise automática

## 🎯 Comportamento

### Exclusão
```typescript
handleDeletarEdital(id: string, titulo: string, event)
├─ Pede confirmação
├─ Remove PDF do filesystem
├─ Remove arquivo de conteúdo
├─ Remove do data/editais.json
└─ Atualiza lista na UI
```

### Análise
```typescript
handleAnalisarEdital(id: string, event)
├─ Marca como "analisando..."
├─ Chama /api/editais/analisar
├─ IA processa o edital
├─ Salva resultado
└─ Muda status para "analisado"
```

## 💡 Observações Importantes

1. **A análise SÓ acontece quando o usuário clica "Analisar"**
   - Economiza tokens de API (OpenAI)
   - Usuário tem controle total
   - Pode descartar editais sem gastar tokens

2. **Exclusão é imediata e permanente**
   - Use com cuidado!
   - PDFs são removidos do servidor
   - Não há undo

3. **Sessão Prosas expira em 8 horas**
   - Cron continua funcionando
   - Rautenticação automática

4. **Status dos editais:**
   - `pendente` - Aguardando análise
   - `analisado` - IA análise concluída
   - `sem_pdf` - Não conseguiu baixar PDF
   - `erro` - Erro durante processamento

## 🚀 Próximos Passos

1. Reiniciar servidor: `npm run dev`
2. Abrir http://localhost:3000/editais
3. Clicar "Disparar Busca Inteligente"
4. Aguardar PDFs serem baixados
5. Revisar e excluir os inúteis
6. Analisar os interessantes

## 📊 Exemplo de Fluxo Completo

```
1. "Disparar Busca Inteligente"
   → 38 editais encontrados, status = PENDENTE

2. Revisar lista
   → Ver que 20 editais não interessam

3. Excluir 20
   → Clica lixeira, confirma
   → 18 editais restam, status = PENDENTE

4. Analisar 18
   → Clica "Analisar" em cada um
   → IA processa (pode levar tempo)
   → 18 editais agora com status = ANALISADO

5. Revisar resultados
   → Clica "Ver Catálogo IA" para cada
   → Vê resumo, requisitos, itens financiáveis
   → Decide quais são viáveis para sua instituição

6. Ir para portal
   → Clica "Ir para Portal Oficial"
   → Abre a página do edital no navegador
   → Usa as informações analisadas pela IA
```

## 🔗 Links Úteis

- Página de Editais: `/editais`
- API de Busca: `/api/editais/busca` (POST)
- API de Análise: `/api/editais/analisar` (POST)
- API de Exclusão: `/api/editais/deletar` (DELETE)
- API de Listagem: `/api/editais` (GET)

---

**Versão:** 2.8  
**Data:** 29 de Maio de 2026  
**Status:** ✅ Implementado e Testado
