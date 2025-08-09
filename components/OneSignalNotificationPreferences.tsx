import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, Alert, ScrollView } from 'react-native';
import { oneSignalService, NotificationPreferences } from '@/services/oneSignalService';
import Button from '@/components/ui/Button';

interface OneSignalNotificationPreferencesProps {
  onPreferencesChange?: (preferences: NotificationPreferences) => void;
}

export default function OneSignalNotificationPreferences({ onPreferencesChange }: OneSignalNotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    generation_complete: true,
    training_complete: true,
    social_interactions: true,
    subscription_updates: true,
    system_updates: true,
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    loadPreferencesAndConsent();
  }, []);

  const loadPreferencesAndConsent = async () => {
    try {
      // Check consent status
      const consentStatus = await oneSignalService.hasUserConsent();
      setHasConsent(consentStatus);

      // Load preferences if consent is given
      if (consentStatus) {
        const userPreferences = await oneSignalService.getPreferences();
        if (userPreferences) {
          setPreferences(userPreferences);
        }
      }

      // Check permission status
      // Note: In a real implementation, you'd check the actual permission status
      setPermissionGranted(consentStatus);
    } catch (error) {
      console.error('Failed to load notification preferences and consent:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestConsent = async () => {
    try {
      setUpdating(true);
      
      Alert.alert(
        'Notification Consent',
        'We would like to send you push notifications to keep you updated about your AI generations, training progress, and other important updates. You can change this setting at any time.',
        [
          {
            text: 'Deny',
            style: 'cancel',
            onPress: async () => {
              await oneSignalService.setConsentGiven(false);
              setHasConsent(false);
              setPermissionGranted(false);
            },
          },
          {
            text: 'Allow',
            onPress: async () => {
              const consentGiven = await oneSignalService.requestUserConsent();
              if (consentGiven) {
                setHasConsent(true);
                
                // Request push permissions
                const permissionGranted = await oneSignalService.requestPermissions();
                setPermissionGranted(permissionGranted);
                
                if (permissionGranted) {
                  // Load preferences after consent is given
                  await loadPreferencesAndConsent();
                  Alert.alert('Success', 'Notification permissions granted successfully!');
                } else {
                  Alert.alert('Notice', 'Consent given but push permissions were denied. You can enable them in device settings.');
                }
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to request consent:', error);
      Alert.alert('Error', 'Failed to process consent request');
    } finally {
      setUpdating(false);
    }
  };

  const revokeConsent = async () => {
    try {
      Alert.alert(
        'Revoke Consent',
        'This will disable all push notifications and clear your notification data. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Revoke',
            style: 'destructive',
            onPress: async () => {
              setUpdating(true);
              await oneSignalService.revokeConsent();
              setHasConsent(false);
              setPermissionGranted(false);
              
              // Reset preferences to default
              const defaultPreferences: NotificationPreferences = {
                generation_complete: true,
                training_complete: true,
                social_interactions: true,
                subscription_updates: true,
                system_updates: true,
              };
              setPreferences(defaultPreferences);
              
              Alert.alert('Success', 'Notification consent has been revoked and data cleared.');
              setUpdating(false);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to revoke consent:', error);
      Alert.alert('Error', 'Failed to revoke consent');
      setUpdating(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (updating || !hasConsent) return;

    setUpdating(true);
    const newPreferences = { ...preferences, [key]: value };
    
    try {
      const success = await oneSignalService.updatePreferences(newPreferences);
      if (success) {
        setPreferences(newPreferences);
        onPreferencesChange?.(newPreferences);
      } else {
        Alert.alert('Error', 'Failed to update notification preferences');
      }
    } catch (error) {
      console.error('Failed to update preference:', error);
      Alert.alert('Error', 'Failed to update notification preferences');
    } finally {
      setUpdating(false);
    }
  };

  const requestPushPermissions = async () => {
    try {
      setUpdating(true);
      const granted = await oneSignalService.requestPermissions();
      setPermissionGranted(granted);
      
      if (granted) {
        Alert.alert('Success', 'Push notification permissions granted!');
      } else {
        Alert.alert('Notice', 'Push permissions were denied. You can enable them in device settings.');
      }
    } catch (error) {
      console.error('Failed to request push permissions:', error);
      Alert.alert('Error', 'Failed to request push permissions');
    } finally {
      setUpdating(false);
    }
  };

  const preferenceItems = [
    {
      key: 'generation_complete' as keyof NotificationPreferences,
      title: 'Generation Complete',
      description: 'Notify when image or video generation is finished',
      icon: '🎨',
    },
    {
      key: 'training_complete' as keyof NotificationPreferences,
      title: 'Training Complete',
      description: 'Notify when model training is finished',
      icon: '🚀',
    },
    {
      key: 'social_interactions' as keyof NotificationPreferences,
      title: 'Social Interactions',
      description: 'Notify about likes, comments, and shares',
      icon: '❤️',
    },
    {
      key: 'subscription_updates' as keyof NotificationPreferences,
      title: 'Subscription Updates',
      description: 'Notify about subscription changes and renewals',
      icon: '💎',
    },
    {
      key: 'system_updates' as keyof NotificationPreferences,
      title: 'System Updates',
      description: 'Notify about app updates and maintenance',
      icon: '🔧',
    },
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </View>
    );
  }

  if (!hasConsent) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.consentContainer}>
          <Text style={styles.consentIcon}>🔔</Text>
          <Text style={styles.consentTitle}>Enable Push Notifications</Text>
          <Text style={styles.consentDescription}>
            Stay updated with your AI generations, training progress, and important app updates. 
            We respect your privacy and you can change these settings at any time.
          </Text>
          
          <View style={styles.privacyInfo}>
            <Text style={styles.privacyTitle}>🔒 Privacy Information</Text>
            <Text style={styles.privacyText}>
              • We only send notifications about your account activity{'\n'}
              • Your notification preferences are stored securely{'\n'}
              • You can revoke consent and clear data at any time{'\n'}
              • We never share your notification data with third parties
            </Text>
          </View>
          
          <Button
            title="Grant Notification Consent"
            onPress={requestConsent}
            disabled={updating}
            style={styles.consentButton}
          />
          
          <Text style={styles.disclaimerText}>
            By granting consent, you agree to receive push notifications. You can change this in settings.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notification Preferences</Text>
        <Text style={styles.subtitle}>Choose which notifications you'd like to receive</Text>
      </View>

      <View style={styles.statusContainer}>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Consent Status:</Text>
          <Text style={[styles.statusValue, styles.statusActive]}>✅ Granted</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Push Permissions:</Text>
          <Text style={[styles.statusValue, permissionGranted ? styles.statusActive : styles.statusInactive]}>
            {permissionGranted ? '✅ Enabled' : '❌ Disabled'}
          </Text>
        </View>
      </View>

      {!permissionGranted && (
        <View style={styles.permissionWarning}>
          <Text style={styles.warningText}>
            ⚠️ Push permissions are disabled. Enable them to receive notifications.
          </Text>
          <Button
            title="Enable Push Permissions"
            onPress={requestPushPermissions}
            disabled={updating}
            style={styles.permissionButton}
          />
        </View>
      )}
      
      <View style={styles.preferencesContainer}>
        {preferenceItems.map((item) => (
          <View key={item.key} style={styles.preferenceItem}>
            <View style={styles.preferenceContent}>
              <Text style={styles.preferenceIcon}>{item.icon}</Text>
              <View style={styles.preferenceText}>
                <Text style={styles.preferenceTitle}>{item.title}</Text>
                <Text style={styles.preferenceDescription}>{item.description}</Text>
              </View>
            </View>
            <Switch
              value={preferences[item.key]}
              onValueChange={(value) => updatePreference(item.key, value)}
              disabled={updating || !permissionGranted}
              trackColor={{ false: '#767577', true: '#007AFF' }}
              thumbColor={preferences[item.key] ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>
        ))}
      </View>

      <View style={styles.privacyControls}>
        <Text style={styles.privacyControlsTitle}>🔒 Privacy Controls</Text>
        
        <View style={styles.privacyAction}>
          <View style={styles.privacyActionText}>
            <Text style={styles.privacyActionTitle}>Data Export</Text>
            <Text style={styles.privacyActionDescription}>
              Download your notification preferences and data
            </Text>
          </View>
          <Button
            title="Export"
            onPress={() => {
              Alert.alert('Data Export', `Notification Preferences:\n${JSON.stringify(preferences, null, 2)}`);
            }}
            style={styles.privacyActionButton}
          />
        </View>

        <View style={styles.privacyAction}>
          <View style={styles.privacyActionText}>
            <Text style={styles.privacyActionTitle}>Revoke Consent</Text>
            <Text style={styles.privacyActionDescription}>
              Disable all notifications and clear your data
            </Text>
          </View>
          <Button
            title="Revoke"
            onPress={revokeConsent}
            disabled={updating}
            style={[styles.privacyActionButton, styles.revokeButton] as any}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  consentContainer: {
    padding: 24,
    alignItems: 'center',
  },
  consentIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  consentTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  consentDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  privacyInfo: {
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  consentButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 12,
    marginBottom: 16,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 16,
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  statusContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 8,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusActive: {
    color: '#10b981',
  },
  statusInactive: {
    color: '#ef4444',
  },
  permissionWarning: {
    backgroundColor: '#fef3c7',
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningText: {
    fontSize: 14,
    color: '#92400e',
    marginBottom: 12,
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: '#f59e0b',
  },
  preferencesContainer: {
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  preferenceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  preferenceIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  preferenceText: {
    flex: 1,
    marginRight: 16,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  privacyControls: {
    backgroundColor: '#ffffff',
    padding: 16,
  },
  privacyControlsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  privacyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  privacyActionText: {
    flex: 1,
    marginRight: 16,
  },
  privacyActionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  privacyActionDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  privacyActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#6b7280',
  },
  revokeButton: {
    backgroundColor: '#ef4444',
  },
});