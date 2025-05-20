#!/bin/bash

# Colors for pretty output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print header
echo -e "${YELLOW}=================================================${NC}"
echo -e "${YELLOW}      POSTGRESQL ITEM SYSTEM SETUP SCRIPT        ${NC}"
echo -e "${YELLOW}=================================================${NC}"
echo ""

# Install dependencies
echo -e "${BLUE}Installing required dependencies...${NC}"
npm install chalk@4.1.2

# Check if the files exist
if [ ! -f "new_item_system.sql" ]; then
    echo -e "${RED}Error: new_item_system.sql not found!${NC}"
    exit 1
fi

if [ ! -f "test_new_item_system.js" ]; then
    echo -e "${RED}Error: test_new_item_system.js not found!${NC}"
    exit 1
fi

if [ ! -f "migration_to_new_item_system.js" ]; then
    echo -e "${RED}Error: migration_to_new_item_system.js not found!${NC}"
    exit 1
fi

# Make the script executable
chmod +x setup_new_item_system.sh

echo -e "${GREEN}All required files found!${NC}"
echo ""

# Ask user what they want to do
echo -e "${YELLOW}What would you like to do?${NC}"
echo "1. Run tests (non-destructive, uses a test schema)"
echo "2. Execute migration (will alter your database!)"
echo "3. Exit"
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo -e "${BLUE}Running tests...${NC}"
        node test_new_item_system.js
        ;;
    2)
        echo -e "${RED}WARNING: This will migrate your database to the new schema.${NC}"
        echo -e "${RED}Make sure you have a backup before proceeding!${NC}"
        read -p "Are you sure you want to continue? (y/n): " confirm
        if [ "$confirm" == "y" ]; then
            echo -e "${BLUE}Executing migration...${NC}"
            node migration_to_new_item_system.js
        else
            echo -e "${YELLOW}Migration cancelled.${NC}"
        fi
        ;;
    3)
        echo -e "${GREEN}Exiting without changes.${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        ;;
esac

echo ""
echo -e "${YELLOW}=================================================${NC}"
echo -e "${YELLOW}                  COMPLETED                      ${NC}"
echo -e "${YELLOW}=================================================${NC}" 