#!/bin/bash

# ============================================================================
# ZAPAI MASTER NODE - ROLLBACK SYSTEM
# ============================================================================
# 
# Sistema de rollback automático para deployments.
# Zero mock. Tudo produção real.
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/opt/zapai/backups}"
DEPLOYMENTS_DIR="${DEPLOYMENTS_DIR:-/opt/zapai/deployments}"
MAX_BACKUPS="${MAX_BACKUPS:-10}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}ZAPAI - ROLLBACK SYSTEM${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to create backup
create_backup() {
    local version=$1
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="backup_${version}_${timestamp}"
    local backup_path="${BACKUP_DIR}/${backup_name}"
    
    echo -e "${YELLOW}Criando backup: ${backup_name}${NC}"
    
    mkdir -p "${backup_path}"
    
    # Backup backend
    if [ -d "/opt/zapai/backend" ]; then
        cp -r /opt/zapai/backend "${backup_path}/"
        echo -e "${GREEN}✓ Backend backup criado${NC}"
    fi
    
    # Backup frontend
    if [ -d "/opt/zapai/frontend" ]; then
        cp -r /opt/zapai/frontend "${backup_path}/"
        echo -e "${GREEN}✓ Frontend backup criado${NC}"
    fi
    
    # Backup database
    docker exec zapai-postgres pg_dump -U postgres zapai_crm > "${backup_path}/database.sql"
    echo -e "${GREEN}✓ Database backup criado${NC}"
    
    # Backup sessions
    if [ -d "/opt/zapai/sessions" ]; then
        cp -r /opt/zapai/sessions "${backup_path}/"
        echo -e "${GREEN}✓ Sessions backup criado${NC}"
    fi
    
    # Create metadata
    cat > "${backup_path}/metadata.json" << EOF
{
  "version": "${version}",
  "timestamp": "${timestamp}",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "commit_hash": "$(cd /opt/zapai && git rev-parse HEAD 2>/dev/null || echo 'unknown')"
}
EOF
    
    echo -e "${GREEN}Backup completo: ${backup_path}${NC}"
    
    # Clean old backups
    clean_old_backups
}

# Function to clean old backups
clean_old_backups() {
    echo -e "${YELLOW}Limpando backups antigos...${NC}"
    
    local backup_count=$(ls -1 ${BACKUP_DIR}/backup_* 2>/dev/null | wc -l)
    
    if [ $backup_count -gt $MAX_BACKUPS ]; then
        local to_delete=$((backup_count - MAX_BACKUPS))
        ls -t ${BACKUP_DIR}/backup_* | tail -n $to_delete | xargs rm -rf
        echo -e "${GREEN}✓ Removidos ${to_delete} backups antigos${NC}"
    fi
}

# Function to restore backup
restore_backup() {
    local backup_name=$1
    local backup_path="${BACKUP_DIR}/${backup_name}"
    
    if [ ! -d "${backup_path}" ]; then
        echo -e "${RED}Erro: Backup não encontrado: ${backup_path}${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Restaurando backup: ${backup_name}${NC}"
    
    # Stop services
    echo -e "${YELLOW}Parando serviços...${NC}"
    pm2 stop zapai-backend zapai-frontend || true
    docker-compose -f /opt/zapai/docker-compose.production.yml down || true
    
    # Restore backend
    if [ -d "${backup_path}/backend" ]; then
        rm -rf /opt/zapai/backend
        cp -r "${backup_path}/backend" /opt/zapai/
        echo -e "${GREEN}✓ Backend restaurado${NC}"
    fi
    
    # Restore frontend
    if [ -d "${backup_path}/frontend" ]; then
        rm -rf /opt/zapai/frontend
        cp -r "${backup_path}/frontend" /opt/zapai/
        echo -e "${GREEN}✓ Frontend restaurado${NC}"
    fi
    
    # Restore database
    if [ -f "${backup_path}/database.sql" ]; then
        docker exec -i zapai-postgres psql -U postgres zapai_crm < "${backup_path}/database.sql"
        echo -e "${GREEN}✓ Database restaurado${NC}"
    fi
    
    # Restore sessions
    if [ -d "${backup_path}/sessions" ]; then
        rm -rf /opt/zapai/sessions
        cp -r "${backup_path}/sessions" /opt/zapai/
        echo -e "${GREEN}✓ Sessions restaurado${NC}"
    fi
    
    # Start services
    echo -e "${YELLOW}Iniciando serviços...${NC}"
    docker-compose -f /opt/zapai/docker-compose.production.yml up -d
    cd /opt/zapai/backend && npm install && pm2 restart server.js --name zapai-backend
    cd /opt/zapai/frontend && npm install && npm run build && pm2 restart "npx serve -s build -l 8080" --name zapai-frontend
    
    echo -e "${GREEN}Rollback completo!${NC}"
}

# Function to list backups
list_backups() {
    echo -e "${YELLOW}Backups disponíveis:${NC}"
    echo ""
    
    for backup in $(ls -t ${BACKUP_DIR}/backup_* 2>/dev/null); do
        local name=$(basename "$backup")
        local metadata="${backup}/metadata.json"
        
        if [ -f "$metadata" ]; then
            local version=$(jq -r '.version' "$metadata")
            local timestamp=$(jq -r '.timestamp' "$metadata")
            local commit=$(jq -r '.commit_hash' "$metadata")
            
            echo -e "${BLUE}${name}${NC}"
            echo -e "  Versão: ${version}"
            echo -e "  Timestamp: ${timestamp}"
            echo -e "  Commit: ${commit}"
            echo ""
        fi
    done
}

# Function to deploy with automatic backup
deploy_with_backup() {
    local version=$1
    
    echo -e "${YELLOW}Iniciando deployment com backup automático...${NC}"
    
    # Create backup before deployment
    create_backup "${version}"
    
    # Pull latest code
    echo -e "${YELLOW}Atualizando código...${NC}"
    cd /opt/zapai
    git pull
    
    # Install dependencies and build
    echo -e "${YELLOW}Instalando dependências...${NC}"
    cd /opt/zapai/backend && npm install
    cd /opt/zapai/frontend && npm install && npm run build
    
    # Restart services
    echo -e "${YELLOW}Reiniciando serviços...${NC}"
    pm2 restart zapai-backend zapai-frontend
    
    echo -e "${GREEN}Deployment concluído com sucesso!${NC}"
}

# Main
case "${1:-}" in
    create)
        create_backup "${2:-latest}"
        ;;
    restore)
        restore_backup "${2}"
        ;;
    list)
        list_backups
        ;;
    deploy)
        deploy_with_backup "${2:-latest}"
        ;;
    *)
        echo "Uso: $0 {create|restore|list|deploy} [version|backup_name]"
        echo ""
        echo "Comandos:"
        echo "  create [version]  - Cria um backup"
        echo "  restore [name]    - Restaura um backup"
        echo "  list             - Lista todos os backups"
        echo "  deploy [version] - Deploy com backup automático"
        exit 1
        ;;
esac
