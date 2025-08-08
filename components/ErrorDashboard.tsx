import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Alert, TouchableOpacity } from 'react-native';
// Chart components - install with: npm install react-native-chart-kit react-native-svg
// import { PieChart, BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { AlertTriangle, XCircle, CheckCircle, Clock, TrendingUp, Eye, Trash2 } from 'lucide-react-native';
import Button from './ui/Button';
import LoadingSkeleton from './ui/LoadingSkeleton';
import useErrorTracking from '@/hooks/useErrorTracking';
import { ErrorReport, ErrorPattern } from '@/services/errorTrackingService';

const screenWidth = Dimensions.get('window').width;

interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorRate: number;
  topErrors: Array<{ message: string; count: number; category: string }>;
  affectedUsers: number;
}

export const ErrorDashboard: React.FC = () => {
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  const [recentErrors, setRecentErrors] = useState<ErrorReport[]>([]);
  const [errorPatterns, setErrorPatterns] = useState<ErrorPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h'>('24h');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const {
    getErrorStats,
    getRecentErrors,
    getErrorPatterns,
    markErrorResolved,
    clearErrors,
    exportErrors,
  } = useErrorTracking();

  const loadErrorData = () => {
    try {
      const timeWindow = selectedTimeRange === '1h' ? 60 * 60 * 1000 : 
                        selectedTimeRange === '6h' ? 6 * 60 * 60 * 1000 : 
                        24 * 60 * 60 * 1000;

      const stats = getErrorStats(timeWindow);
      const errors = getRecentErrors(100);
      const patterns = getErrorPatterns();

      setErrorStats(stats);
      setRecentErrors(errors);
      setErrorPatterns(patterns);
    } catch (error) {
      console.error('Failed to load error data:', error);
      Alert.alert('Error', 'Failed to load error data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadErrorData();
  }, [selectedTimeRange]);

  const onRefresh = () => {
    setRefreshing(true);
    loadErrorData();
  };

  const handleMarkResolved = (errorId: string) => {
    Alert.alert(
      'Mark as Resolved',
      'Are you sure you want to mark this error as resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Resolved',
          style: 'default',
          onPress: () => {
            if (markErrorResolved(errorId)) {
              loadErrorData();
              Alert.alert('Success', 'Error marked as resolved');
            } else {
              Alert.alert('Error', 'Failed to mark error as resolved');
            }
          },
        },
      ]
    );
  };

  const handleClearAllErrors = () => {
    Alert.alert(
      'Clear All Errors',
      'Are you sure you want to clear all error data? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            clearErrors();
            loadErrorData();
            Alert.alert('Success', 'All errors cleared');
          },
        },
      ]
    );
  };

  const handleExportErrors = () => {
    try {
      const exportData = exportErrors();
      console.log('Exported error data:', exportData);
      Alert.alert('Success', 'Error data exported to console');
    } catch (error) {
      Alert.alert('Error', 'Failed to export error data');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#DC2626';
      case 'high': return '#EA580C';
      case 'medium': return '#D97706';
      case 'low': return '#65A30D';
      default: return '#6B7280';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      network: '#3B82F6',
      generation: '#8B5CF6',
      auth: '#EF4444',
      ui: '#10B981',
      system: '#F59E0B',
      unknown: '#6B7280',
    };
    return colors[category as keyof typeof colors] || colors.unknown;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const filteredErrors = selectedCategory 
    ? recentErrors.filter(error => error.category === selectedCategory)
    : recentErrors;

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

  if (!errorStats) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load error data</Text>
        <Button title="Retry" onPress={loadErrorData} />
      </View>
    );
  }

  // Prepare chart data
  const severityData = Object.entries(errorStats.errorsBySeverity).map(([severity, count]) => ({
    name: severity,
    population: count,
    color: getSeverityColor(severity),
    legendFontColor: '#7F7F7F',
    legendFontSize: 12,
  }));

  const categoryData = Object.entries(errorStats.errorsByCategory).map(([category, count]) => ({
    name: category,
    population: count,
    color: getCategoryColor(category),
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
      {/* Header Controls */}
      <View style={styles.headerControls}>
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
        
        <View style={styles.actionButtons}>
          <Button
            title="Export"
            onPress={handleExportErrors}
            style={styles.actionButton}
          />
          <Button
            title="Clear All"
            onPress={handleClearAllErrors}
            style={StyleSheet.flatten([styles.actionButton, styles.dangerButton])}
          />
        </View>
      </View>

      {/* Overview Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Error Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Errors</Text>
            <Text style={styles.statValue}>{errorStats.totalErrors}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Error Rate</Text>
            <Text style={styles.statValue}>{errorStats.errorRate.toFixed(1)}/hr</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Affected Users</Text>
            <Text style={styles.statValue}>{errorStats.affectedUsers}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Patterns</Text>
            <Text style={styles.statValue}>{errorPatterns.length}</Text>
          </View>
        </View>
      </View>

      {/* Error by Severity Chart */}
      {severityData.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Errors by Severity</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartPlaceholderText}>
              Chart requires react-native-chart-kit
            </Text>
            <Text style={styles.chartPlaceholderSubtext}>
              Install with: npm install react-native-chart-kit react-native-svg
            </Text>
          </View>
          {/* <PieChart
            data={severityData}
            width={screenWidth - 32}
            height={200}
            chartConfig={{
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          /> */}
        </View>
      )}

      {/* Error by Category Chart */}
      {categoryData.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Errors by Category</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartPlaceholderText}>
              Chart requires react-native-chart-kit
            </Text>
            <Text style={styles.chartPlaceholderSubtext}>
              Install with: npm install react-native-chart-kit react-native-svg
            </Text>
          </View>
          {/* <PieChart
            data={categoryData}
            width={screenWidth - 32}
            height={200}
            chartConfig={{
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          /> */}
        </View>
      )}

      {/* Category Filter */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Filter by Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
          <Button
            title="All"
            onPress={() => setSelectedCategory(null)}
            style={StyleSheet.flatten([
              styles.categoryButton,
              !selectedCategory && styles.categoryButtonActive
            ])}
          />
          {Object.keys(errorStats.errorsByCategory).map((category) => (
            <Button
              key={category}
              title={`${category} (${errorStats.errorsByCategory[category]})`}
              onPress={() => setSelectedCategory(category)}
              style={StyleSheet.flatten([
                styles.categoryButton,
                selectedCategory === category && styles.categoryButtonActive
              ])}
            />
          ))}
        </ScrollView>
      </View>

      {/* Top Error Messages */}
      {errorStats.topErrors.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Error Messages</Text>
          {errorStats.topErrors.slice(0, 5).map((error, index) => (
            <View key={index} style={styles.topErrorCard}>
              <View style={styles.topErrorHeader}>
                <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(error.category) }]}>
                  <Text style={styles.categoryBadgeText}>{error.category}</Text>
                </View>
                <Text style={styles.topErrorCount}>{error.count}x</Text>
              </View>
              <Text style={styles.topErrorMessage} numberOfLines={2}>
                {error.message}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Error Patterns */}
      {errorPatterns.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Error Patterns</Text>
          {errorPatterns.slice(0, 5).map((pattern, index) => (
            <View key={index} style={styles.patternCard}>
              <View style={styles.patternHeader}>
                <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(pattern.severity) }]}>
                  <Text style={styles.severityBadgeText}>{pattern.severity}</Text>
                </View>
                <Text style={styles.patternCount}>{pattern.count} occurrences</Text>
              </View>
              <Text style={styles.patternText} numberOfLines={2}>
                {pattern.pattern.replace(/\|/g, ' → ')}
              </Text>
              <Text style={styles.patternMeta}>
                {pattern.affectedUsers.size} users affected • 
                First seen: {formatTimestamp(pattern.firstSeen)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Recent Errors */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Recent Errors {selectedCategory && `(${selectedCategory})`}
        </Text>
        {filteredErrors.slice(0, 20).map((error) => (
          <View key={error.id} style={styles.errorCard}>
            <View style={styles.errorHeader}>
              <View style={styles.errorBadges}>
                <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(error.severity) }]}>
                  <Text style={styles.severityBadgeText}>{error.severity}</Text>
                </View>
                <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(error.category) }]}>
                  <Text style={styles.categoryBadgeText}>{error.category}</Text>
                </View>
              </View>
              <View style={styles.errorActions}>
                {!error.resolved && (
                  <TouchableOpacity
                    onPress={() => handleMarkResolved(error.id)}
                    style={styles.actionIcon}
                  >
                    <CheckCircle size={16} color="#10B981" />
                  </TouchableOpacity>
                )}
                {error.resolved && (
                  <View style={styles.resolvedBadge}>
                    <CheckCircle size={12} color="#10B981" />
                    <Text style={styles.resolvedText}>Resolved</Text>
                  </View>
                )}
              </View>
            </View>
            
            <Text style={styles.errorMessage} numberOfLines={2}>
              {error.error.message}
            </Text>
            
            <View style={styles.errorMeta}>
              <Text style={styles.errorTime}>
                {formatTimestamp(error.timestamp)}
              </Text>
              {error.context.screen && (
                <Text style={styles.errorScreen}>
                  Screen: {error.context.screen}
                </Text>
              )}
              {error.context.action && (
                <Text style={styles.errorAction}>
                  Action: {error.context.action}
                </Text>
              )}
            </View>
            
            {error.error.stack && (
              <TouchableOpacity
                onPress={() => Alert.alert('Stack Trace', error.error.stack)}
                style={styles.stackTraceButton}
              >
                <Eye size={12} color="#6B7280" />
                <Text style={styles.stackTraceText}>View Stack Trace</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        
        {filteredErrors.length === 0 && (
          <View style={styles.noErrorsCard}>
            <CheckCircle size={48} color="#10B981" />
            <Text style={styles.noErrorsText}>No errors found</Text>
            <Text style={styles.noErrorsSubtext}>
              {selectedCategory ? `No ${selectedCategory} errors in the selected time range` : 'No errors in the selected time range'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  headerControls: {
    marginBottom: 16,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
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
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  dangerButton: {
    borderColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  categoryFilter: {
    flexDirection: 'row',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  categoryButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  categoryButtonTextActive: {
    color: '#ffffff',
  },
  topErrorCard: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  topErrorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topErrorCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  topErrorMessage: {
    fontSize: 14,
    color: '#374151',
  },
  patternCard: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  patternHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  patternCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  patternText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  patternMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  errorCard: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#E5E7EB',
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  errorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    padding: 4,
  },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#ECFDF5',
    borderRadius: 4,
  },
  resolvedText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },
  errorMessage: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  errorMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  errorTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  errorScreen: {
    fontSize: 12,
    color: '#6B7280',
  },
  errorAction: {
    fontSize: 12,
    color: '#6B7280',
  },
  stackTraceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  stackTraceText: {
    fontSize: 12,
    color: '#6B7280',
  },
  noErrorsCard: {
    backgroundColor: '#ffffff',
    padding: 32,
    borderRadius: 8,
    alignItems: 'center',
  },
  noErrorsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 12,
    marginBottom: 4,
  },
  noErrorsSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
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
});

export default ErrorDashboard;