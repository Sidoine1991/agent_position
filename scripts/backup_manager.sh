#!/bin/bash

# Script principal pour gérer les sauvegardes Supabase
# Usage: ./backup_manager.sh [backup|restore|list]

BACKUP_DIR="./backups"
SCRIPT_DIR="./scripts"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function show_help() {
    echo -e "${BLUE}📁 Gestionnaire de sauvegardes Supabase${NC}"
    echo "======================================"
    echo ""
    echo "Usage: $0 [commande]"
    echo ""
    echo "Commandes disponibles:"
    echo "  backup   - Créer une nouvelle sauvegarde"
    echo "  restore  - Restaurer une sauvegarde"
    echo "  list     - Lister les sauvegardes disponibles"
    echo "  help     - Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0 backup"
    echo "  $0 list"
    echo "  $0 restore backups/supabase_backup_2024-01-15T10-30-00.json"
}

function create_backup() {
    echo -e "${GREEN}🚀 Création d'une nouvelle sauvegarde...${NC}"
    
    if [ ! -f "$SCRIPT_DIR/backup_supabase.js" ]; then
        echo -e "${RED}❌ Script de sauvegarde non trouvé${NC}"
        exit 1
    fi
    
    node "$SCRIPT_DIR/backup_supabase.js"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Sauvegarde créée avec succès!${NC}"
    else
        echo -e "${RED}❌ Erreur lors de la création de la sauvegarde${NC}"
        exit 1
    fi
}

function restore_backup() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        echo -e "${YELLOW}📋 Veuillez spécifier le fichier de sauvegarde à restaurer${NC}"
        echo ""
        echo "Sauvegardes disponibles:"
        node "$SCRIPT_DIR/list_backups.js"
        echo ""
        echo "Usage: $0 restore <fichier_de_sauvegarde>"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}❌ Fichier de sauvegarde non trouvé: $backup_file${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}⚠️ ATTENTION: Cette opération va supprimer toutes les données existantes!${NC}"
    echo -e "${YELLOW}⚠️ Fichier de restauration: $backup_file${NC}"
    echo ""
    read -p "Êtes-vous sûr de vouloir continuer? (oui/non): " confirm
    
    if [ "$confirm" = "oui" ] || [ "$confirm" = "o" ] || [ "$confirm" = "yes" ] || [ "$confirm" = "y" ]; then
        echo -e "${GREEN}🔄 Restauration en cours...${NC}"
        node "$SCRIPT_DIR/restore_backup.js" "$backup_file" --force
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Restauration terminée avec succès!${NC}"
        else
            echo -e "${RED}❌ Erreur lors de la restauration${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}❌ Restauration annulée${NC}"
        exit 0
    fi
}

function list_backups() {
    echo -e "${BLUE}📋 Liste des sauvegardes disponibles:${NC}"
    node "$SCRIPT_DIR/list_backups.js"
}

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé${NC}"
    exit 1
fi

# Créer le dossier de sauvegarde s'il n'existe pas
mkdir -p "$BACKUP_DIR"

# Traiter la commande
case "$1" in
    "backup")
        create_backup
        ;;
    "restore")
        restore_backup "$2"
        ;;
    "list")
        list_backups
        ;;
    "help"|"-h"|"--help"|"")
        show_help
        ;;
    *)
        echo -e "${RED}❌ Commande inconnue: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
