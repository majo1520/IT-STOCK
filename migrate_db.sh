#!/bin/bash

# Script to run database migrations
echo "Running database migrations..."

# Navigate to the backend directory
cd "$(dirname "$0")/backend"

# Run migrate command
npm run migrate

echo "Migration complete!" 