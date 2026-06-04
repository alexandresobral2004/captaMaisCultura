# 📊 Feedback de Consultado dos Portais

> **📍 Localização:** `docs/05-filtragem-keywords/06-feedback-portais.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

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
```

### Resumo Final

```
╔═══════════════════════════════════════════════════════════════════╗
║                    📊 RESUMO DA BUSCA                             ║
╠═══════════════════════════════════════════════════════════════════╣
║  Total de Portais: 5                                              ║
║  ✅ Sucessos: 4                                                   ║
║  ❌ Erros: 1                                                      ║
║  📋 Total de Editais: 23                                          ║
║  ⏱️  Tempo Total: 12.43s                                          ║
╚═══════════════════════════════════════════════════════════════════╝

  Portal              Status    Editais    Tempo
  ─────────────────────────────────────────────────
  Prosas              ✅ OK     12         3.45s
  FINEP               ✅ OK     5          2.18s
  CNPq                ✅ OK     3          1.92s
  CAPES               ✅ OK     3          2.10s
  Min. Ciência        ❌ ERRO   0          timeout

  Detalhes de Erros:
  ❌ Min. Ciência: Timeout após 30s
     → Será retentado em próxima execução
```

---

## 🎨 Recursos Visuais

### Cores ANSI para Diferentes Status

```typescript
const CORES = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
};
```

### Ícones por Status

| Status | Ícone | Cor |
|--------|-------|-----|
| Sucesso | ✅ | Verde |
| Erro | ❌ | Vermelho |
| Aviso | ⚠️ | Amarelo |
| Info | ℹ️ | Azul |
| Processando | ⏳ | Ciano |

---

## 🔧 Implementação

### Arquivo: `lib/scraper/fetcher.ts`

#### Função `consultarPortalComFeedback`

```typescript
async function consultarPortalComFeedback(
  nome: string,
  index: number,
  total: number,
  fnBuscar: () => Promise<Edital[]>
): Promise<{ portal: string, editais: Edital[], tempo: number, status: 'ok' | 'erro', erro?: string }> {
  console.log(`  📥 [${index}/${total}] Consultando Portal ${nome}...`);

  const inicio = Date.now();
  try {
    const editais = await fnBuscar();
    const tempo = (Date.now() - inicio) / 1000;
    console.log(`      ✅ SUCESSO | ${editais.length} editais retornados | ${tempo.toFixed(2)}s`);
    return { portal: nome, editais, tempo, status: 'ok' };
  } catch (err) {
    const tempo = (Date.now() - inicio) / 1000;
    console.error(`      ❌ ERRO | ${err.message} | ${tempo.toFixed(2)}s`);
    return { portal: nome, editais: [], tempo, status: 'erro', erro: err.message };
  }
}
```

#### Função `exibirResumoFinal`

```typescript
function exibirResumoFinal(resultados: ResultadoPortal[]) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                📊 RESUMO DA BUSCA                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const sucessos = resultados.filter(r => r.status === 'ok').length;
  const erros = resultados.filter(r => r.status === 'erro').length;
  const totalEditais = resultados.reduce((acc, r) => acc + r.editais.length, 0);
  const tempoTotal = resultados.reduce((acc, r) => acc + r.tempo, 0);

  console.log(`  Total de Portais: ${resultados.length}`);
  console.log(`  ✅ Sucessos: ${sucessos}`);
  console.log(`  ❌ Erros: ${erros}`);
  console.log(`  📋 Total de Editais: ${totalEditais}`);
  console.log(`  ⏱️  Tempo Total: ${tempoTotal.toFixed(2)}s\n`);

  // Tabela detalhada
  console.log('  Portal              Status    Editais    Tempo');
  console.log('  ─────────────────────────────────────────────────');

  resultados.forEach(r => {
    const status = r.status === 'ok' ? '✅ OK   ' : '❌ ERRO ';
    console.log(`  ${r.portal.padEnd(20)} ${status} ${String(r.editais.length).padEnd(10)} ${r.tempo.toFixed(2)}s`);
  });

  // Detalhes de erros
  const errosDetalhados = resultados.filter(r => r.status === 'erro');
  if (errosDetalhados.length > 0) {
    console.log('\n  Detalhes de Erros:');
    errosDetalhados.forEach(r => {
      console.log(`  ❌ ${r.portal}: ${r.erro}`);
    });
  }
}
```

---

## 📊 Métricas Capturadas

### Por Portal
- ✅ Status (ok/erro)
- ✅ Quantidade de editais retornados
- ✅ Quantidade de editais válidos (após filtro)
- ✅ Tempo de resposta total
- ✅ Mensagem de erro (se houver)

### Consolidadas
- ✅ Total de portais consultados
- ✅ Taxa de sucesso (%)
- ✅ Total de editais únicos (deduplicados)
- ✅ Tempo total de execução
- ✅ Custo OpenAI (se aplicável)

---

## 📁 Relatório JSON Gerado

```json
{
  "execucaoId": "uuid-aqui",
  "timestamp": "2026-05-29T10:30:00Z",
  "duracaoTotal": 12.43,
  "portais": [
    {
      "nome": "Prosas",
      "status": "ok",
      "editaisBrutos": 50,
      "editaisValidos": 12,
      "tempo": 3.45,
      "custoOpenAi": 0.002
    },
    {
      "nome": "FINEP",
      "status": "ok",
      "editaisBrutos": 13,
      "editaisValidos": 5,
      "tempo": 2.18
    }
  ],
  "consolidado": {
    "totalEditaisUnicos": 23,
    "editaisNovos": 8,
    "editaisAtualizados": 15,
    "taxaSucesso": 0.8
  }
}
```

**Localização:** `logs/busca-{timestamp}.json`

---

## 📚 Documentação Relacionada

- **Mudanças no pipeline:** [`../03-fluxos/06-mudancas-pipeline.md`](../03-fluxos/06-mudancas-pipeline.md)
- **Melhorias v2.0:** [`05-melhorias-busca-v2.md`](05-melhorias-busca-v2.md)
- **Integração Ministério da Ciência:** [`../06-integracoes/01-ministerio-ciencia.md`](../06-integracoes/01-ministerio-ciencia.md)
- **Análise Prosas:** [`../06-integracoes/02-analise-prosas-detalhada.md`](../06-integracoes/02-analise-prosas-detalhada.md)
