import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TestTube, CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';
import { useIAP } from '@/hooks/useIAP';
import { useAuth } from '@/contexts/AuthContext';

interface TestResult {
  name: string;
  status: 'success' | 'error';
  message: string;
}

export default function IAPTestComponent() {
  const { user, credits } = useAuth();
  const {
    packages,
    loading,
    canMakePayments,
    initialized,
    purchaseCredits,
    restorePurchases,
    redeemOfferCode,
  } = useIAP();

  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);

  // Show web-specific message
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#8B5CF6', '#EC4899']}
          style={styles.header}
        >
          <TestTube size={24} color="#FFFFFF" />
          <Text style={styles.headerTitle}>IAP System Test</Text>
          <Text style={styles.headerSubtitle}>
            Test in-app purchase functionality
          </Text>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.webNotice}>
            <AlertCircle size={48} color="#F59E0B" />
            <Text style={styles.webNoticeTitle}>Web Platform Notice</Text>
            <Text style={styles.webNoticeText}>
              In-app purchases are not supported on web browsers. This feature is only available on iOS and Android mobile devices.
            </Text>
            <Text style={styles.webNoticeSubtext}>
              To test IAP functionality, please run this app on a mobile device or simulator.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const addTestResult = (name: string, status: 'success' | 'error', message: string) => {
    setTestResults(prev => [
      ...prev.filter(r => r.name !== name),
      { name, status, message }
    ]);
  };

  const runTests = async () => {
    setTesting(true);
    setTestResults([]);

    // Test 1: IAP Service Initialization
    try {
      if (initialized) {
        addTestResult('IAP Initialization', 'success', 'IAP service is initialized');
      } else {
        addTestResult('IAP Initialization', 'error', 'IAP service not initialized');
      }
    } catch (error) {
      addTestResult('IAP Initialization', 'error', `Error: ${error}`);
    }

    // Test 2: Payment Capability
    try {
      if (canMakePayments) {
        addTestResult('Payment Capability', 'success', 'Device can make payments');
      } else {
        addTestResult('Payment Capability', 'error', 'Device cannot make payments');
      }
    } catch (error) {
      addTestResult('Payment Capability', 'error', `Error: ${error}`);
    }

    // Test 3: Package Loading
    try {
      if (packages.length > 0) {
        addTestResult('Package Loading', 'success', `Loaded ${packages.length} packages`);
      } else {
        addTestResult('Package Loading', 'error', 'No packages loaded');
      }
    } catch (error) {
      addTestResult('Package Loading', 'error', `Error: ${error}`);
    }

    // Test 4: User Authentication
    try {
      if (user) {
        addTestResult('User Authentication', 'success', `User authenticated: ${user.email}`);
      } else {
        addTestResult('User Authentication', 'error', 'User not authenticated');
      }
    } catch (error) {
      addTestResult('User Authentication', 'error', `Error: ${error}`);
    }

    // Test 5: Credit Balance
    try {
      addTestResult('Credit Balance', 'success', `Current balance: ${credits} credits`);
    } catch (error) {
      addTestResult('Credit Balance', 'error', `Error: ${error}`);
    }

    setTesting(false);
  };

  const testPurchase = async () => {
    if (packages.length === 0) {
      Alert.alert('Error', 'No packages available for testing');
      return;
    }

    const testPackage = packages[0]; // Use the first package for testing

    Alert.alert(
      'Test Purchase',
      `This will attempt to purchase ${testPackage.title} for ${testPackage.price}. This is a real purchase that will charge your account. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: async () => {
            const result = await purchaseCredits(testPackage.id);
            if (result.success) {
              Alert.alert('Success', `Test purchase successful! Received ${result.credits} credits`);
            } else {
              Alert.alert('Failed', result.error || 'Test purchase failed');
            }
          },
        },
      ]
    );
  };

  const testRestore = async () => {
    const result = await restorePurchases();
    if (result.success) {
      Alert.alert('Success', `Restored ${result.restoredCount} purchases`);
    } else {
      Alert.alert('Failed', result.error || 'Restore failed');
    }
  };

  const testOfferCodeRedemption = async () => {
    const result = await redeemOfferCode();
    if (!result.success) {
      Alert.alert('Failed', result.error || 'Offer code redemption failed');
    }
    // Success messages are handled within the redeemOfferCode function
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} color="#10B981" />;
      case 'error':
        return <XCircle size={16} color="#EF4444" />;
      default:
        return <AlertCircle size={16} color="#F59E0B" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return '#10B981';
      case 'error':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        style={styles.header}
      >
        <TestTube size={24} color="#FFFFFF" />
        <Text style={styles.headerTitle}>IAP System Test</Text>
        <Text style={styles.headerSubtitle}>
          Test in-app purchase functionality
        </Text>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Status</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>IAP Initialized</Text>
              <Text style={[styles.statusValue, { color: initialized ? '#10B981' : '#EF4444' }]}>
                {initialized ? 'Yes' : 'No'}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Can Make Payments</Text>
              <Text style={[styles.statusValue, { color: canMakePayments ? '#10B981' : '#EF4444' }]}>
                {canMakePayments ? 'Yes' : 'No'}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Packages Loaded</Text>
              <Text style={styles.statusValue}>{packages.length}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Current Credits</Text>
              <Text style={styles.statusValue}>{credits.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Packages</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#8B5CF6" />
          ) : packages.length > 0 ? (
            packages.map((pkg) => (
              <View key={pkg.id} style={styles.packageItem}>
                <View style={styles.packageInfo}>
                  <Text style={styles.packageTitle}>{pkg.title}</Text>
                  <Text style={styles.packagePrice}>{pkg.price}</Text>
                </View>
                <Text style={styles.packageCredits}>{pkg.credits} credits</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No packages available</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Actions</Text>
          <View style={styles.buttonGrid}>
            <TouchableOpacity
              style={styles.testButton}
              onPress={runTests}
              disabled={testing}
            >
              <LinearGradient
                colors={['#8B5CF6', '#3B82F6']}
                style={styles.buttonGradient}
              >
                {testing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Run Tests</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.testButton}
              onPress={testPurchase}
              disabled={!canMakePayments || packages.length === 0}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Test Purchase</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.testButton}
              onPress={testRestore}
              disabled={!canMakePayments}
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Test Restore</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.testButton}
              onPress={testOfferCodeRedemption}
              disabled={!canMakePayments}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Redeem Offer Code</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {testResults.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Test Results</Text>
            <View style={styles.resultsList}>
              {testResults.map((result, index) => (
                <View key={index} style={styles.resultItem}>
                  <View style={styles.resultHeader}>
                    {getStatusIcon(result.status)}
                    <Text style={styles.resultName}>{result.name}</Text>
                  </View>
                  <Text style={[styles.resultMessage, { color: getStatusColor(result.status) }]}>
                    {result.message}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E5E7EB',
    opacity: 0.9,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusItem: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
    textAlign: 'center',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  packageItem: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packageInfo: {
    flex: 1,
  },
  packageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  packagePrice: {
    fontSize: 12,
    color: '#94A3B8',
  },
  packageCredits: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonGrid: {
    gap: 12,
  },
  testButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultsList: {
    gap: 8,
  },
  resultItem: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultMessage: {
    fontSize: 12,
    marginLeft: 24,
  },
  webNotice: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    marginTop: 40,
  },
  webNoticeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  webNoticeText: {
    fontSize: 16,
    color: '#E5E7EB',
    textAlign: 'center',
    lineHeight: 24,
  },
  webNoticeSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
});