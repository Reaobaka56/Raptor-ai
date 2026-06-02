#!/bin/bash
set -e

echo "AI Code Review Agent - Setup Script"
echo "========================================"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Node.js 18+ required. Found: $(node -v)"
    exit 1
fi
echo "Node.js $(node -v)"

# Install backend dependencies
echo ""
echo "Installing backend dependencies..."
npm install

# Install frontend dependencies
echo ""
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Setup environment
echo ""
echo "Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
    echo "Please edit .env with your credentials"
else
    echo ".env already exists"
fi

# Setup database
echo ""
echo "Setting up database..."
npx prisma generate

# Check if PostgreSQL is running
if command -v pg_isready &> /dev/null; then
    if pg_isready -q; then
        echo "PostgreSQL is running"
        read -p "Run migrations? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npx prisma migrate dev --name init
        fi
    else
        echo "PostgreSQL is not running. Start it and run: npx prisma migrate dev --name init"
    fi
else
    echo "PostgreSQL not found. Install PostgreSQL and run: npx prisma migrate dev --name init"
fi

echo ""
echo "========================================"
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your GitHub App and Claude API credentials"
echo "2. Run database migrations: npx prisma migrate dev --name init"
echo "3. Start backend: npm run dev"
echo "4. Start frontend: cd frontend && npm run dev"
echo ""
echo "See README.md for GitHub App setup instructions"
