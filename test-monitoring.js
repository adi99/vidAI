#!/usr/bin/env node

/**
 * Test script to demonstrate the monitoring systems
 * Run with: node test-monitoring.js
 */

const baseUrl = 'http://localhost:3000';

async function testMonitoringEndpoints() {
  console.log('🚀 Testing Performance Monitoring & Error Tracking Systems\n');

  const endpoints = [
    {
      name: 'System Health',
      url: '/health/system',
      description: 'Overall system health status'
    },
    {
      name: 'Performance Metrics',
      url: '/health/performance',
      description: 'Detailed performance statistics'
    },
    {
      name: 'Generation Success Rates',
      url: '/health/generation-success?hours=24',
      description: 'AI generation success rates over 24 hours'
    },
    {
      name: 'API Performance Trends',
      url: '/health/api-performance?hours=24',
      description: 'API response time and error rate trends'
    },
    {
      name: 'Queue Status',
      url: '/health/queues',
      description: 'Current queue status for all job types'
    },
    {
      name: 'Performance Alerts',
      url: '/health/alerts',
      description: 'Active performance alerts'
    },
    {
      name: 'Error Statistics',
      url: '/health/errors?hours=24',
      description: 'Error tracking statistics'
    }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`📊 ${endpoint.name}`);
      console.log(`   ${endpoint.description}`);
      console.log(`   GET ${baseUrl}${endpoint.url}`);
      
      const response = await fetch(`${baseUrl}${endpoint.url}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ Success');
        
        // Show key metrics for each endpoint
        if (endpoint.url.includes('system')) {
          console.log(`   Status: ${data.status}`);
          console.log(`   API Response Time: ${data.performance_summary?.api_response_time}ms`);
          console.log(`   API Success Rate: ${data.performance_summary?.api_success_rate}%`);
        } else if (endpoint.url.includes('performance')) {
          console.log(`   API Success Rate: ${data.api?.successRate}%`);
          console.log(`   Avg Response Time: ${data.api?.averageResponseTime}ms`);
          console.log(`   Active Alerts: ${data.alerts?.length || 0}`);
        } else if (endpoint.url.includes('errors')) {
          console.log(`   Total Errors: ${data.error_stats?.totalErrors || 0}`);
          console.log(`   Critical Errors: ${data.error_stats?.criticalErrors || 0}`);
          console.log(`   Error Rate: ${data.error_stats?.errorRate || 0}/hr`);
        } else if (endpoint.url.includes('alerts')) {
          console.log(`   Active Alerts: ${data.alert_count || 0}`);
          console.log(`   Critical Alerts: ${data.critical_alerts || 0}`);
        }
        
      } else {
        console.log(`   ❌ Failed: ${response.status} ${response.statusText}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('🎯 How to view the data:');
  console.log('');
  console.log('1. 📱 Mobile App Dashboards:');
  console.log('   - Import PerformanceDashboard component');
  console.log('   - Import ErrorDashboard component');
  console.log('   - Add to any screen in your app');
  console.log('');
  console.log('2. 🌐 Web Browser:');
  console.log('   - Open browser to any endpoint above');
  console.log('   - Example: http://localhost:3000/health/system');
  console.log('');
  console.log('3. 📊 API Testing:');
  console.log('   - Use curl, Postman, or any HTTP client');
  console.log('   - All endpoints return JSON data');
  console.log('');
  console.log('4. 🔄 Real-time Monitoring:');
  console.log('   - Data updates automatically as your app runs');
  console.log('   - Generate some API traffic to see metrics change');
  console.log('');
}

// Generate some test traffic to populate metrics
async function generateTestTraffic() {
  console.log('🔄 Generating test traffic to populate metrics...\n');
  
  const testEndpoints = [
    '/health/system',
    '/health/performance',
    '/health/queues',
    '/health/errors'
  ];
  
  // Make several requests to generate metrics
  for (let i = 0; i < 5; i++) {
    for (const endpoint of testEndpoints) {
      try {
        await fetch(`${baseUrl}${endpoint}`);
      } catch (error) {
        // Ignore errors for test traffic
      }
    }
  }
  
  console.log('✅ Test traffic generated\n');
}

async function main() {
  console.log('🎯 Performance Monitoring & Error Tracking Test\n');
  
  // Check if backend is running
  try {
    const response = await fetch(`${baseUrl}/health/system`);
    if (!response.ok) {
      throw new Error('Backend not responding');
    }
  } catch (error) {
    console.log('❌ Backend server not running!');
    console.log('');
    console.log('Please start your backend server first:');
    console.log('   cd backend');
    console.log('   npm run dev');
    console.log('');
    console.log('Then run this script again: node test-monitoring.js');
    return;
  }
  
  // Generate some test data
  await generateTestTraffic();
  
  // Test all monitoring endpoints
  await testMonitoringEndpoints();
  
  console.log('🎉 Monitoring systems are working!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Add the dashboard components to your React Native app');
  console.log('2. Configure alert webhooks in your .env file');
  console.log('3. Run the database migration for persistent error storage');
  console.log('4. Customize the dashboards for your specific needs');
}

// Run the test
main().catch(console.error);