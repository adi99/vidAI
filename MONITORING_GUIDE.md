# Performance Monitoring & Error Tracking Guide

## 🎯 Overview

This guide shows you how to access and use the comprehensive monitoring systems implemented for your AI video generation app.

## 📊 Performance Monitoring System

### Backend API Endpoints

#### 1. System Health Overview
```bash
GET /health/system
```
**Response:**
```json
{
  "status": "healthy|degraded|unhealthy",
  "checks": {
    "database": { "status": "pass", "responseTime": 15 },
    "redis": { "status": "pass", "responseTime": 5 },
    "gpu_services": { "status": "pass", "responseTime": 120 }
  },
  "performance_summary": {
    "api_response_time": 245.5,
    "api_success_rate": 98.2,
    "generation_success_rates": {
      "image": 95.8,
      "video": 92.1,
      "training": 89.3
    },
    "active_alerts": 2
  }
}
```

#### 2. Detailed Performance Metrics
```bash
GET /health/performance
```
**Response:**
```json
{
  "api": {
    "averageResponseTime": 245.5,
    "successRate": 98.2,
    "slowEndpoints": [
      { "endpoint": "POST /generate/video", "averageTime": 1250 }
    ],
    "errorRate": 1.8
  },
  "generation": {
    "successRates": { "image": 95.8, "video": 92.1 },
    "averageProcessingTimes": { "image": 3500, "video": 15000 },
    "queueTimes": { "image": 250, "video": 800 },
    "failureReasons": { "gpu_timeout": 5, "insufficient_credits": 12 }
  },
  "queues": {
    "image_generation": { "waiting": 3, "active": 2, "completed": 1247 },
    "video_generation": { "waiting": 8, "active": 1, "completed": 892 }
  },
  "alerts": [
    {
      "type": "warning",
      "message": "High API response time detected",
      "metric": "api_response_time",
      "value": 1250,
      "threshold": 1000
    }
  ]
}
```

#### 3. Generation Success Rates
```bash
GET /health/generation-success?hours=24
```

#### 4. API Performance Trends
```bash
GET /health/api-performance?hours=24
```

#### 5. Queue Status
```bash
GET /health/queues
GET /health/queues/image_generation
```

#### 6. Performance Alerts
```bash
GET /health/alerts
```

## 🚨 Error Tracking System

### Backend API Endpoints

#### 1. Error Statistics
```bash
GET /health/errors?hours=24
```
**Response:**
```json
{
  "error_stats": {
    "totalErrors": 45,
    "errorsByCategory": {
      "network": 15,
      "generation": 12,
      "auth": 8,
      "ui": 10
    },
    "errorsBySeverity": {
      "critical": 2,
      "high": 8,
      "medium": 25,
      "low": 10
    },
    "errorRate": 1.8,
    "topErrors": [
      { "message": "GPU service timeout", "count": 8, "category": "generation" }
    ],
    "criticalErrors": 2,
    "unresolvedErrors": 23
  },
  "system_health": {
    "status": "degraded",
    "issues": ["2 critical errors in the last hour"],
    "metrics": {
      "errorRate": 1.8,
      "criticalErrors": 2,
      "unresolvedErrors": 23,
      "activeAlerts": 3
    }
  }
}
```

#### 2. Errors by Category
```bash
GET /health/errors/generation?limit=50
GET /health/errors/network?limit=50
```

#### 3. Mark Error as Resolved
```bash
POST /health/errors/{errorId}/resolve
```

#### 4. Export Error Data
```bash
GET /health/errors/export
```

#### 5. Clear All Errors (Admin)
```bash
DELETE /health/errors
```

## 📱 Frontend Dashboard Components

### 1. Performance Dashboard

Add to any screen in your app:

```tsx
import PerformanceDashboard from '@/components/PerformanceDashboard';

export default function AdminScreen() {
  return (
    <View style={{ flex: 1 }}>
      <PerformanceDashboard />
    </View>
  );
}
```

**Features:**
- Real-time performance metrics
- API response time trends
- Generation success rates
- Queue status monitoring
- System health overview
- Performance alerts

### 2. Error Dashboard

```tsx
import ErrorDashboard from '@/components/ErrorDashboard';

export default function ErrorMonitoringScreen() {
  return (
    <View style={{ flex: 1 }}>
      <ErrorDashboard />
    </View>
  );
}
```

**Features:**
- Error statistics and trends
- Error categorization and filtering
- Error pattern recognition
- Resolution tracking
- Export functionality

## 🔧 Integration in Your App

### 1. Add Monitoring Hooks

In any component:

```tsx
import usePerformanceMonitoring from '@/hooks/usePerformanceMonitoring';
import useErrorTracking from '@/hooks/useErrorTracking';

export default function MyComponent() {
  const { recordMetric, measureAsync } = usePerformanceMonitoring();
  const { reportError, trackAsync } = useErrorTracking();

  // Track performance
  const handleGeneration = measureAsync(
    async () => {
      // Your generation logic
    },
    { action: 'image_generation', category: 'generation' }
  );

  // Track errors
  const handleError = (error: Error) => {
    reportError(error, { screen: 'generation' }, 'high', 'generation');
  };

  return (
    // Your component JSX
  );
}
```

### 2. Automatic Error Tracking

The system automatically tracks:
- Unhandled errors
- Network failures
- API errors
- Component crashes
- Navigation errors

### 3. Automatic Performance Tracking

The system automatically tracks:
- API response times
- Generation success rates
- Queue performance
- System resource usage

## 🌐 Testing the Systems

### 1. Start Your Backend Server

```bash
cd backend
npm run dev
```

### 2. Test API Endpoints

```bash
# Check system health
curl http://localhost:3000/health/system

# Get performance metrics
curl http://localhost:3000/health/performance

# Get error statistics
curl http://localhost:3000/health/errors
```

### 3. Generate Test Data

```bash
# Simulate some API calls to generate metrics
curl -X POST http://localhost:3000/generate/image \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test image"}'

# Check the metrics again
curl http://localhost:3000/health/performance
```

## 📊 Viewing Real-Time Data

### Option 1: Create Admin Screens

Create dedicated admin screens in your app:

```tsx
// app/admin/performance.tsx
import PerformanceDashboard from '@/components/PerformanceDashboard';

export default function PerformanceScreen() {
  return <PerformanceDashboard />;
}

// app/admin/errors.tsx
import ErrorDashboard from '@/components/ErrorDashboard';

export default function ErrorScreen() {
  return <ErrorDashboard />;
}
```

### Option 2: Add to Existing Screens

Add monitoring widgets to your profile or settings screens:

```tsx
// In your profile screen
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import PerformanceDashboard from '@/components/PerformanceDashboard';

export default function ProfileScreen() {
  const [showMonitoring, setShowMonitoring] = useState(false);

  return (
    <View>
      {/* Your existing profile content */}
      
      <Button 
        title="View Performance" 
        onPress={() => setShowMonitoring(!showMonitoring)} 
      />
      
      {showMonitoring && <PerformanceDashboard />}
    </View>
  );
}
```

### Option 3: Web Dashboard

You can also create a simple web interface to view the data:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Monitoring Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div id="performance-chart"></div>
    <div id="error-stats"></div>
    
    <script>
        // Fetch and display performance data
        fetch('http://localhost:3000/health/performance')
            .then(response => response.json())
            .then(data => {
                console.log('Performance Data:', data);
                // Create charts with the data
            });
            
        // Fetch and display error data
        fetch('http://localhost:3000/health/errors')
            .then(response => response.json())
            .then(data => {
                console.log('Error Data:', data);
                // Display error statistics
            });
    </script>
</body>
</html>
```

## 🔔 Setting Up Alerts

### Environment Variables

Add to your backend `.env` file:

```env
# Error tracking alerts
ERROR_WEBHOOK_URL=https://your-webhook-url.com/alerts
ERROR_ALERT_EMAIL=admin@yourapp.com

# Performance monitoring
PERFORMANCE_ALERT_WEBHOOK=https://your-webhook-url.com/performance
```

### Webhook Integration

The system can send alerts to:
- Slack webhooks
- Discord webhooks
- Email services
- Custom webhook endpoints

## 📈 Production Deployment

### 1. Database Setup

Run the migration to create error tracking tables:

```bash
# Apply the migration
psql -d your_database -f backend/migrations/20240208_create_error_tracking_tables.sql
```

### 2. Environment Configuration

```env
# Production settings
NODE_ENV=production
LOG_LEVEL=info
ERROR_WEBHOOK_URL=https://your-alerts.com/webhook
ERROR_ALERT_EMAIL=alerts@yourcompany.com
```

### 3. Monitoring Setup

- Set up log aggregation (ELK stack, Datadog, etc.)
- Configure alerting rules
- Set up dashboards for key metrics
- Enable automated error reporting

## 🎯 Key Metrics to Monitor

### Performance Metrics
- API response times (< 1000ms target)
- Generation success rates (> 95% target)
- Queue processing times
- System resource usage

### Error Metrics
- Error rate (< 1% target)
- Critical errors (0 target)
- Time to resolution
- Error patterns and trends

## 🚀 Next Steps

1. **Set up the monitoring screens** in your app
2. **Configure alert webhooks** for production
3. **Run the database migration** for error storage
4. **Test the endpoints** with your backend running
5. **Customize the dashboards** for your specific needs

The monitoring systems are now fully functional and ready to provide comprehensive visibility into your application's health and performance!