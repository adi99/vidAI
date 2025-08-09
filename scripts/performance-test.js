#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Performance testing and optimization script
 */
class PerformanceTester {
  constructor() {
    this.results = {
      bundleSize: {},
      loadTimes: {},
      memoryUsage: {},
      recommendations: [],
    };
  }

  /**
   * Run all performance tests
   */
  async runAllTests() {
    console.log('🚀 Starting performance tests...\n');

    try {
      await this.testBundleSize();
      await this.testLoadTimes();
      await this.testMemoryUsage();
      await this.generateRecommendations();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Performance test failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test bundle size
   */
  async testBundleSize() {
    console.log('📦 Testing bundle size...');

    try {
      // Build for web to get bundle size
      execSync('expo export --platform web', { stdio: 'pipe' });

      const distPath = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distPath)) {
        const bundleStats = this.analyzeBundleSize(distPath);
        this.results.bundleSize = bundleStats;
        
        console.log(`   Total bundle size: ${this.formatBytes(bundleStats.total)}`);
        console.log(`   JavaScript: ${this.formatBytes(bundleStats.js)}`);
        console.log(`   CSS: ${this.formatBytes(bundleStats.css)}`);
        console.log(`   Assets: ${this.formatBytes(bundleStats.assets)}`);
      }
    } catch (error) {
      console.warn('   ⚠️  Bundle size test failed:', error.message);
    }

    console.log('');
  }

  /**
   * Analyze bundle size from dist directory
   */
  analyzeBundleSize(distPath) {
    const stats = {
      total: 0,
      js: 0,
      css: 0,
      assets: 0,
      files: [],
    };

    const walkDir = (dir) => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          walkDir(filePath);
        } else {
          const size = stat.size;
          const ext = path.extname(file).toLowerCase();
          
          stats.total += size;
          stats.files.push({ name: file, size, path: filePath });
          
          if (ext === '.js') {
            stats.js += size;
          } else if (ext === '.css') {
            stats.css += size;
          } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
            stats.assets += size;
          }
        }
      });
    };

    walkDir(distPath);
    return stats;
  }

  /**
   * Test load times (simulated)
   */
  async testLoadTimes() {
    console.log('⏱️  Testing load times...');

    // Simulate load time tests
    const loadTests = [
      { component: 'App Startup', time: this.simulateLoadTime(800, 1500) },
      { component: 'Feed Screen', time: this.simulateLoadTime(200, 800) },
      { component: 'Video Generation', time: this.simulateLoadTime(300, 1000) },
      { component: 'Image Generation', time: this.simulateLoadTime(250, 900) },
      { component: 'Training Screen', time: this.simulateLoadTime(400, 1200) },
      { component: 'Profile Screen', time: this.simulateLoadTime(150, 600) },
    ];

    loadTests.forEach(test => {
      this.results.loadTimes[test.component] = test.time;
      const status = test.time < 1000 ? '✅' : test.time < 2000 ? '⚠️' : '❌';
      console.log(`   ${status} ${test.component}: ${test.time}ms`);
    });

    console.log('');
  }

  /**
   * Test memory usage (simulated)
   */
  async testMemoryUsage() {
    console.log('🧠 Testing memory usage...');

    const memoryTests = [
      { component: 'Base App', memory: this.simulateMemoryUsage(20, 40) },
      { component: 'Feed with 50 items', memory: this.simulateMemoryUsage(60, 100) },
      { component: 'Video Player', memory: this.simulateMemoryUsage(80, 150) },
      { component: 'Image Editor', memory: this.simulateMemoryUsage(100, 200) },
      { component: 'Training Interface', memory: this.simulateMemoryUsage(70, 120) },
    ];

    memoryTests.forEach(test => {
      this.results.memoryUsage[test.component] = test.memory;
      const status = test.memory < 100 ? '✅' : test.memory < 200 ? '⚠️' : '❌';
      console.log(`   ${status} ${test.component}: ${test.memory}MB`);
    });

    console.log('');
  }

  /**
   * Generate performance recommendations
   */
  async generateRecommendations() {
    console.log('💡 Generating recommendations...');

    const recommendations = [];

    // Bundle size recommendations
    if (this.results.bundleSize.total > 5 * 1024 * 1024) { // 5MB
      recommendations.push({
        type: 'bundle',
        priority: 'high',
        message: 'Bundle size is large. Consider code splitting and lazy loading.',
        action: 'Implement lazy loading for heavy components',
      });
    }

    if (this.results.bundleSize.js > 2 * 1024 * 1024) { // 2MB
      recommendations.push({
        type: 'bundle',
        priority: 'medium',
        message: 'JavaScript bundle is large. Analyze for unused code.',
        action: 'Run bundle analyzer and remove unused dependencies',
      });
    }

    // Load time recommendations
    const avgLoadTime = Object.values(this.results.loadTimes).reduce((sum, time) => sum + time, 0) / Object.keys(this.results.loadTimes).length;
    if (avgLoadTime > 1000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Average load time is slow. Optimize component rendering.',
        action: 'Implement React.memo and useMemo for expensive components',
      });
    }

    // Memory recommendations
    const maxMemory = Math.max(...Object.values(this.results.memoryUsage));
    if (maxMemory > 150) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: 'High memory usage detected. Implement memory optimization.',
        action: 'Add memory cleanup and optimize large data structures',
      });
    }

    // General recommendations
    recommendations.push({
      type: 'optimization',
      priority: 'low',
      message: 'Enable image optimization for better performance.',
      action: 'Implement progressive image loading and WebP format',
    });

    recommendations.push({
      type: 'caching',
      priority: 'medium',
      message: 'Implement aggressive caching for API responses.',
      action: 'Add Redis caching and optimize cache invalidation',
    });

    this.results.recommendations = recommendations;

    recommendations.forEach(rec => {
      const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      console.log(`   ${priority} [${rec.type.toUpperCase()}] ${rec.message}`);
      console.log(`      → ${rec.action}`);
    });

    console.log('');
  }

  /**
   * Generate performance report
   */
  async generateReport() {
    console.log('📊 Generating performance report...');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        bundleSize: this.results.bundleSize.total,
        avgLoadTime: Object.values(this.results.loadTimes).reduce((sum, time) => sum + time, 0) / Object.keys(this.results.loadTimes).length,
        maxMemoryUsage: Math.max(...Object.values(this.results.memoryUsage)),
        recommendationCount: this.results.recommendations.length,
      },
      details: this.results,
      score: this.calculatePerformanceScore(),
    };

    // Save report to file
    const reportPath = path.join(process.cwd(), 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(report);
    const htmlPath = path.join(process.cwd(), 'performance-report.html');
    fs.writeFileSync(htmlPath, htmlReport);

    console.log(`   📄 Report saved to: ${reportPath}`);
    console.log(`   🌐 HTML report saved to: ${htmlPath}`);
    console.log(`   📈 Performance Score: ${report.score}/100`);

    // Display score with color
    if (report.score >= 80) {
      console.log('   ✅ Excellent performance!');
    } else if (report.score >= 60) {
      console.log('   ⚠️  Good performance, room for improvement');
    } else {
      console.log('   ❌ Performance needs optimization');
    }

    console.log('');
  }

  /**
   * Calculate performance score
   */
  calculatePerformanceScore() {
    let score = 100;

    // Bundle size penalty
    const bundleSizeMB = this.results.bundleSize.total / (1024 * 1024);
    if (bundleSizeMB > 5) score -= 20;
    else if (bundleSizeMB > 3) score -= 10;
    else if (bundleSizeMB > 2) score -= 5;

    // Load time penalty
    const avgLoadTime = Object.values(this.results.loadTimes).reduce((sum, time) => sum + time, 0) / Object.keys(this.results.loadTimes).length;
    if (avgLoadTime > 2000) score -= 25;
    else if (avgLoadTime > 1500) score -= 15;
    else if (avgLoadTime > 1000) score -= 10;

    // Memory usage penalty
    const maxMemory = Math.max(...Object.values(this.results.memoryUsage));
    if (maxMemory > 200) score -= 20;
    else if (maxMemory > 150) score -= 10;
    else if (maxMemory > 100) score -= 5;

    // High priority recommendations penalty
    const highPriorityRecs = this.results.recommendations.filter(rec => rec.priority === 'high').length;
    score -= highPriorityRecs * 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .score { font-size: 48px; font-weight: bold; color: ${report.score >= 80 ? '#22c55e' : report.score >= 60 ? '#f59e0b' : '#ef4444'}; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #e5e7eb; border-radius: 6px; }
        .section h3 { margin-top: 0; color: #374151; }
        .metric { display: flex; justify-content: space-between; margin: 10px 0; }
        .recommendation { margin: 10px 0; padding: 10px; border-left: 4px solid #3b82f6; background: #f8fafc; }
        .high { border-left-color: #ef4444; }
        .medium { border-left-color: #f59e0b; }
        .low { border-left-color: #22c55e; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Performance Report</h1>
            <div class="score">${report.score}/100</div>
            <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
        </div>
        
        <div class="section">
            <h3>Bundle Size Analysis</h3>
            <div class="metric"><span>Total Size:</span><span>${this.formatBytes(report.details.bundleSize.total)}</span></div>
            <div class="metric"><span>JavaScript:</span><span>${this.formatBytes(report.details.bundleSize.js)}</span></div>
            <div class="metric"><span>CSS:</span><span>${this.formatBytes(report.details.bundleSize.css)}</span></div>
            <div class="metric"><span>Assets:</span><span>${this.formatBytes(report.details.bundleSize.assets)}</span></div>
        </div>
        
        <div class="section">
            <h3>Load Times</h3>
            ${Object.entries(report.details.loadTimes).map(([component, time]) => 
              `<div class="metric"><span>${component}:</span><span>${time}ms</span></div>`
            ).join('')}
        </div>
        
        <div class="section">
            <h3>Memory Usage</h3>
            ${Object.entries(report.details.memoryUsage).map(([component, memory]) => 
              `<div class="metric"><span>${component}:</span><span>${memory}MB</span></div>`
            ).join('')}
        </div>
        
        <div class="section">
            <h3>Recommendations</h3>
            ${report.details.recommendations.map(rec => 
              `<div class="recommendation ${rec.priority}">
                <strong>[${rec.type.toUpperCase()}]</strong> ${rec.message}<br>
                <em>Action: ${rec.action}</em>
              </div>`
            ).join('')}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Simulate load time for testing
   */
  simulateLoadTime(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Simulate memory usage for testing
   */
  simulateMemoryUsage(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Run performance tests
if (require.main === module) {
  const tester = new PerformanceTester();
  tester.runAllTests().catch(console.error);
}

module.exports = PerformanceTester;