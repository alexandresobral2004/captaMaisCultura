#!/bin/bash

################################################################################
#                                                                              #
#           SCRIPT DE BUSCA DE EDITAIS - CaptaMais v3.0 (JobRunner)            #
#                                                                              #
#  ÚNICO ponto de entrada para busca de novos editais.                         #
#  A interface web (/editais) apenas exibe editais JÁ CADASTRADOS.             #
#                                                                              #
#  Este script é apenas um disparador. A orquestração (busca, download, IA)    #
#  agora ocorre no backend, controlada pelo JobRunner, com concorrência        #
#  protegida.                                                                  #
#                                                                              #
################################################################################

set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
LOG_DIR="$PROJECT_ROOT/logs"

VERBOSE=false
DRY_RUN=false
API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3000}"

# Carrega o SCAN_TOKEN de .env.local se existir
SCAN_TOKEN="${SCAN_TOKEN:-}"
if [ -z "$SCAN_TOKEN" ] && [ -f "$PROJECT_ROOT/.env.local" ]; then
    SCAN_TOKEN=$(grep -E "^SCAN_TOKEN=" "$PROJECT_ROOT/.env.local" | head -n 1 | cut -d'=' -f2-)
fi

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO) echo -e "${BLUE}[INFO]${NC} $timestamp - $message" ;;
        SUCCESS) echo -e "${GREEN}[✓]${NC} $timestamp - $message" ;;
        WARNING) echo -e "${YELLOW}[⚠]${NC} $timestamp - $message" ;;
        ERROR) echo -e "${RED}[✗]${NC} $timestamp - $message" ;;
        *) echo "$message" ;;
    esac
}

show_help() {
    cat << EOF
BUSCA DE EDITAIS - CaptaMais v3.0

Script para acionar a API de busca de editais e iniciar o JobRunner no backend.

OPÇÕES:
  --verbose      Exibe saída detalhada
  --dry-run      Simula a execução sem chamar a API
  --url <URL>    URL da API (default: $API_URL)
  --token <TKN>  Token de segurança
  --help         Mostra esta mensagem
EOF
}

check_server() {
    log INFO "Verificando servidor em $API_URL..."
    if [ "$DRY_RUN" = true ]; then return 0; fi
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL" || echo "000")
    if [ "$response" = "000" ]; then
        log ERROR "Servidor não está acessível em $API_URL"
        log INFO "Você precisa rodar 'npm run dev' primeiro."
        exit 1
    fi
    log SUCCESS "Servidor acessível"
}

execute_search() {
    log INFO "Iniciando JobRunner no backend..."
    if [ "$DRY_RUN" = true ]; then return 0; fi
    
    local endpoint="$API_URL/api/jobs/run-weekly-scan"
    local payload="{\"token\":\"$SCAN_TOKEN\"}"
    
    local response=$(curl -s -X POST "$endpoint" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    if [ "$VERBOSE" = true ]; then
        echo "$response" | jq . || echo "$response"
    fi
    
    local success=$(echo "$response" | jq -r '.success // false')
    if [ "$success" = "true" ]; then
        log SUCCESS "✅ Busca concluída com sucesso no backend!"
    else
        log ERROR "❌ Falha na execução do JobRunner."
        echo "$response" | jq . || echo "$response"
    fi
}

main() {
    mkdir -p "$LOG_DIR"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --verbose) VERBOSE=true; shift ;;
            --dry-run) DRY_RUN=true; shift ;;
            --url) API_URL="$2"; shift 2 ;;
            --token) SCAN_TOKEN="$2"; shift 2 ;;
            --help) show_help; exit 0 ;;
            *) log ERROR "Opção desconhecida: $1"; exit 1 ;;
        esac
    done

    echo "🚀 CaptaMais v3.0 - Disparador de Job de Busca"
    check_server
    execute_search
}

main "$@"
