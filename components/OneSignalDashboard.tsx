import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import Button from '@/components/ui/Button';

interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  message: string;
  type: 'generation_complete' | 'training_done' | 'credit_low' | 'subscription_reminder' | 'custom';
}

interface UserSegment {
  id: string;
  name: string;
  description: string;
  userCount: number;
  filters: string[];
}

interface NotificationStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
}

export default function OneSignalDashboard() {
  const [activeTab, setActiveTab] = useState<'send' | 'templates' | 'segments' | 'analytics'>('send');
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [segments, setSegments] = useState<UserSegment[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Send notification form state
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedSegment, setSelectedSegment] = useState<string>('');
  const [customTitle, setCustomTitle] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load notification templates
      const templatesResponse = await fetch('/api/admin/onesignal/templates');
      const templatesData = await templatesResponse.json();
      setTemplates(templatesData.templates || []);

      // Load user segments
      const segmentsResponse = await fetch('/api/admin/onesignal/segments');
      const segmentsData = await segmentsResponse.json();
      setSegments(segmentsData.segments || []);

      // Load analytics
      const statsResponse = await fetch('/api/admin/onesignal/analytics');
      const statsData = await statsResponse.json();
      setStats(statsData.stats || null);
    } catch (error) {
      console.error('Failed to load OneSignal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendNotification = async () => {
    if (!selectedSegment) {
      Alert.alert('Error', 'Please select a user segment');
      return;
    }

    if (!selectedTemplate && (!customTitle || !customMessage)) {
      Alert.alert('Error', 'Please select a template or provide custom title and message');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/onesignal/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: selectedTemplate || null,
          segmentId: selectedSegment,
          customTitle: customTitle || null,
          customMessage: customMessage || null,
          scheduleTime: scheduleTime || null,
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        Alert.alert('Success', `Notification sent successfully! ID: ${result.notificationId}`);
        // Reset form
        setSelectedTemplate('');
        setSelectedSegment('');
        setCustomTitle('');
        setCustomMessage('');
        setScheduleTime('');
      } else {
        Alert.alert('Error', result.error || 'Failed to send notification');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async () => {
    if (!customTitle || !customMessage) {
      Alert.alert('Error', 'Please provide title and message for the template');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/onesignal/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Custom Template ${Date.now()}`,
          title: customTitle,
          message: customMessage,
          type: 'custom',
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Template created successfully');
        loadInitialData(); // Reload templates
        setCustomTitle('');
        setCustomMessage('');
      } else {
        Alert.alert('Error', 'Failed to create template');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderSendTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>📤 Send Push Notification</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Select Template:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
          <Button
            title="None (Custom)"
            onPress={() => setSelectedTemplate('')}
            style={!selectedTemplate ? [styles.templateButton, styles.selectedButton] : styles.templateButton}
          />
          {templates.map((template) => (
            <Button
              key={template.id}
              title={template.name}
              onPress={() => setSelectedTemplate(template.id)}
              style={selectedTemplate === template.id ? [styles.templateButton, styles.selectedButton] : styles.templateButton}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Target Segment:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
          {segments.map((segment) => (
            <Button
              key={segment.id}
              title={`${segment.name} (${segment.userCount})`}
              onPress={() => setSelectedSegment(segment.id)}
              style={selectedSegment === segment.id ? [styles.templateButton, styles.selectedButton] : styles.templateButton}
            />
          ))}
        </ScrollView>
      </View>

      {!selectedTemplate && (
        <>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Custom Title:</Text>
            <TextInput
              style={styles.textInput}
              value={customTitle}
              onChangeText={setCustomTitle}
              placeholder="Enter notification title"
              maxLength={100}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Custom Message:</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={customMessage}
              onChangeText={setCustomMessage}
              placeholder="Enter notification message"
              multiline
              numberOfLines={4}
              maxLength={500}
            />
          </View>
        </>
      )}

      <View style={styles.formGroup}>
        <Text style={styles.label}>Schedule Time (Optional):</Text>
        <TextInput
          style={styles.textInput}
          value={scheduleTime}
          onChangeText={setScheduleTime}
          placeholder="YYYY-MM-DD HH:MM (leave empty for immediate)"
        />
      </View>

      <View style={styles.buttonRow}>
        <Button
          title="Send Notification"
          onPress={sendNotification}
          disabled={loading}
          style={styles.primaryButton}
        />
        {!selectedTemplate && (
          <Button
            title="Save as Template"
            onPress={createTemplate}
            disabled={loading}
            style={styles.secondaryButton}
          />
        )}
      </View>
    </View>
  );

  const renderTemplatesTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>📝 Notification Templates</Text>
      
      {templates.map((template) => (
        <View key={template.id} style={styles.templateCard}>
          <View style={styles.templateHeader}>
            <Text style={styles.templateName}>{template.name}</Text>
            <Text style={styles.templateType}>{template.type.replace('_', ' ').toUpperCase()}</Text>
          </View>
          <Text style={styles.templateTitle}>Title: {template.title}</Text>
          <Text style={styles.templateMessage}>Message: {template.message}</Text>
        </View>
      ))}
      
      {templates.length === 0 && (
        <Text style={styles.emptyState}>No templates found. Create one using the Send tab.</Text>
      )}
    </View>
  );

  const renderSegmentsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>👥 User Segments</Text>
      
      {segments.map((segment) => (
        <View key={segment.id} style={styles.segmentCard}>
          <View style={styles.segmentHeader}>
            <Text style={styles.segmentName}>{segment.name}</Text>
            <Text style={styles.segmentCount}>{segment.userCount} users</Text>
          </View>
          <Text style={styles.segmentDescription}>{segment.description}</Text>
          <View style={styles.filterContainer}>
            {segment.filters.map((filter, index) => (
              <Text key={index} style={styles.filterTag}>{filter}</Text>
            ))}
          </View>
        </View>
      ))}
      
      {segments.length === 0 && (
        <Text style={styles.emptyState}>No segments found. Segments are managed in OneSignal dashboard.</Text>
      )}
    </View>
  );

  const renderAnalyticsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>📊 Notification Analytics</Text>
      
      {stats ? (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.sent.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Sent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.delivered.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.opened.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Opened</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.clicked.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Clicked</Text>
          </View>
          
          <View style={styles.rateContainer}>
            <View style={styles.rateCard}>
              <Text style={styles.rateNumber}>{(stats.deliveryRate * 100).toFixed(1)}%</Text>
              <Text style={styles.rateLabel}>Delivery Rate</Text>
            </View>
            <View style={styles.rateCard}>
              <Text style={styles.rateNumber}>{(stats.openRate * 100).toFixed(1)}%</Text>
              <Text style={styles.rateLabel}>Open Rate</Text>
            </View>
            <View style={styles.rateCard}>
              <Text style={styles.rateNumber}>{(stats.clickRate * 100).toFixed(1)}%</Text>
              <Text style={styles.rateLabel}>Click Rate</Text>
            </View>
          </View>
        </View>
      ) : (
        <Text style={styles.emptyState}>No analytics data available.</Text>
      )}
      
      <Button
        title="Refresh Analytics"
        onPress={loadInitialData}
        disabled={loading}
        style={styles.refreshButton}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <Button
          title="Send"
          onPress={() => setActiveTab('send')}
          style={activeTab === 'send' ? [styles.tabButton, styles.activeTab] : styles.tabButton}
        />
        <Button
          title="Templates"
          onPress={() => setActiveTab('templates')}
          style={activeTab === 'templates' ? [styles.tabButton, styles.activeTab] : styles.tabButton}
        />
        <Button
          title="Segments"
          onPress={() => setActiveTab('segments')}
          style={activeTab === 'segments' ? [styles.tabButton, styles.activeTab] : styles.tabButton}
        />
        <Button
          title="Analytics"
          onPress={() => setActiveTab('analytics')}
          style={activeTab === 'analytics' ? [styles.tabButton, styles.activeTab] : styles.tabButton}
        />
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'send' && renderSendTab()}
        {activeTab === 'templates' && renderTemplatesTab()}
        {activeTab === 'segments' && renderSegmentsTab()}
        {activeTab === 'analytics' && renderAnalyticsTab()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
  },
  activeTab: {
    backgroundColor: '#3b82f6',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  templateScroll: {
    flexDirection: 'row',
  },
  templateButton: {
    marginRight: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
  },
  selectedButton: {
    backgroundColor: '#3b82f6',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#10b981',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#6b7280',
  },
  templateCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  templateType: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  templateTitle: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  templateMessage: {
    fontSize: 14,
    color: '#6b7280',
  },
  segmentCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  segmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  segmentCount: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
  segmentDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  filterTag: {
    fontSize: 12,
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statsContainer: {
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  rateContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  rateCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rateNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#10b981',
  },
  rateLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#3b82f6',
    marginTop: 16,
  },
  emptyState: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 32,
  },
});