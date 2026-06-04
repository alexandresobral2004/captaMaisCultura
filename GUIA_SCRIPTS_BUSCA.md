# 🚀 GUIA DE SCRIPTS - BUSCA DE EDITAIS

**Data:** 29 de Maio de 2026  
**Status:** ✅ Scripts criados e testados

---

## 📋 SUMÁRIO

Dois scripts criados para facilitar busca manual e automática de editais:

1. **`scripts/buscar-editais.sh`** - Executa busca manual
2. **`scripts/setup-cron.sh`** - Configura execução automática com cron

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

### Output Esperado

```
╔════════════════════════════════════════════════════════════════╗
║          🚀 BUSCA DE EDITAIS - CaptaMais                       ║
║          Data: 29/05/2026 14:30:45                            ║
╚════════════════════════════════════════════════════════════════╝

[INFO] 2026-05-29 14:30:45 - Configurando diretórios...
[✓] 2026-05-29 14:30:45 - Diretórios criados/verificados
[INFO] 2026-05-29 14:30:45 - Log será salvo em: logs/busca-editais-20260529-143045.log
[INFO] 2026-05-29 14:30:45 - 
[INFO] 2026-05-29 14:30:45 - Validando pré-requisitos...
[✓] 2026-05-29 14:30:45 - Node.js encontrado: v18.12.0
[✓] 2026-05-29 14:30:45 - npm encontrado: 9.6.4
[✓] 2026-05-29 14:30:45 - curl encontrado
[✓] 2026-05-29 14:30:45 - Projeto encontrado: /Users/alexandrerocha/captaMais

[INFO] 2026-05-29 14:30:45 - Verificando servidor em http://localhost:3000...
[✓] 2026-05-29 14:30:45 - Servidor está acessível

[INFO] 2026-05-29 14:30:45 - Disparando busca de editais...
[INFO] 2026-05-29 14:30:45 - Endpoint: http://localhost:3000/api/jobs/run-weekly-scan
[INFO] 2026-05-29 14:30:45 - Iniciando requisição POST...
[INFO] 2026-05-29 14:30:47 - Resposta recebida em 2s
[✓] 2026-05-29 14:30:47 - Resposta JSON válida
[✓] 2026-05-29 14:30:47 - Busca concluída com sucesso!
[✓] 2026-05-29 14:30:47 -   - Editais validados: 15
[✓] 2026-05-29 14:30:47 -   - Editais analisados: 12

[INFO] 2026-05-29 14:30:47 - Gerando relatório de validação...
[✓] 2026-05-29 14:30:47 - Encontrados 1 arquivo(s) de log
[✓] 2026-05-29 14:30:47 - Log mais recente: data/logs/validacoes/validacoes-2026-05-29.jsonl (15 linhas)

[INFO] 2026-05-29 14:30:47 - Salvando resultado da execução...
[✓] 2026-05-29 14:30:47 - Resultado salvo em: logs/resultado-20260529-143045.json

╔════════════════════════════════════════════════════════════════╗
║                    ✅ EXECUÇÃO CONCLUÍDA                       ║
│  Logs: /Users/alexandrerocha/captaMais/logs/                 │
│  Editais: /Users/alexandrerocha/captaMais/data/editais.json  │
╚════════════════════════════════════════════════════════════════╝
```

### Arquivos de Log

Após execução, são criados:

1. **Log detalhado da busca:**
   ```
   logs/busca-editais-YYYYMMDD-HHMMSS.log
   ```

2. **Log de validação com keywords:**
   ```
   data/logs/validacoes/validacoes-YYYY-MM-DD.jsonl
   ```

3. **Resultado da execução (JSON):**
   ```
   logs/resultado-YYYYMMDD-HHMMSS.json
   ```

4. **Log acumulado do cron (se agendado):**
   ```
   logs/cron.log
   ```

---

## ⏰ SCRIPT 2: `setup-cron.sh`

### Descrição
Script interativo para configurar execução automática com cron.

### Localização
```bash
/Users/alexandrerocha/captaMais/scripts/setup-cron.sh
```

### Execução

```bash
cd /Users/alexandrerocha/captaMais
./scripts/setup-cron.sh
```

### Menu de Opções

```
Selecione uma opção:

  1) Agendar busca automática (segunda-feira 08:00)
  2) Agendar busca automática (todos os dias 08:00)
  3) Visualizar cron agendado
  4) Remover cron agendado
  5) Testar script
  0) Sair
```

### Como Usar - Exemplo Passo a Passo

#### 1. Abrir setup do cron
```bash
./scripts/setup-cron.sh
```

#### 2. Escolher opção 1 (segunda-feira 08:00)
```
Escolha uma opção (0-5): 1
```

#### 3. Script configura automaticamente
```
[✓] Cron agendado com sucesso!

Detalhes do agendamento:
  Dia:     Segunda-feira
  Hora:    08:00
  Script:  /Users/alexandrerocha/captaMais/scripts/buscar-editais.sh
  Log:     /Users/alexandrerocha/captaMais/logs/cron.log
```

#### 4. Visualizar cron (opção 3)
```
[✓] Busca de editais encontrada:
0 8 * * 1 cd /Users/alexandrerocha/captaMais && /Users/alexandrerocha/captaMais/scripts/buscar-editais.sh >> /Users/alexandrerocha/captaMais/logs/cron.log 2>&1
```

#### 5. Testar script (opção 5)
Executa o script com `--dry-run` para validar tudo está funcionando.

---

## 📅 AGENDAMENTOS DISPONÍVEIS

### Opção 1: Segunda-feira 08:00 (Recomendado)
Executa 1x por semana no início do trabalho.

```bash
# Cron entry gerado:
0 8 * * 1 cd /Users/alexandrerocha/captaMais && ./scripts/buscar-editais.sh >> logs/cron.log 2>&1
```

**Quando funciona:** Toda segunda-feira às 08:00  
**Ideal para:** Começar semana com novos editais

### Opção 2: Todos os dias 08:00
Executa diariamente.

```bash
# Cron entry gerado:
0 8 * * * cd /Users/alexandrerocha/captaMais && ./scripts/buscar-editais.sh >> logs/cron.log 2>&1
```

**Quando funciona:** Todos os dias às 08:00  
**Ideal para:** Ter atualizações mais frequentes

---

## 🔍 VERIFICAR CRON AGENDADO

### Via script (recomendado)
```bash
./scripts/setup-cron.sh
# Escolher opção 3
```

### Via terminal direto
```bash
crontab -l | grep buscar-editais
```

### Ver todo cron
```bash
crontab -l
```

---

## 🛠️ TROUBLESHOOTING

### Problema: "Permission denied"
**Solução:**
```bash
chmod +x scripts/buscar-editais.sh
chmod +x scripts/setup-cron.sh
```

### Problema: "Command not found: node"
**Solução:** Node.js não está no PATH
```bash
# Verificar instalação
which node
node --version

# Se não encontrado, instalar via Homebrew (Mac)
brew install node
```

### Problema: "Servidor não está acessível"
**Solução:** Iniciar o servidor
```bash
npm run dev
# Em outra aba do terminal
```

### Problema: Cron não está executando
**Verificar:**
```bash
# 1. Se cron está agendado
crontab -l | grep buscar-editais

# 2. Logs do cron
tail -f logs/cron.log

# 3. Se arquivo de log está sendo criado
ls -la logs/
```

### Problema: Log file não está sendo criado
**Solução:** Verificar permissões
```bash
mkdir -p logs
chmod 755 logs

# Ou testar execução direta
./scripts/buscar-editais.sh --verbose
```

---

## 📊 MONITORAR EXECUÇÃO

### Verificar logs da busca
```bash
# Últimos 50 linhas
tail -50 logs/busca-editais-*.log

# Acompanhar em tempo real (cron)
tail -f logs/cron.log
```

### Verificar logs de validação
```bash
# Listar arquivos
ls -la data/logs/validacoes/

# Ver linhas (JSONL format)
wc -l data/logs/validacoes/validacoes-*.jsonl
```

### Conferir resultados
```bash
# Editais processados
jq . data/editais.json | head -50

# Último resultado
cat logs/resultado-*.json | jq .
```

---

## 🔒 SEGURANÇA

### Token de Segurança
Se você configurou um token em `.env`:

```bash
# Com token
./scripts/buscar-editais.sh --token seu-token-aqui

# Ou via variável ambiente
export SCAN_TOKEN="seu-token-aqui"
./scripts/buscar-editais.sh
```

### Permissões de Arquivo
Os logs são criados com permissões restritas:
```bash
# Logs do cron
logs/cron.log         # rw-r--r-- (644)

# Dados de validação
data/logs/validacoes/ # rwxr-xr-x (755)
```

---

## 📝 EXEMPLOS DE USO

### Exemplo 1: Busca manual simples
```bash
cd /Users/alexandrerocha/captaMais
./scripts/buscar-editais.sh
```

### Exemplo 2: Busca com detalhes
```bash
./scripts/buscar-editais.sh --verbose
```

### Exemplo 3: Testar antes de agendar
```bash
./scripts/buscar-editais.sh --dry-run --verbose
```

### Exemplo 4: Agendar automaticamente
```bash
./scripts/setup-cron.sh
# Escolher opção 1 ou 2
```

### Exemplo 5: Verificar agendamento
```bash
./scripts/setup-cron.sh
# Escolher opção 3
```

### Exemplo 6: Remover agendamento
```bash
./scripts/setup-cron.sh
# Escolher opção 4
```

---

## 📈 PRÓXIMOS PASSOS

1. **Testar script manualmente:**
   ```bash
   ./scripts/buscar-editais.sh
   ```

2. **Verificar se funcionou:**
   ```bash
   tail -20 logs/busca-editais-*.log
   ```

3. **Agendar com cron:**
   ```bash
   ./scripts/setup-cron.sh
   # Opção 1 para segunda-feira 08:00
   ```

4. **Monitorar primeiro mês:**
   ```bash
   tail -f logs/cron.log
   ```

5. **Ajustar se necessário:**
   ```bash
   # Editar cron
   crontab -e
   
   # Ou usar setup de novo
   ./scripts/setup-cron.sh
   ```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Ler este guia (5 min)
- [ ] Testar script manualmente (5 min)
- [ ] Configurar agendamento com cron (2 min)
- [ ] Verificar se está agendado (1 min)
- [ ] Monitorar primeira execução (contínuo)

**Total: ~15 minutos**

---

## 🎯 CONCLUSÃO

**Scripts prontos para uso imediato!**

- ✅ `buscar-editais.sh` - Execução manual
- ✅ `setup-cron.sh` - Agendamento automático
- ✅ Logs estruturados e rastreáveis
- ✅ Validação com keywords integrada
- ✅ Pronto para produção

**Próximo passo:** Executar `./scripts/setup-cron.sh` para agendar!
