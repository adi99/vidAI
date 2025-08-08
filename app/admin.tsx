import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '@/components/ui/Button';
import PerformanceDashboard from '@/components/PerformanceDashboard';
import ErrorDashboard from '@/components/ErrorDashboard';

type DashboardType = 'performance' | 'errors' | null;

export default function AdminScreen() {
  const [activeDashboard, setActiveDashboard] = useState<DashboardType>(null);

  const renderDashboard = () => {
    switch (activeDashboard) {
      case 'performance':
        return <PerformanceDashboard />;
      case 'errors':
        return <ErrorDashboard />;
      default:
        return (
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>🎯 Monitoring Dashboard</Text>
            <Text style={styles.welcomeSubtitle}>
              Choose a dashboard to view real-time monitoring data
            </Text>
            
            <View style={styles.dashboardGrid}>
              <View style={styles.dashboardCard}>
                <Text style={styles.cardTitle}>📊 Performance Monitoring</Text>
                <Text style={styles.cardDescription}>
                  View API response times, generation success rates, queue status, and system health metrics
                </Text>
                <Button
                  title="View Performance"
                  onPress={() => setActiveDashboard('performance')}
                  style={styles.cardButton}
                />
              </View>
              
              <View style={styles.dashboardCard}>
                <Text style={styles.cardTitle}>🚨 Error Tracking</Text>
                <Text style={styles.cardDescription}>
                  Monitor errors, track patterns, view resolution status, and manage alerts
                </Text>
                <Button
                  title="View Errors"
                  onPress={() => setActiveDashboard('errors')}
                  style={styles.cardButton}
                />
              </View>
            </View>
            
            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>📈 Key Features</Text>
              <View style={styles.featureList}>
                <Text style={styles.featureItem}>• Real-time performance metrics</Text>
                <Text style={styles.featureItem}>• Automatic error categorization</Text>
                <Text style={styles.featureItem}>• Alert system with thresholds</Text>
                <Text style={styles.featureItem}>• Historical trend analysis</Text>
                <Text style={styles.featureItem}>• Export and resolution tracking</Text>
              </View>
            </View>
            
            <View style={styles.statusSection}>
              <Text style={styles.statusTitle}>🔗 API Endpoints</Text>
              <Text style={styles.statusText}>Backend: http://localhost:3000</Text>
              <Text style={styles.statusText}>Health: /health/system</Text>
              <Text style={styles.statusText}>Performance: /health/performance</Text>
              <Text style={styles.statusText}>Errors: /health/errors</Text>
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        {activeDashboard && (
          <Button
            title="← Back"
            onPress={() => setActiveDashboard(null)}
            style={styles.backButton}
          />
        )}
      </View>
      
      <ScrollView style={styles.content}>
        {renderDashboard()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#6b7280',
  },
  content: {
    flex: 1,
  },
  welcomeContainer: {
    padding: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  dashboardGrid: {
    gap: 16,
    marginBottom: 32,
  },
  dashboardCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  cardButton: {
    backgroundColor: '#3b82f6',
  },
  infoSection: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  featureList: {
    gap: 4,
  },
  featureItem: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  statusSection: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});