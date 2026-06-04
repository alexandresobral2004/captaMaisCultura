# 📊 Feedback de Consultado dos Portais

## Implementação Concluída

O sistema agora exibe um **feedback visual detalhado** no console ao executar a varredura semanal, mostrando:

1. ✅ **Portais consultados**
2. ✅ **Status de cada consulta** (sucesso/erro)
3. ✅ **Quantidade de editais retornados** por portal
4. ✅ **Tempo de resposta** de cada portal
5. ✅ **Resumo consolidado** final

---

## 📋 Exemplo de Output no Console

### Durante a Execução

```
╔═══════════════════════════════════════════════════════════════════╗
║       🚀 INICIANDO BUSCA CONSOLIDADA NOS PORTAIS 🚀              ║
╚═══════════════════════════════════════════════════════════════════╝

  📥 [1/4] Consultando Portal Prosas...
🌐 [PROSAS] Solicitando token de acesso (OAuth2 Client Credentials)...
🌐 [PROSAS] Extraindo dados via API V2...
[PROSAS] 50 editais retornados pela API V2. Buscando detalhes...
      ✅ SUCESSO | 12 editais retornados | 3.45s

  📥 [2/4] Consultando Portal FINEP...
🌐 [FINEP] Iniciando busca de editais...
📊 [FINEP] Resultado: 5 válidos, 8 rejeitados
      ✅ SUCESSO | 5 editais retornados | 2.18s

  📥 [3/4] Consultando Portal CNPq...
🌐 [CNPq] Iniciando busca de editais...
[CNPq] Processando editais por categoria...
      ✅ SUCESSO | 3 editais retornados | 1.92s

  📥 [4/4] Consultando Portal CAPES...
🌐 [CAPES] Iniciando busca de editais...
[CAPES] Consultando API com paginação...
      ✅ SUCESSO | 2 editais retornados | 2.14s
```

### Resumo Consolidado Final

```
╔═══════════════════════════════════════════════════════════════════╗
║                     📊 RESUMO DE CONSULTAS                         ║
╚═══════════════════════════════════════════════════════════════════╝

  Portal         | Status | Editais Retornados | Tempo (s)
  ─────────────────────────────────────────────────────────────
  Prosas         | ✅ OK    | 12                 |      3.45
  FINEP          | ✅ OK    | 5                  |      2.18
  CNPq           | ✅ OK    | 3                  |      1.92
  CAPES          | ✅ OK    | 2                  |      2.14
  ─────────────────────────────────────────────────────────────
  TOTAL: 4/4 portais com sucesso | 22 editais | 1.32 min
```

---

## 🔴 Exemplo com Erro em Um Portal

```
╔═══════════════════════════════════════════════════════════════════╗
║       🚀 INICIANDO BUSCA CONSOLIDADA NOS PORTAIS 🚀              ║
╚═══════════════════════════════════════════════════════════════════╝

  📥 [1/4] Consultando Portal Prosas...
      ✅ SUCESSO | 12 editais retornados | 3.45s

  📥 [2/4] Consultando Portal FINEP...
      ✅ SUCESSO | 5 editais retornados | 2.18s

  📥 [3/4] Consultando Portal CNPq...
      ❌ ERRO | Connection timeout after 30s | 30.00s

  📥 [4/4] Consultando Portal CAPES...
      ✅ SUCESSO | 2 editais retornados | 2.14s


╔═══════════════════════════════════════════════════════════════════╗
║                     📊 RESUMO DE CONSULTAS                         ║
╚═══════════════════════════════════════════════════════════════════╝

  Portal         | Status  | Editais Retornados | Tempo (s)
  ─────────────────────────────────────────────────────────────
  Prosas         | ✅ OK    | 12                 |      3.45
  FINEP          | ✅ OK    | 5                  |      2.18
  CNPq           | ❌ ERRO  | 0                  |     30.00
  CAPES          | ✅ OK    | 2                  |      2.14
  ─────────────────────────────────────────────────────────────
  TOTAL: 3/4 portais com sucesso | 19 editais | 1.27 min
```

---

## 🎯 Informações Exibidas

### Por Portal (Linha Individual)

```
  📥 [N/4] Consultando Portal [NOME]...
      [STATUS] | [QUANTIDADE] editais retornados | [TEMPO]s
```

**Componentes:**

- **Status**: 
  - ✅ SUCESSO (portal consultado com êxito, mesmo que tenha retornado 0 editais)
  - ❌ ERRO (falha na consulta com mensagem de erro)

- **Quantidade de Editais**:
  - Número absoluto de editais válidos retornados pelo portal
  - Inclui editais que passaram na classificação IA

- **Tempo**:
  - Tempo em segundos da consulta completa do portal
  - Inclui: autenticação, busca, processamento e salvamento

### Resumo Final (Tabela)

```
  Portal         | Status | Editais Retornados | Tempo (s)
  ─────────────────────────────────────────────────────────────
  [Nome Portal]  | [Status] | [Quantidade]   | [Tempo]
```

**Linha de Total:**

```
  TOTAL: X/4 portais com sucesso | Y editais | Z min
```

Onde:
- **X/4**: Quantos portais foram consultados com sucesso
- **Y editais**: Total de editais válidos encontrados em todos os portais
- **Z min**: Tempo total da varredura em minutos

---

## 💻 Localização do Código

### Arquivo Principal: `lib/scraper/fetcher.ts`

**Função:** `buscarEditaisPortais()`

**Mudanças:**
1. Interface `StatusPortal` adicionada para rastrear dados
2. Feedback visual durante cada consulta
3. Tabela consolidada ao final
4. Cálculo de sucessos e totais

### Exemplo de Código

```typescript
interface StatusPortal {
  nome: string;
  numero: number;
  sucesso: boolean;
  editaisRetornados: number;
  tempo: number;
  erro?: string;
}

const statusPortais: StatusPortal[] = [];

// Para cada portal...
try {
  console.log('  📥 [1/4] Consultando Portal Prosas...');
  const editaisProsas = await buscarEditaisProsas();
  const tempoProasDecorrido = ((Date.now() - tempoProsa) / 1000).toFixed(2);
  
  statusPortais.push({
    nome: 'Prosas',
    numero: 1,
    sucesso: true,
    editaisRetornados: editaisProsas.length,
    tempo: parseFloat(tempoProasDecorrido)
  });
  
  console.log(`      ✅ SUCESSO | ${editaisProsas.length} editais retornados | ${tempoProasDecorrido}s\n`);
} catch (err: any) {
  // Feedback de erro com mensagem
  console.warn(`      ❌ ERRO | ${err.message} | ${tempoProasDecorrido}s\n`);
}
```

---

## 📊 Fluxo Completo de Feedback

```
[Iniciar Varredura]
        ↓
[Cabeçalho Visual]
╔═══════════════════════════════════════════════════════════════════╗
║       🚀 INICIANDO BUSCA CONSOLIDADA NOS PORTAIS 🚀              ║
╚═══════════════════════════════════════════════════════════════════╝
        ↓
[Para cada portal: 1. Prosas, 2. FINEP, 3. CNPq, 4. CAPES]
        ↓
[Consultar Portal]
  📥 [N/4] Consultando Portal...
        ↓
[Mostrar Resultado]
      ✅ SUCESSO | X editais retornados | Ys
        ↓
[Se não foi último, aguardar rate limiting]
  (5 segundos entre portais)
        ↓
[Todos os portais consultados]
        ↓
[Cabeçalho do Resumo]
╔═══════════════════════════════════════════════════════════════════╗
║                     📊 RESUMO DE CONSULTAS                         ║
╚═══════════════════════════════════════════════════════════════════╝
        ↓
[Exibir Tabela]
  Portal         | Status | Editais Retornados | Tempo (s)
  ─────────────────────────────────────────────────────────────
  [Todos os portais em linhas formatadas]
        ↓
[Exibir Total]
  TOTAL: X/4 portais com sucesso | Y editais | Z min
        ↓
[Fim da Varredura de Portais]
```

---

## 🎨 Elementos Visuais Usados

### Emojis

- 📥 = Iniciando consulta de portal
- ✅ = Sucesso
- ❌ = Erro
- 📊 = Resumo/Estatísticas
- 🚀 = Inicio/Ação importante

### Caracteres Especiais

- ╔═╚═║ = Bordas de caixa
- ─ = Linhas separadoras

### Formatação

- Cores (em terminal): mensagens de erro em vermelho, sucesso em verde
- Alinhamento: números alinhados à direita em tabelas
- Espaçamento: linhas em branco entre seções para legibilidade

---

## 📝 Exemplo de Chamada

```bash
# Via cURL
curl -X POST http://localhost:3001/api/jobs/run-weekly-scan \
  -H "Content-Type: application/json"

# Via Cron Job (segunda-feira 08:00)
0 8 * * 1 curl -X POST http://localhost:3001/api/jobs/run-weekly-scan

# Via Agendador Interno (node-cron)
// Dispara automaticamente segunda-feira 08:00 UTC
```

---

## 🔍 Informações Retornadas

### Response JSON

```json
{
  "success": true,
  "mensagem": "Varredura completada com sucesso",
  "estatisticas": {
    "portaisVaridos": 4,
    "itensEncontrados": 22,
    "editaisValidados": 1,
    "editaisAnalisados": 0,
    "editaisComErro": 0,
    "notificacoesCriadas": 0,
    "tempoMinutos": 1.32
  },
  "timestamp": "2026-05-29T04:34:08.678Z"
}
```

**Campos:**

- **portaisVaridos**: Total de portais consultados
- **itensEncontrados**: Total de itens encontrados (antes da classificação IA)
- **editaisValidados**: Itens que passaram na classificação IA (score >= 70%)
- **editaisAnalisados**: Editais com PDF analisados e salvos
- **editaisComErro**: Erros durante processamento
- **notificacoesCriadas**: Notificações geradas para o usuário
- **tempoMinutos**: Tempo total da varredura

---

## ✅ Status

**Implementação:** ✅ COMPLETA
**Testes:** ✅ VALIDADOS
**Documentação:** ✅ COMPLETA

---

## 🎯 Benefícios

1. **Visibilidade**: Usuário vê exatamente qual portal foi consultado
2. **Transparência**: Sabe se a consulta foi bem-sucedida ou teve erro
3. **Quantidade**: Vê quantos editais cada portal retornou
4. **Performance**: Monitora o tempo de resposta de cada portal
5. **Debugging**: Se algo falhar, mensagem de erro detalhada
6. **Resumo**: Visão consolidada no final da execução

---

**Data de Implementação:** 2026-05-29
**Versão:** 1.0
**Status:** ✅ Pronto para Produção

