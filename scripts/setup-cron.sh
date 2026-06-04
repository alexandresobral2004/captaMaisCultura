#!/bin/bash

################################################################################
#                                                                              #
#           SETUP CRON - CaptaMais                                           #
#                                                                              #
#  Configura execução automática semanal de busca de editais                 #
#                                                                              #
################################################################################

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
BUSCA_SCRIPT="$SCRIPT_DIR/buscar-editais.sh"
LOG_DIR="$PROJECT_ROOT/logs"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

################################################################################
# FUNÇÕES
################################################################################

show_banner() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║              SETUP CRON - CaptaMais                              ║"
    echo "║        Configura execução automática de buscas                   ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo ""
}

show_menu() {
    echo -e "${BLUE}Selecione uma opção:${NC}"
    echo ""
    echo "  1) Agendar busca automática (segunda-feira 08:00)"
    echo "  2) Agendar busca automática (todos os dias 08:00)"
    echo "  3) Visualizar cron agendado"
    echo "  4) Remover cron agendado"
    echo "  5) Testar script"
    echo "  0) Sair"
    echo ""
    read -p "Escolha uma opção (0-5): " choice
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Agendar segunda-feira 08:00
schedule_weekly() {
    log_info "Agendando busca para segunda-feira às 08:00..."
    
    # Criar cron entry
    local cron_entry="0 8 * * 1 cd $PROJECT_ROOT && $BUSCA_SCRIPT >> $LOG_DIR/cron.log 2>&1"
    
    # Obter cron atual
    local current_cron=$(crontab -l 2>/dev/null || echo "")
    
    # Verificar se já existe
    if echo "$current_cron" | grep -q "buscar-editais.sh"; then
        log_warning "Cron já agendado!"
        echo ""
        echo "Cron atual:"
        echo "$current_cron" | grep "buscar-editais.sh"
        echo ""
        read -p "Deseja remover e reagendar? (s/n): " confirm
        if [ "$confirm" != "s" ]; then
            log_warning "Operação cancelada"
            return
        fi
        # Remover entrada antiga
        echo "$current_cron" | grep -v "buscar-editais.sh" | crontab -
        log_success "Entrada anterior removida"
    fi
    
    # Adicionar novo
    (echo "$current_cron"; echo "$cron_entry") | crontab -
    
    log_success "Cron agendado com sucesso!"
    echo ""
    echo "Detalhes do agendamento:"
    echo "  Dia:     Segunda-feira"
    echo "  Hora:    08:00"
    echo "  Script:  $BUSCA_SCRIPT"
    echo "  Log:     $LOG_DIR/cron.log"
    echo ""
}

# Agendar todos os dias 08:00
schedule_daily() {
    log_info "Agendando busca para todos os dias às 08:00..."
    
    # Criar cron entry
    local cron_entry="0 8 * * * cd $PROJECT_ROOT && $BUSCA_SCRIPT >> $LOG_DIR/cron.log 2>&1"
    
    # Obter cron atual
    local current_cron=$(crontab -l 2>/dev/null || echo "")
    
    # Verificar se já existe
    if echo "$current_cron" | grep -q "buscar-editais.sh"; then
        log_warning "Cron já agendado!"
        echo ""
        echo "Cron atual:"
        echo "$current_cron" | grep "buscar-editais.sh"
        echo ""
        read -p "Deseja remover e reagendar? (s/n): " confirm
        if [ "$confirm" != "s" ]; then
            log_warning "Operação cancelada"
            return
        fi
        # Remover entrada antiga
        echo "$current_cron" | grep -v "buscar-editais.sh" | crontab -
        log_success "Entrada anterior removida"
    fi
    
    # Adicionar novo
    (echo "$current_cron"; echo "$cron_entry") | crontab -
    
    log_success "Cron agendado com sucesso!"
    echo ""
    echo "Detalhes do agendamento:"
    echo "  Dia:     Todos os dias"
    echo "  Hora:    08:00"
    echo "  Script:  $BUSCA_SCRIPT"
    echo "  Log:     $LOG_DIR/cron.log"
    echo ""
}

# Visualizar cron
view_cron() {
    log_info "Cron agendado:"
    echo ""
    
    local cron_list=$(crontab -l 2>/dev/null || echo "")
    
    if [ -z "$cron_list" ]; then
        log_warning "Nenhum cron agendado"
        return
    fi
    
    local busca_cron=$(echo "$cron_list" | grep "buscar-editais.sh" || echo "")
    
    if [ -z "$busca_cron" ]; then
        log_warning "Nenhuma busca de editais agendada"
        echo ""
        echo "Cron geral:"
        echo "$cron_list"
    else
        log_success "Busca de editais encontrada:"
        echo "$busca_cron"
    fi
    echo ""
}

# Remover cron
remove_cron() {
    log_info "Removendo cron agendado..."
    
    local current_cron=$(crontab -l 2>/dev/null || echo "")
    
    if ! echo "$current_cron" | grep -q "buscar-editais.sh"; then
        log_warning "Nenhum cron de busca de editais agendado"
        return
    fi
    
    read -p "Tem certeza que deseja remover? (s/n): " confirm
    if [ "$confirm" != "s" ]; then
        log_warning "Operação cancelada"
        return
    fi
    
    # Remover
    echo "$current_cron" | grep -v "buscar-editais.sh" | crontab -
    
    log_success "Cron removido com sucesso!"
    echo ""
}

# Testar script
test_script() {
    log_info "Testando script..."
    echo ""
    
    if [ ! -x "$BUSCA_SCRIPT" ]; then
        log_error "Script não é executável!"
        return 1
    fi
    
    log_success "Script é executável"
    
    # Executar teste
    echo ""
    log_info "Executando teste..."
    echo ""
    
    "$BUSCA_SCRIPT" --dry-run --verbose
    
    echo ""
    log_success "Teste concluído!"
    echo ""
}

# Verificar pré-requisitos
check_prerequisites() {
    log_info "Verificando pré-requisitos..."
    
    if [ ! -f "$BUSCA_SCRIPT" ]; then
        log_error "Script não encontrado: $BUSCA_SCRIPT"
        exit 1
    fi
    log_success "Script encontrado"
    
    if [ ! -x "$BUSCA_SCRIPT" ]; then
        log_warning "Script não é executável, tornando..."
        chmod +x "$BUSCA_SCRIPT"
        log_success "Script agora é executável"
    fi
    
    if [ ! -d "$PROJECT_ROOT" ]; then
        log_error "Projeto não encontrado: $PROJECT_ROOT"
        exit 1
    fi
    log_success "Projeto encontrado"
    
    mkdir -p "$LOG_DIR"
    log_success "Diretório de logs verificado"
    
    echo ""
}

################################################################################
# MAIN
################################################################################

main() {
    show_banner
    
    # Verificar pré-requisitos
    check_prerequisites
    
    # Loop menu
    while true; do
        show_menu
        
        case $choice in
            1)
                echo ""
                schedule_weekly
                ;;
            2)
                echo ""
                schedule_daily
                ;;
            3)
                echo ""
                view_cron
                ;;
            4)
                echo ""
                remove_cron
                ;;
            5)
                echo ""
                test_script
                ;;
            0)
                log_success "Até logo!"
                exit 0
                ;;
            *)
                log_error "Opção inválida!"
                ;;
        esac
        
        read -p "Pressione Enter para continuar..."
    done
}

# Executar
main
