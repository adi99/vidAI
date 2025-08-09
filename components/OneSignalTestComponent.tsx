import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import Button from '@/components/ui/Button';
import { oneSignalService } from '@/services/oneSignalService';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface TestResult {
  test: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  timestamp?: string;
}

export default function OneSignalTestComponent() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { user } = useAuth();

  const addTestResult = (test: string, status: 'success' | 'error' | 'pending', message: string) => {
    setTestResults(prev => [
      ...prev.filter(r => r.test !== test),
      {
        test,
        status,
        message,
        timestamp: new Date().toLocaleTimeString(),
      }
    ]);
  };

  const runTest = async (testName: string, testFunction: () => Promise<void>) => {
    addTestResult(testName, 'pending', 'Running...');
    try {
      await testFunction();
      addTestResult(testName, 'success', 'Passed');
    } catch (error) {
      addTestResult(testName, 'error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const testOneSignalInitialization = async () => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }
    
    // Test OneSignal service initialization
    await oneSignalService.initializeWithUser(user.id);
    
    // Test getting OneSignal IDs
    const oneSignalId = await oneSignalService.getOneSignalId();
    const pushSubscriptionId = oneSignalService.getPushSubscriptionId();
    
    if (!oneSignalId && !pushSubscriptionId) {
      throw new Error('OneSignal IDs not available - may need user interaction');
    }
  };

  const testPermissionRequest = async () => {
    const hasPermission = await oneSignalService.requestPermissions();
    if (!hasPermission) {
      throw new Error('Push permissions not granted');
    }
  };

  const testUserTags = async () => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    // Test adding single tag
    await oneSignalService.addUserTag('test_tag', 'test_value');
    
    // Test adding multiple tags
    await oneSignalService.addUserTags({
      test_environment: 'true',
      test_timestamp: new Date().toISOString(),
      user_type: 'test_user',
    });
  };

  const testNotificationPreferences = async () => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    // Test getting preferences
    const preferences = await oneSignalService.getPreferences();
    if (!preferences) {
      throw new Error('Failed to get notification preferences');
    }

    // Test updating preferences
    const testPreferences = {
      ...preferences,
      system_updates: !preferences.system_updates, // Toggle one preference
    };
    
    const success = await oneSignalService.updatePreferences(testPreferences);
    if (!success) {
      throw new Error('Failed to update notification preferences');
    }

    // Restore original preferences
    await oneSignalService.updatePreferences(preferences);
  };

  const testBackendNotification = async () => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/admin/onesignal/test/${user.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Backend notification test failed');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Backend notification test failed');
    }
  };

  const testConsentManagement = async () => {
    // Test consent status check
    const hasConsent = await oneSignalService.hasUserConsent();
    
    // Test setting consent (should already be true if we got this far)
    await oneSignalService.setConsentGiven(true);
    
    // Test consent required setting
    await oneSignalService.setConsentRequired(false);
  };

  const testEventListeners = async () => {
    // Test setting up event listeners
    const cleanup = oneSignalService.setupEventListeners();
    
    // Cleanup immediately for test
    if (typeof cleanup === 'function') {
      cleanup();
    }
  };

  const testEmailSubscription = async () => {
    if (!user?.email) {
      throw new Error('User email not available');
    }

    await oneSignalService.addEmail(user.email);
  };

  const runAllTests = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setIsRunning(true);
    setTestResults([]);

    const tests = [
      { name: 'OneSignal Initialization', fn: testOneSignalInitialization },
      { name: 'Permission Request', fn: testPermissionRequest },
      { name: 'User Tags', fn: testUserTags },
      { name: 'Notification Preferences', fn: testNotificationPreferences },
      { name: 'Backend Notification', fn: testBackendNotification },
      { name: 'Consent Management', fn: testConsentManagement },
      { name: 'Event Listeners', fn: testEventListeners },
      { name: 'Email Subscription', fn: testEmailSubscription },
    ];

    for (const test of tests) {
      await runTest(test.name, test.fn);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunning(false);
    
    const failedTests = testResults.filter(r => r.status === 'error');
    const successfulTests = testResults.filter(r => r.status === 'success');
    
    Alert.alert(
      'Test Results',
      `✅ ${successfulTests.length} tests passed\n❌ ${failedTests.length} tests failed`,
      [{ text: 'OK' }]
    );
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const getStatusIcon = (status: 'pending' | 'success' | 'error') => {
    switch (status) {
      case 'pending': return '⏳';
      case 'success': return '✅';
      case 'error': return '❌';
    }
  };

  const getStatusColor = (status: 'pending' | 'success' | 'error') => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔔 OneSignal Integration Test</Text>
        <Text style={styles.subtitle}>
          Validate OneSignal push notification integration
        </Text>
      </View>

      <View style={styles.controls}>
        <Button
          title="Run All Tests"
          onPress={runAllTests}
          disabled={isRunning}
          style={styles.runButton}
        />
        <Button
          title="Clear Results"
          onPress={clearResults}
          disabled={isRunning}
          style={styles.clearButton}
        />
      </View>

      <View style={styles.userInfo}>
        <Text style={styles.infoTitle}>Test Environment</Text>
        <Text style={styles.infoText}>User ID: {user?.id || 'Not authenticated'}</Text>
        <Text style={styles.infoText}>Email: {user?.email || 'Not available'}</Text>
        <Text style={styles.infoText}>Environment: {__DEV__ ? 'Development' : 'Production'}</Text>
        <Text style={styles.infoText}>
          OneSignal App ID: {process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ? 'Configured' : 'Not configured'}
        </Text>
      </View>

      <View style={styles.results}>
        <Text style={styles.resultsTitle}>Test Results</Text>
        
        {testResults.length === 0 ? (
          <Text style={styles.noResults}>No tests run yet</Text>
        ) : (
          testResults.map((result, index) => (
            <View key={index} style={styles.resultItem}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultIcon}>{getStatusIcon(result.status)}</Text>
                <Text style={styles.resultTest}>{result.test}</Text>
                {result.timestamp && (
                  <Text style={styles.resultTime}>{result.timestamp}</Text>
                )}
              </View>
              <Text style={[styles.resultMessage, { color: getStatusColor(result.status) }]}>
                {result.message}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>📋 Test Instructions</Text>
        <Text style={styles.instructionText}>
          1. Ensure you're logged in with a valid user account{'\n'}
          2. Make sure OneSignal App ID is configured in app.json{'\n'}
          3. Run tests on a physical device for push notifications{'\n'}
          4. Grant notification permissions when prompted{'\n'}
          5. Check OneSignal dashboard for user registration{'\n'}
          6. Verify test notifications are received
        </Text>
      </View>

      <View style={styles.troubleshooting}>
        <Text style={styles.troubleshootingTitle}>🔧 Troubleshooting</Text>
        <Text style={styles.troubleshootingText}>
          • Permission Request fails: Check device notification settings{'\n'}
          • Backend Notification fails: Verify API endpoint and authentication{'\n'}
          • User Tags fail: Check OneSignal App ID configuration{'\n'}
          • Initialization fails: Ensure OneSignal plugin is properly configured{'\n'}
          • No notifications received: Check OneSignal dashboard delivery status
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  controls: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  runButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#6b7280',
  },
  userInfo: {
    padding: 16,
    backgroundColor: '#f0f9ff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  results: {
    padding: 16,
    backgroundColor: '#ffffff',
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  noResults: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
  resultItem: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#e5e7eb',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  resultTest: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  resultTime: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  resultMessage: {
    fontSize: 13,
    marginLeft: 24,
    fontFamily: 'monospace',
  },
  instructions: {
    padding: 16,
    backgroundColor: '#f0fdf4',
    margin: 16,
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
  },
  troubleshooting: {
    padding: 16,
    backgroundColor: '#fef3c7',
    margin: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  troubleshootingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  troubleshootingText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
});