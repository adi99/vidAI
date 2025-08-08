import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Alert } from 'react-native';
// Chart components - install with: npm install react-native-chart-kit react-native-svg
// import { LineChart, BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { AlertTriangle, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react-native';
import Button from './ui/Button';
import LoadingSkeleton from './ui/LoadingSkeleton';

const screenWidth = Dimensions.get('window').width;

interface PerformanceStats {
  api: {
    averageResponseTime: number;
    successRate: number;
    slowEndpoints: Array<{ endpoint: string; averageTime: number }>;
    errorRate: number;
  };
  generation: {
    successRates: Record<string, number>;
    averageProcessingTimes: Record<string, number>;
    queueTimes: Record<string, number>;
    failureReasons: Record<string, number>;
  };
  queues: Record<string, any>;
  system: {
    memoryUsage: number;
    activeConnections: number;
    uptime: number;
  };
  alerts: Array<{
    type: 'warning' | 'critical';
    message: string;
    metric: string;
    value: number;
    threshold: number;
  }>;
}

interface GenerationSuccessRates {
  [key: string]: {
    hourly: Array<{ hour: number; successRate: number; total: number }>;
    overall: number;
  };
}

interface APIPerformanceTrends {
  responseTime: Array<{ hour: number; averageTime: number; requests: number }>;
  errorRate: Array<{ hour: number; errorRate: number; requests: number }>;
}

export const PerformanceDashboard: React.FC = () => {
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null);
  const [generationSuccessRates, setGenerationSuccessRates] = useState<GenerationSuccessRates | null>(null);
  const [apiTrends, setAPITrends] = useState<APIPerformanceTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h'>('24h');

  const fetchPerformanceData = async () => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const hours = selectedTimeRange === '1h' ? 1 : selectedTimeRange === '6h' ? 6 : 24;

      const [statsResponse, successResponse, trendsResponse] = await Promise.all([
        fetch(`${baseUrl}/health/performance`),
        fetch(`${baseUrl}/health/generation-success?hours=${hours}`),
        fetch(`${baseUrl}/health/api-performance?hours=${hours}`),
      ]);

      if (!statsResponse.ok || !successResponse.ok || !trendsResponse.ok) {
        throw new Error('Failed to fetch performance data');
      }

      const [statsData, successData, trendsData] = await Promise.all([
        statsResponse.json(),
        successResponse.json(),
        trendsResponse.json(),
      ]);

      setPerformanceStats(statsData.performance);
      setGenerationSuccessRates(successData.success_rates);
      setAPITrends(trendsData.trends);
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
      Alert.alert('Error', 'Failed to load performance data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, [selectedTimeRange]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPerformanceData();
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return '#10B981'; // green
    if (value >= thresholds.warning) return '#F59E0B'; // yellow
    return '#EF4444'; // red
  };

  const getAlertIcon = (type: 'warning' | 'critical') => {
    return type === 'critical' ? 
      <XCircle size={16} color="#EF4444" /> : 
      <AlertTriangle size={16} color="#F59E0B" />;
  };

  if (loading) {
    return (
      <ScrollView style={styles.container}>
        <LoadingSkeleton type="card" height={200} />
        <View style={{ marginTop: 16 }}>
          <LoadingSkeleton type="card" height={150} />
        </View>
        <View style={{ marginTop: 16 }}>
          <LoadingSkeleton type="card" height={150} />
        </View>
      </ScrollView>
    );
  }

  if (!performanceStats) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load performance data</Text>
        <Button title="Retry" onPress={fetchPerformanceData} />
      </View>
    );
  }

  // Prepare chart data
  const responseTimeData = apiTrends?.responseTime.slice(-24).map(d => d.averageTime) || [];
  const errorRateData = apiTrends?.errorRate.slice(-24).map(d => d.errorRate) || [];
  const generationSuccessData = Object.entries(performanceStats.generation.successRates).map(([type, rate]) => ({
    name: type,
    population: rate,
    color: getStatusColor(rate, { good: 95, warning: 90 }),
    legendFontColor: '#7F7F7F',
    legendFontSize: 12,
  }));

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Time Range Selector */}
      <View style={styles.timeRangeContainer}>
        {(['1h', '6h', '24h'] as const).map((range) => (
          <Button
            key={range}
            title={range}
            onPress={() => setSelectedTimeRange(range)}
            style={StyleSheet.flatten([
              styles.timeRangeButton,
              selectedTimeRange === range && styles.timeRangeButtonActive
            ])}
          />
        ))}
      </View>

      {/* Alerts Section */}
      {performanceStats.alerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Alerts</Text>
          {performanceStats.alerts.map((alert, index) => (
            <View key={index} style={[styles.alertCard, alert.type === 'critical' ? styles.criticalAlert : styles.warningAlert]}>
              <View style={styles.alertHeader}>
                {getAlertIcon(alert.type)}
                <Text style={styles.alertType}>{alert.type.toUpperCase()}</Text>
              </View>
              <Text style={styles.alertMessage}>{alert.message}</Text>
              <Text style={styles.alertDetails}>
                {alert.metric}: {alert.value.toFixed(2)} (threshold: {alert.threshold})
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* System Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Overview</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>API Success Rate</Text>
            <Text style={[styles.metricValue, { color: getStatusColor(performanceStats.api.successRate, { good: 95, warning: 90 }) }]}>
              {performanceStats.api.successRate.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Avg Response Time</Text>
            <Text style={[styles.metricValue, { color: getStatusColor(1000 - performanceStats.api.averageResponseTime, { good: 700, warning: 500 }) }]}>
              {performanceStats.api.averageResponseTime.toFixed(0)}ms
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Memory Usage</Text>
            <Text style={styles.metricValue}>
              {performanceStats.system.memoryUsage.toFixed(1)}MB
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Uptime</Text>
            <Text style={styles.metricValue}>
              {formatUptime(performanceStats.system.uptime)}
            </Text>
          </View>
        </View>
      </View>

      {/* API Performance Chart */}
      {responseTimeData.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Response Time Trend</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartPlaceholderText}>
              Chart requires react-native-chart-kit
            </Text>
            <Text style={styles.chartPlaceholderSubtext}>
              Install with: npm install react-native-chart-kit react-native-svg
            </Text>
          </View>
          {/* <LineChart
            data={{
              labels: Array.from({ length: Math.min(responseTimeData.length, 12) }, (_, i) => `${i * 2}h`),
              datasets: [{
                data: responseTimeData.slice(-12),
                color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                strokeWidth: 2,
              }],
            }}
            width={screenWidth - 32}
            height={200}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: '#3B82F6',
              },
            }}
            bezier
            style={styles.chart}
          /> */}
        </View>
      )}

      {/* Generation Success Rates */}
      {generationSuccessData.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Generation Success Rates</Text>
          <View style={styles.generationGrid}>
            {Object.entries(performanceStats.generation.successRates).map(([type, rate]) => (
              <View key={type} style={styles.generationCard}>
                <Text style={styles.generationLabel}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                <Text style={[styles.generationValue, { color: getStatusColor(rate, { good: 95, warning: 90 }) }]}>
                  {rate.toFixed(1)}%
                </Text>
                <View style={styles.generationBar}>
                  <View 
                    style={[
                      styles.generationBarFill, 
                      { 
                        width: `${rate}%`,
                        backgroundColor: getStatusColor(rate, { good: 95, warning: 90 })
                      }
                    ]} 
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Queue Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Queue Status</Text>
        <View style={styles.queueGrid}>
          {Object.entries(performanceStats.queues).map(([queueName, stats]) => (
            <View key={queueName} style={styles.queueCard}>
              <Text style={styles.queueName}>{queueName}</Text>
              <View style={styles.queueStats}>
                <View style={styles.queueStat}>
                  <Text style={styles.queueStatLabel}>Waiting</Text>
                  <Text style={styles.queueStatValue}>{stats?.waiting || 0}</Text>
                </View>
                <View style={styles.queueStat}>
                  <Text style={styles.queueStatLabel}>Active</Text>
                  <Text style={styles.queueStatValue}>{stats?.active || 0}</Text>
                </View>
                <View style={styles.queueStat}>
                  <Text style={styles.queueStatLabel}>Completed</Text>
                  <Text style={styles.queueStatValue}>{stats?.completed || 0}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Slow Endpoints */}
      {performanceStats.api.slowEndpoints.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Slow Endpoints</Text>
          {performanceStats.api.slowEndpoints.slice(0, 5).map((endpoint, index) => (
            <View key={index} style={styles.endpointCard}>
              <Text style={styles.endpointPath}>{endpoint.endpoint}</Text>
              <Text style={styles.endpointTime}>{endpoint.averageTime.toFixed(0)}ms</Text>
            </View>
          ))}
        </View>
      )}

      {/* Failure Reasons */}
      {Object.keys(performanceStats.generation.failureReasons).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Generation Failure Reasons</Text>
          {Object.entries(performanceStats.generation.failureReasons)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([reason, count]) => (
              <View key={reason} style={styles.failureCard}>
                <Text style={styles.failureReason}>{reason.replace(/_/g, ' ')}</Text>
                <Text style={styles.failureCount}>{count}</Text>
              </View>
            ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 4,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    borderRadius: 6,
  },
  timeRangeButtonActive: {
    backgroundColor: '#3B82F6',
  },
  timeRangeButtonText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  timeRangeButtonTextActive: {
    color: '#ffffff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  alertCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  criticalAlert: {
    backgroundColor: '#FEF2F2',
    borderLeftColor: '#EF4444',
  },
  warningAlert: {
    backgroundColor: '#FFFBEB',
    borderLeftColor: '#F59E0B',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertType: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    color: '#374151',
  },
  alertMessage: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  alertDetails: {
    fontSize: 12,
    color: '#6B7280',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartPlaceholder: {
    backgroundColor: '#ffffff',
    padding: 32,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  chartPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  chartPlaceholderSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  generationGrid: {
    gap: 12,
  },
  generationCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
  },
  generationLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  generationValue: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  generationBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  generationBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  queueGrid: {
    gap: 12,
  },
  queueCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
  },
  queueName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  queueStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  queueStat: {
    alignItems: 'center',
  },
  queueStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  queueStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  endpointCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  endpointPath: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  endpointTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  failureCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  failureReason: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    textTransform: 'capitalize',
  },
  failureCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
});

export default PerformanceDashboard;