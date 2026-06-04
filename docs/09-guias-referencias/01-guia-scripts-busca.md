# 🚀 GUIA DE SCRIPTS - BUSCA DE EDITAIS

> **📍 Localização:** `docs/09-guias-referencias/01-guia-scripts-busca.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

**Data:** 29 de Maio de 2026
**Status:** ✅ Scripts criados e testados

---

## 📋 SUMÁRIO

Dois scripts criados para facilitar busca manual e automática de editais:

1. **[`scripts/buscar-editais.sh`](../../scripts/buscar-editais.sh)** - Executa busca manual
2. **[`scripts/setup-cron.sh`](../../scripts/setup-cron.sh)** - Configura execução automática com cron

---

## 🔧 SCRIPT 1: `buscar-editais.sh`

### Descrição
Script que executa a busca semanal de editais com validação de keywords.

### Localização
```bash
/Users/alexandrerocha/captaMais/scripts/buscar-editais.sh
```

### Uso Básico

#### Execução simples (recomendado)
```bash
cd /Users/alexandrerocha/captaMais
./scripts/buscar-editais.sh
```

#### Com logs detalhados
```bash
./scripts/buscar-editais.sh --verbose
```

#### Modo teste (sem fazer chamadas reais)
```bash
./scripts/buscar-editais.sh --dry-run
```

#### Com URL customizada
```bash
./scripts/buscar-editais.sh --url http://localhost:3000
```

#### Com token de segurança
```bash
./scripts/buscar-editais.sh --token seu-token-aqui
```

#### Combinado
```bash
./scripts/buscar-editais.sh --verbose --token seu-token --url http://localhost:3000
```

### Opções Disponíveis

| Opção | Descrição | Exemplo |
|-------|-----------|---------|
| `--verbose` | Exibe logs detalhados | `./buscar-editais.sh --verbose` |
| `--dry-run` | Simula sem fazer chamadas | `./buscar-editais.sh --dry-run` |
| `--url <URL>` | Especifica URL da API | `./buscar-editais.sh --url http://localhost:3000` |
| `--token <TKN>` | Token de segurança | `./buscar-editais.sh --token abc123` |
| `--help` | Mostra ajuda | `./buscar-editais.sh --help` |

---

## 🔧 SCRIPT 2: `setup-cron.sh`

### Descrição
Script interativo para configurar execução automática com cron.

### Uso
```bash
./scripts/setup-cron.sh
```

### Menu Interativo

```
╔════════════════════════════════════════════════╗
║   🕐 CONFIGURADOR DE CRON - BUSCA DE EDITAIS   ║
╚════════════════════════════════════════════════╝

Escolha uma opção:

  1) Agendar toda segunda-feira às 08:00 (recomendado)
  2) Agendar todos os dias às 08:00
  3) Visualizar cron atual
  4) Remover cron
  5) Testar script manualmente
  6) Sair

Opção: _
```

### Agendamento Manual (alternativa)

```bash
# Editar crontab
crontab -e

# Adicionar linha (toda segunda às 08:00)
0 8 * * 1 cd /Users/alexandrerocha/captaMais && ./scripts/buscar-editais.sh >> logs/cron.log 2>&1
```

---

## 🚀 Quick Start

### 1. Testar Manualmente
```bash
cd /Users/alexandrerocha/captaMais
./scripts/buscar-editais.sh --dry-run
```

### 2. Agendar com Cron
```bash
./scripts/setup-cron.sh
# Escolher opção 1 ou 2
```

### 3. Verificar Agendamento
```bash
crontab -l | grep buscar-editais
```

### 4. Monitorar Logs
```bash
tail -f logs/busca-editais-$(date +%Y%m%d).log
```

### 5. Verificar PDFs Baixados
```bash
ls -lh data/downloads/edital-*.pdf
```

---

## 📂 Arquivos Gerados

### Logs
- `logs/busca-editais-YYYYMMDD.log` — log principal
- `logs/cron.log` — log do cron
- `data/logs/validacoes/validacoes-YYYY-MM-DD.jsonl` — validações keywords

### Resultados
- `data/db/editais.db` — banco SQLite com editais
- `data/downloads/edital-{id}.pdf` — PDFs baixados
- `data/notificacoes/{uuid}.json` — notificações geradas

### Relatórios
- JSON com estatísticas por portal
- Métricas de tempo de execução
- Contadores de sucesso/erro

---

## 🐛 Troubleshooting

### Erro: "curl: command not found"
```bash
# macOS
brew install curl

# Ubuntu/Debian
sudo apt-get install curl
```

### Erro: "Server not running"
```bash
# Iniciar servidor primeiro
npm run dev

# Em outro terminal
./scripts/buscar-editais.sh
```

### Erro: "Token inválido"
```bash
# Verificar token no .env.local
cat .env.local | grep SCAN_TOKEN

# Usar token correto
./scripts/buscar-editais.sh --token "seu-token-do-env-local"
```

### Erro: "Permission denied"
```bash
chmod +x scripts/buscar-editais.sh
chmod +x scripts/setup-cron.sh
```

---

## 📚 Documentação Relacionada

- **Resumo dos scripts:** [`06-resumo-scripts-final.md`](06-resumo-scripts-final.md)
- **README scripts:** [`../../scripts/README.md`](../../scripts/README.md)
- **Implementação com IA:** [`../04-implementacao/02-implementacao-editais-com-ia.md`](../04-implementacao/02-implementacao-editais-com-ia.md)
