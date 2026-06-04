# 🚀 GUIA DE IMPLEMENTAÇÃO - ATIVAR FILTRAGEM EM PRODUÇÃO

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
  true  // ← ATIVAR validação com keywords
);
```

### Verificar mudança:
```bash
cd /Users/alexandrerocha/captaMais
git diff app/api/jobs/run-weekly-scan/route.ts
```

---

## 🧪 PASSO 2: TESTAR MANUALMENTE

### Opção A: Via curl (recomendado)
```bash
# Disparar busca semanal
curl -X POST http://localhost:3000/api/jobs/run-weekly-scan \
  -H "Content-Type: application/json" \
  -d '{"token":"seu-token-aqui"}'
```

### Opção B: Via interface (se habilitado)
1. Ir para http://localhost:3000/api/jobs/run-weekly-scan
2. Observar logs no console do servidor

### Esperado:
```
📥 FASE 1: Buscando editais nos portais...
✅ X editais encontrados

📄 FASE 3: Baixando e lendo PDFs...
   🔍 Validando conteúdo com palavras-chave...
   ✅ Validação aprovada: Score 85%, Confiança 92%
   
✅ Y editais salvos com validação de keywords
```

---

## 📊 PASSO 3: MONITORAR LOGS

### Localização dos logs:
```
data/logs/validacoes/validacoes-YYYY-MM-DD.jsonl
```

### Exemplo de log (uma linha por validação):
```json
{
  "timestamp": "2026-05-29T14:30:45.123Z",
  "editalId": "prosas-12345",
  "fonte": "prosas_s3",
  "titulo": "Edital FINEP 2024",
  "resultado": {
    "isEdital": true,
    "scoreTotal": 85,
    "confianca": 92,
    "contagem": { "mandatoryTerms": 12, "likelyTerms": 8, ... }
  },
  "tamanhoTexto": 45320,
  "tempoProcessamento": 8,
  "status": "aprovado"
}
```

### Ler logs com Python:
```bash
python3 << 'EOF'
import json
from pathlib import Path

log_dir = Path('data/logs/validacoes')
if log_dir.exists():
    for log_file in sorted(log_dir.glob('validacoes-*.jsonl')):
        print(f"\n📄 {log_file.name}:")
        with open(log_file) as f:
            for i, line in enumerate(f, 1):
                try:
                    data = json.loads(line)
                    status = "✅" if data['resultado']['isEdital'] else "❌"
                    score = data['resultado']['scoreTotal']
                    print(f"  {i}. {status} {data['editalId']} - Score: {score}%")
                except:
                    pass
EOF
```

---

## 📈 PASSO 4: GERAR RELATÓRIO

### Via API (criar endpoint):
```typescript
// app/api/relatorio/validacoes/route.ts
import { gerarRelatorioValidacoes, exibirRelatorioPretty } from '@/lib/scraper/keyword-logger';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dias = parseInt(url.searchParams.get('dias') || '7');
  
  const dataInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const relatorio = gerarRelatorioValidacoes(dataInicio, new Date());
  
  return Response.json(relatorio);
}
```

Depois acessar:
```
http://localhost:3000/api/relatorio/validacoes?dias=7
```

### Via script Node:
```bash
node << 'EOF'
const { gerarRelatorioValidacoes, salvarRelatorioJSON } = require('./lib/scraper/keyword-logger');

const relatorio = gerarRelatorioValidacoes(
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  new Date()
);

console.log(`
📊 RELATÓRIO (últimos 7 dias)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: ${relatorio.total}
Aprovados: ${relatorio.aprovados} (${relatorio.taxaAprovacao}%)
Rejeitados: ${relatorio.rejeitados}
Score médio (aprovados): ${relatorio.scoreMediaAprovados}%
Palavras-chave média: ${relatorio.palavrasChaveMedia}
`);

salvarRelatorioJSON(relatorio);
EOF
```

---

## ⚠️ PASSO 5: REVISAR RESULTADOS

### Checklist de qualidade:

```
✅ Taxa de aprovação está entre 70-90%?
   - Muito baixa (< 50%): aumentar threshold
   - Muito alta (> 95%): usar validação mais rigorosa

✅ Score médio > 80%?
   - Se < 70%: pode indicar muitos borderline cases

✅ Nenhum edital comercial aprovado?
   - Se sim: palavras-chave de edital no documento incomum

✅ Editais de pesquisa sendo capturados?
   - Se não: verificar se threshold é apropriado

✅ Tempo de processamento < 50ms por edital?
   - Se > 100ms: performance aceitável mas otimizar se possível
```

---

## 🔧 PASSO 6: AJUSTES (SE NECESSÁRIO)

### Aumentar rigor (rejeitar mais)
```typescript
// Em keyword-validator.ts
const densidadeMinima = 7; // Era 5, agora 7
```

Impacto:
- Menos false positives
- Pode rejeitar editais borderline
- Recomendado se taxa aprovação > 95%

### Aumentar peso de termos obrigatórios
```typescript
// Em keyword-validator.ts, função scoreTotal
if (contagem.mandatoryTerms > 0) confianca = Math.min(100, confianca + 20); // Era 10
```

Impacto:
- Editais bem estruturados recebem pontuação maior
- Recomendado para aumentar qualidade

### Adicionar novo tipo de oportunidade
```typescript
// Em keyword-map.ts
residenciaPos: [
  "residência pós-doutoral",
  "bolsa pós-doc",
  "pós-doutorado",
  // ...
]
```

---

## 🚨 TROUBLESHOOTING

### Problema: "Muitos editais sendo rejeitados"
**Solução:**
```bash
# Verificar logs
tail -f data/logs/validacoes/validacoes-$(date +%Y-%m-%d).jsonl | grep "Rejeitado"

# Se threshold muito alto:
# Reduzir de 7 para 5 em keyword-validator.ts
```

### Problema: "Editais comerciais sendo aprovados"
**Solução:**
```bash
# Revisar logs dos rejeitados
jq '.[] | select(.resultado.isEdital == true) | select(.resultado.confianca < 70)' 
data/logs/validacoes/*.jsonl

# Aumentar peso de termos obrigatórios em keyword-validator.ts
```

### Problema: "Logs não estão sendo criados"
**Solução:**
```bash
# Verificar permissões
ls -la data/logs/validacoes/

# Se não existe, criar
mkdir -p data/logs/validacoes

# Verificar se função está sendo chamada
grep "registrarValidacao" app/api/jobs/run-weekly-scan/route.ts
```

### Problema: "Performance está lenta"
**Solução:**
```bash
# Verificar tamanho de arquivo de log
du -h data/logs/validacoes/

# Se muito grande (> 100MB), arquivar logs antigos
gzip data/logs/validacoes/validacoes-2026-04-*.jsonl
```

---

## 📝 CHECKLIST FINAL DE IMPLEMENTAÇÃO

### Antes de ativar:
- [ ] Arquivo `app/api/jobs/run-weekly-scan/route.ts` modificado (linha 95)
- [ ] TypeScript compila sem erros: `npm run build`
- [ ] Teste manual executado com sucesso
- [ ] Logs estão sendo criados em `data/logs/validacoes/`

### Depois de ativar:
- [ ] Primeira busca semanal executada com validação
- [ ] Relatório gerado mostrando estatísticas
- [ ] Nenhum erro no console do servidor
- [ ] Editais salvos com novos campos de validação
- [ ] Documentação atualizada

### Monitoramento contínuo:
- [ ] Verificar logs 1x por dia por 1 semana
- [ ] Revisar relatório após 1 semana
- [ ] Ajustar threshold se necessário
- [ ] Documentar resultados

---

## 🎯 PRÓXIMOS PASSOS

1. **Hoje:** Ativar validação na pipeline
2. **Amanhã:** Executar primeira busca semanal
3. **Próxima semana:** Revisar logs e relatório
4. **Semana 2:** Ajustar configurações se necessário
5. **Semana 3+:** Integrar scores no dashboard

---

## 📞 REFERÊNCIAS

- Documentação completa: `GUIA_VALIDACAO_KEYWORDS.md`
- Avaliação dos testes: `AVALIACAO_FILTRAGEM_KEYWORDS.md`
- Código-fonte:
  - `lib/scraper/keyword-validator.ts`
  - `lib/scraper/pdf-downloader.ts`
  - `lib/scraper/keyword-logger.ts`

---

## ✅ CONCLUSÃO

**O sistema está pronto. Implementação leva < 5 minutos.**

```
1. Editar 1 linha do código (linha 95, adicionar "true")
2. Fazer commit
3. Deploy
4. Pronto ✅
```

A validação vai rodar automaticamente na próxima busca semanal.
