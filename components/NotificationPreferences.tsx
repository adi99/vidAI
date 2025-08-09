import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, Alert } from 'react-native';
import { notificationService, NotificationPreferences } from '@/services/notificationService';

interface NotificationPreferencesProps {
  onPreferencesChange?: (preferences: NotificationPreferences) => void;
}

export default function NotificationPreferencesComponent({ onPreferencesChange }: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    generation_complete: true,
    training_complete: true,
    social_interactions: true,
    subscription_updates: true,
    system_updates: true,
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const userPreferences = await notificationService.getPreferences();
      if (userPreferences) {
        setPreferences(userPreferences);
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (updating) return;

    setUpdating(true);
    const newPreferences = { ...preferences, [key]: value };
    
    try {
      const success = await notificationService.updatePreferences(newPreferences);
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

  const preferenceItems = [
    {
      key: 'generation_complete' as keyof NotificationPreferences,
      title: 'Generation Complete',
      description: 'Notify when image or video generation is finished',
    },
    {
      key: 'training_complete' as keyof NotificationPreferences,
      title: 'Training Complete',
      description: 'Notify when model training is finished',
    },
    {
      key: 'social_interactions' as keyof NotificationPreferences,
      title: 'Social Interactions',
      description: 'Notify about likes, comments, and shares',
    },
    {
      key: 'subscription_updates' as keyof NotificationPreferences,
      title: 'Subscription Updates',
      description: 'Notify about subscription changes and renewals',
    },
    {
      key: 'system_updates' as keyof NotificationPreferences,
      title: 'System Updates',
      description: 'Notify about app updates and maintenance',
    },
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notification Preferences</Text>
      <Text style={styles.subtitle}>Choose which notifications you'd like to receive</Text>
      
      {preferenceItems.map((item) => (
        <View key={String(item.key)} style={styles.preferenceItem}>
          <View style={styles.preferenceText}>
            <Text style={styles.preferenceTitle}>{item.title}</Text>
            <Text style={styles.preferenceDescription}>{item.description}</Text>
          </View>
          <Switch
            value={preferences[item.key]}
            onValueChange={(value) => updatePreference(item.key, value)}
            disabled={updating}
            trackColor={{ false: '#767577', true: '#007AFF' }}
            thumbColor={preferences[item.key] ? '#FFFFFF' : '#f4f3f4'}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
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
});