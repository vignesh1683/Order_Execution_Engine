#!/bin/bash

# Quick Start Script for Order Execution Engine
# Run this after cloning the repository

set -e

echo "🚀 Order Execution Engine - Setup Script"
echo "=========================================="
echo ""

# Check Node.js
echo "✓ Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js v18+ from https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node -v)
echo "  Found: $NODE_VERSION"

# Check npm
echo "✓ Checking npm installation..."
NPM_VERSION=$(npm -v)
echo "  Found: npm $NPM_VERSION"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Setup environment
echo ""
echo "⚙️  Setting up environment..."
if [ ! -f .env ]; then
    cp .env .env
    echo "  Created .env file"
else
    echo "  Using existing .env file"
fi

# Setup database
echo ""
echo "🗄️  Setting up PostgreSQL..."
echo "  Make sure PostgreSQL is running: sudo systemctl start postgresql"
echo "  Create user and database:"
echo "  $ sudo -u postgres psql"
echo "  postgres=# CREATE USER order_user WITH PASSWORD '123';"
echo "  postgres=# CREATE DATABASE order_execution OWNER order_user;"
echo "  postgres=# GRANT ALL PRIVILEGES ON DATABASE order_execution TO order_user;"
echo "  postgres=# \q"

# Initialize database
echo ""
echo "📝 Initializing Prisma..."
npx prisma migrate dev --name init

# Setup Redis
echo ""
echo "🔴 Setting up Redis..."
echo "  Make sure Redis is running: sudo systemctl start redis-server"
echo "  Verify: redis-cli ping (should print PONG)"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Make sure PostgreSQL is running: sudo systemctl start postgresql"
echo "2. Make sure Redis is running: sudo systemctl start redis-server"
echo "3. Run the server: npm run dev"
echo "4. In another terminal, test the API:"
echo "   curl http://localhost:3000/health"
echo ""
echo "For detailed setup instructions, see README.md"
