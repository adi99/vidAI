#!/bin/bash

echo "🚀 Setting up Performance Monitoring & Error Tracking"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from your project root directory"
    exit 1
fi

echo ""
echo "📦 Installing required dependencies..."

# Install chart dependencies (optional)
echo "Installing chart libraries (optional for visualizations)..."
npm install react-native-chart-kit react-native-svg

# Install network info for error tracking (optional)
echo "Installing network info library (optional for network tracking)..."
npm install @react-native-community/netinfo

echo ""
echo "🗄️ Setting up database..."

# Check if backend directory exists
if [ -d "backend" ]; then
    cd backend
    
    # Check if migration file exists
    if [ -f "migrations/20240208_create_error_tracking_tables.sql" ]; then
        echo "Database migration file found"
        echo "To apply the migration, run:"
        echo "  psql -d your_database -f migrations/20240208_create_error_tracking_tables.sql"
    else
        echo "⚠️  Database migration file not found"
    fi
    
    cd ..
else
    echo "⚠️  Backend directory not found"
fi

echo ""
echo "⚙️  Environment Configuration"
echo "Add these variables to your backend/.env file:"
echo ""
echo "# Error tracking alerts"
echo "ERROR_WEBHOOK_URL=https://your-webhook-url.com/alerts"
echo "ERROR_ALERT_EMAIL=admin@yourapp.com"
echo ""
echo "# Performance monitoring"
echo "PERFORMANCE_ALERT_WEBHOOK=https://your-webhook-url.com/performance"
echo ""

echo "🎯 Quick Start Guide"
echo "==================="
echo ""
echo "1. Start your backend server:"
echo "   cd backend && npm run dev"
echo ""
echo "2. Test the monitoring endpoints:"
echo "   node test-monitoring.js"
echo ""
echo "3. Add the admin screen to your app:"
echo "   - The admin screen is available at app/admin.tsx"
echo "   - Add it to your navigation or access it directly"
echo ""
echo "4. View the dashboards:"
echo "   - Performance Dashboard: Shows API metrics, success rates, alerts"
echo "   - Error Dashboard: Shows error statistics, patterns, resolution tracking"
echo ""
echo "📊 Available Endpoints:"
echo "======================"
echo ""
echo "Performance Monitoring:"
echo "  GET /health/system              - System health overview"
echo "  GET /health/performance         - Detailed performance metrics"
echo "  GET /health/generation-success  - AI generation success rates"
echo "  GET /health/api-performance     - API response time trends"
echo "  GET /health/queues              - Queue status"
echo "  GET /health/alerts              - Performance alerts"
echo ""
echo "Error Tracking:"
echo "  GET /health/errors              - Error statistics"
echo "  GET /health/errors/{category}   - Errors by category"
echo "  POST /health/errors/{id}/resolve - Mark error as resolved"
echo "  GET /health/errors/export       - Export error data"
echo "  DELETE /health/errors           - Clear all errors (admin)"
echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start your backend server"
echo "2. Run the test script to verify everything works"
echo "3. Add the monitoring screens to your app"
echo "4. Configure alert webhooks for production"
echo ""
echo "For detailed usage instructions, see MONITORING_GUIDE.md"