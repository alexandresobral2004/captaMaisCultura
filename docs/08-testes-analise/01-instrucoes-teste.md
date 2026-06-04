# 🧪 Instruções de Teste - Sistema de Busca TI

> **📍 Localização:** `docs/08-testes-analise/01-instrucoes-teste.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

## ✅ Pré-requisitos

### 1. Verificar Variáveis de Ambiente
```bash
# Verificar se as variáveis estão em .env.local
cat /Users/alexandrerocha/captaMais/.env.local | grep -E "OPENAI|PROSAS"

# Esperado:
# PROSAS_EMAIL=seu_email@example.com
# PROSAS_PASSWORD=sua_senha
# OPENAI_API_KEY=sk-proj-xxxxx
```

### 2. Verificar Portais Configurados
```bash
# Ver portais em data/portais-config.json
cat /Users/alexandrerocha/captaMais/data/portais-config.json | jq '.[] | {id, nome}'

# Deve conter:
# - prosas
# - finep
# - cnpq
# - capes
```

---

## 🚀 TESTE 1: Build da Aplicação

```bash
cd /Users/alexandrerocha/captaMais
npm run build
```

**Resultado esperado:**
```
✓ Compiled successfully
Linting and checking validity of types ...
```

---

## 🧪 TESTE 2: Testes Unitários

```bash
npm run test
```

**Saída esperada:**
```
✓ __tests__/audit-logger.test.ts
✓ __tests__/blacklist-engine.test.ts
✓ __tests__/blacklist-engine-extended.test.ts
✓ __tests__/decision-engine.test.ts
✓ __tests__/editais-store.test.ts
✓ __tests__/filtros-loaders.test.ts
✓ __tests__/filtros-whitelist.test.ts
✓ __tests__/openai-classifier.test.ts
✓ __tests__/jobs/job-runner.test.ts
✓ __tests__/services/portal.service.test.ts
✓ __tests__/repositories/*.test.ts
```

---

## 🚀 TESTE 3: Execução Manual da Busca

```bash
# Modo dry-run (sem chamadas reais)
./scripts/buscar-editais.sh --dry-run --verbose

# Modo real
./scripts/buscar-editais.sh --verbose
```

**Saída esperada (modo dry-run):**
```
╔════════════════════════════════════════════╗
║  🚀 BUSCA DE EDITAIS - CaptaMais         ║
╚════════════════════════════════════════════╝

[INFO] Configurando diretórios...
[✓] Diretórios criados/verificados
[INFO] Modo simulação ativado
[INFO] 5 portais serão consultados
[INFO] Validação de keywords ativada
```

---

## 🚀 TESTE 4: Análise Manual de Edital

```bash
# Disparar análise via API
curl -X POST http://localhost:3000/api/editais/analisar \
  -H "Content-Type: application/json" \
  -d '{"id": "prosas-12345"}'
```

**Resposta esperada:**
```json
{
  "message": "Análise iniciada em background",
  "editalId": "prosas-12345"
}
```

---

## 🚀 TESTE 5: Validação de Keywords (Independente)

```bash
# Endpoint de teste
curl -X POST http://localhost:3000/api/teste/validacao-keywords \
  -H "Content-Type: application/json" \
  -d '{
    "texto": "EDITAL DE CHAMADA PÚBLICA PARA PESQUISA EM IA",
    "editalId": "test-1"
  }'
```

**Resposta esperada:**
```json
{
  "aprovado": true,
  "score": 95,
  "confianca": 90,
  "densidade": 28.5
}
```

---

## 🧪 TESTE 6: Verificar Filtros TI

```bash
npx tsx scripts/teste-validacao-keywords.ts
```

**Saída esperada:**
```
Executando 7 cenários de teste:
  ✓ editalValido (100%) - APROVADO
  ✓ textoGenerico (0%) - REJEITADO
  ✓ editalPesquisaAcademica (100%) - APROVADO
  ✓ textoComercial (10%) - REJEITADO
  ✓ editalEvento (95%) - APROVADO
  ✓ textoMuitoCurto (20%) - REJEITADO
  ✓ editalFinanciamento (100%) - APROVADO

Taxa de Acurácia: 100% (7/7)
```

---

## 📊 TESTE 7: Verificar Performance

```bash
# Medir tempo de execução completa
time ./scripts/buscar-editais.sh --dry-run
```

**Esperado:** < 30 segundos (modo simulação)

---

## 🐛 Troubleshooting

### Erro: "OPENAI_API_KEY not found"
**Solução:** Criar arquivo `.env.local` com a chave.

### Erro: "PROSAS credentials missing"
**Solução:** Adicionar `PROSAS_EMAIL` e `PROSAS_PASSWORD` ao `.env.local`.

### Erro: "Build failed"
**Solução:**
```bash
rm -rf .next
npm run build
```

### Erro: "Testes falhando"
**Solução:**
```bash
npm install
npm run test
```

---

## 📚 Documentação Relacionada

- **Workflow test report:** [`02-workflow-test-report.md`](02-workflow-test-report.md)
- **Token waste analysis:** [`03-token-waste-analysis.md`](03-token-waste-analysis.md)
- **Guia de validação:** [`../05-filtragem-keywords/02-guia-validacao-keywords.md`](../05-filtragem-keywords/02-guia-validacao-keywords.md)
