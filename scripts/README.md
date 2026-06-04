# 🚀 Scripts do Capta+

> **📚 Para a documentação completa, consulte [`docs/00-INDICE.md`](../docs/00-INDICE.md).**
> **📖 Guia detalhado:** [`docs/09-guias-referencias/01-guia-scripts-busca.md`](../docs/09-guias-referencias/01-guia-scripts-busca.md)

## Scripts Disponíveis

### 🔍 Busca de Editais

#### `buscar-editais.sh`
Script principal que executa a busca de editais nos portais integrados.

**Uso rápido:**
```bash
./buscar-editais.sh                    # Execução padrão
./buscar-editais.sh --verbose          # Com logs detalhados
./buscar-editais.sh --dry-run          # Teste sem chamadas reais
./buscar-editais.sh --help             # Mostra ajuda
```

#### `setup-cron.sh`
Script interativo para configurar execução automática com cron.

**Uso:**
```bash
./setup-cron.sh                        # Abre menu interativo
```

Menu oferece opções para:
- Agendar segunda-feira 08:00
- Agendar todos os dias 08:00
- Visualizar cron agendado
- Remover cron
- Testar script

### 📝 Resumo e Resumir Editais

- **`resumir-editais.sh`** — Script shell para resumir editais
- **`resumir-editais.js`** — Versão Node.js
- **`resumir-editais.ts`** — Versão TypeScript
- **`resumir-editais-simples.js`** — Versão simplificada

### 🧪 Testes e Exploração

- **`teste-prosas.js`** — Testes do scraper Prosas
- **`explore-prosas-api.js`** — Exploração da API Prosas

### 🗄️ Banco de Dados

- **`migrate-json-to-sqlite.ts`** — Migração de JSON para SQLite
- **`reset-db.ts`** — Reset completo do banco
- **`test_schema.ts`** — Teste de schema do banco

## 🚀 Quick Start

### 1. Testar manualmente
```bash
cd /Users/alexandrerocha/captaMais
./scripts/buscar-editais.sh --dry-run
```

### 2. Agendar com cron
```bash
./scripts/setup-cron.sh
# Escolher opção 1 ou 2
```

### 3. Verificar agendamento
```bash
crontab -l | grep buscar-editais
```

### 4. Monitorar logs
```bash
tail -f ../logs/busca-editais-$(date +%Y%m%d).log
```

### 5. Migrar banco (se necessário)
```bash
npx tsx scripts/migrate-json-to-sqlite.ts
```

## 📚 Documentação Detalhada

Para informações completas sobre cada script, consulte:

- **[`docs/09-guias-referencias/01-guia-scripts-busca.md`](../docs/09-guias-referencias/01-guia-scripts-busca.md)** — Guia completo dos scripts de busca
- **[`docs/09-guias-referencias/06-resumo-scripts-final.md`](../docs/09-guias-referencias/06-resumo-scripts-final.md)** — Resumo dos scripts criados
- **[`docs/04-implementacao/02-implementacao-editais-com-ia.md`](../docs/04-implementacao/02-implementacao-editais-com-ia.md)** — Sistema completo com IA

## 🐛 Troubleshooting

### Permissão negada
```bash
chmod +x scripts/*.sh
```

### Curl não encontrado
```bash
# macOS
brew install curl
```

### Servidor não está rodando
```bash
# Em outro terminal
npm run dev
```

### Mais ajuda
Consulte o [`docs/00-INDICE.md`](../docs/00-INDICE.md) para acessar a documentação completa.

---

**Versão:** CaptaMais v3.0
**Última atualização:** 04/06/2026
