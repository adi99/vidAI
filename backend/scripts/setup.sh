#!/bin/bash

# Setup script for AI Video Generation Backend

echo "🚀 Setting up AI Video Generation Backend..."

# Create logs directory
mkdir -p logs

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please configure your .env file with the required values"
fi

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

echo "✅ Backend setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure your .env file with Supabase credentials"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:3001/health to verify the server is running"