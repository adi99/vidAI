import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, MotiText } from 'moti';
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  X, 
  CreditCard,
  Image as ImageIcon,
  Film,
  Brain,
  Trash2,
  RotateCcw
} from 'lucide-react-native';
import { useGenerationRecovery } from '@/hooks/useGenerationRecovery';
import { GenerationJob } from '@/services/generationRecoveryService';
import AnimatedCard from './AnimatedCard';
import LoadingSkeleton from './LoadingSkeleton';
import * as Haptics from 'expo-haptics';

interface GenerationRecoveryPanelProps {
  style?: any;
  showFailedOnly?: boolean;
  compact?: boolean;
}

export default function GenerationRecoveryPanel({
  style,
  showFailedOnly = false,
  compact = false,
}: GenerationRecoveryPanelProps) {
  const {
    activeJobs,
    failedJobs,
    stats,
    isLoading,
    retryJob,
    cancelJob,
    clearOldFailedJobs,
    refreshJobs,
    hasActiveJobs,
    hasFailedJobs,
    getRecoverableCredits,
  } = useGenerationRecovery();

  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const getJobIcon = (type: GenerationJob['type']) => {
    switch (type) {
      case 'image':
        return <ImageIcon size={16} color="#EC4899" />;
      case 'video':
        return <Film size={16} color="#8B5CF6" />;
      case 'training':
        return <Brain size={16} color="#F59E0B" />;
      default:
        return <ImageIcon size={16} color="#6B7280" />;
    }
  };

  const getStatusIcon = (status: GenerationJob['status']) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} color="#F59E0B" />;
      case 'processing':
        return <RefreshCw size={16} color="#3B82F6" />;
      case 'completed':
        return <CheckCircle size={16} color="#10B981" />;
      case 'failed':
        return <AlertTriangle size={16} color="#EF4444" />;
      case 'cancelled':
        return <X size={16} color="#6B7280" />;
      default:
        return <Clock size={16} color="#6B7280" />;
    }
  };

  const getStatusColor = (status: GenerationJob['status']) => {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'processing':
        return '#3B82F6';
      case 'completed':
        return '#10B981';
      case 'failed':
        return '#EF4444';
      case 'cancelled':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const success = await retryJob(jobId);
      if (success) {
        Alert.alert('Retry Started', 'The generation has been queued for retry.');
      } else {
        Alert.alert('Retry Failed', 'Unable to retry this generation. Please try again later.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to retry generation. Please try again.');
    }
  };

  const handleCancelJob = async (jobId: string) => {
    Alert.alert(
      'Cancel Generation',
      'Are you sure you want to cancel this generation? Credits will be refunded.',
      [
        { text: 'Keep Running', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelJob(jobId);
              Alert.alert('Cancelled', 'Generation cancelled and credits refunded.');
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel generation.');
            }
          },
        },
      ]
    );
  };

  const handleClearOldJobs = async () => {
    Alert.alert(
      'Clear Old Jobs',
      'Remove failed jobs older than 7 days?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            try {
              const removedCount = await clearOldFailedJobs(7);
              Alert.alert('Cleared', `Removed ${removedCount} old failed jobs.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to clear old jobs.');
            }
          },
        },
      ]
    );
  };

  const JobCard = ({ job }: { job: GenerationJob }) => {
    const isExpanded = expandedJob === job.id;
    
    return (
      <AnimatedCard
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setExpandedJob(isExpanded ? null : job.id);
        }}
        style={StyleSheet.flatten([
          styles.jobCard,
          { borderLeftColor: getStatusColor(job.status) }
        ])}
        padding={16}
        margin={0}
        animateOnPress={true}
        scaleOnPress={0.98}
      >
        <View style={styles.jobHeader}>
          <View style={styles.jobInfo}>
            <View style={styles.jobTypeIcon}>
              {getJobIcon(job.type)}
            </View>
            <View style={styles.jobDetails}>
              <Text style={styles.jobTitle} numberOfLines={1}>
                {job.prompt || `${job.type} generation`}
              </Text>
              <View style={styles.jobMeta}>
                <View style={styles.jobStatus}>
                  {getStatusIcon(job.status)}
                  <Text style={[styles.jobStatusText, { color: getStatusColor(job.status) }]}>
                    {job.status.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.jobTime}>{formatTime(job.updatedAt)}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.jobActions}>
            {job.creditsUsed > 0 && (
              <View style={styles.creditsInfo}>
                <CreditCard size={12} color="#F59E0B" />
                <Text style={styles.creditsText}>{job.creditsUsed}</Text>
              </View>
            )}
            
            {job.status === 'failed' && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleRetryJob(job.id)}
              >
                <RotateCcw size={14} color="#8B5CF6" />
              </TouchableOpacity>
            )}
            
            {(job.status === 'pending' || job.status === 'processing') && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleCancelJob(job.id)}
              >
                <X size={14} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {isExpanded && (
          <MotiView
            from={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{
              type: 'spring',
              damping: 20,
              stiffness: 300,
            }}
            style={styles.jobExpanded}
          >
            <View style={styles.expandedContent}>
              <Text style={styles.expandedLabel}>Settings:</Text>
              <Text style={styles.expandedValue}>
                {JSON.stringify(job.settings, null, 2)}
              </Text>
              
              {job.failureReason && (
                <>
                  <Text style={styles.expandedLabel}>Failure Reason:</Text>
                  <Text style={[styles.expandedValue, styles.errorText]}>
                    {job.failureReason}
                  </Text>
                </>
              )}
              
              <Text style={styles.expandedLabel}>Retry Count:</Text>
              <Text style={styles.expandedValue}>
                {job.retryCount} / {job.maxRetries}
              </Text>
              
              <Text style={styles.expandedLabel}>Created:</Text>
              <Text style={styles.expandedValue}>
                {new Date(job.createdAt).toLocaleString()}
              </Text>
            </View>
          </MotiView>
        )}
      </AnimatedCard>
    );
  };

  if (isLoading && (!hasActiveJobs && !hasFailedJobs)) {
    return (
      <View style={[styles.container, style]}>
        <LoadingSkeleton type="list" count={3} height={80} />
      </View>
    );
  }

  if (!hasActiveJobs && !hasFailedJobs) {
    return (
      <View style={[styles.container, styles.emptyContainer, style]}>
        <CheckCircle size={48} color="#10B981" />
        <Text style={styles.emptyTitle}>All Clear!</Text>
        <Text style={styles.emptySubtitle}>
          No active or failed generations to recover.
        </Text>
      </View>
    );
  }

  const jobsToShow = showFailedOnly ? failedJobs : [...activeJobs, ...failedJobs];

  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        <View style={styles.compactHeader}>
          <Text style={styles.compactTitle}>Generation Status</Text>
          <View style={styles.compactStats}>
            {stats.activeJobs > 0 && (
              <View style={styles.compactStat}>
                <Clock size={12} color="#F59E0B" />
                <Text style={styles.compactStatText}>{stats.activeJobs}</Text>
              </View>
            )}
            {stats.failedJobs > 0 && (
              <View style={styles.compactStat}>
                <AlertTriangle size={12} color="#EF4444" />
                <Text style={styles.compactStatText}>{stats.failedJobs}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Generation Recovery</Text>
        <View style={styles.headerActions}>
          {failedJobs.length > 0 && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleClearOldJobs}
            >
              <Trash2 size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              refreshJobs();
            }}
          >
            <RefreshCw size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.activeJobs}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.failedJobs}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.pendingRetries}</Text>
          <Text style={styles.statLabel}>Retrying</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{getRecoverableCredits()}</Text>
          <Text style={styles.statLabel}>Credits</Text>
        </View>
      </View>

      {/* Jobs List */}
      <ScrollView style={styles.jobsList} showsVerticalScrollIndicator={false}>
        {jobsToShow.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  jobsList: {
    maxHeight: 400,
  },
  jobCard: {
    backgroundColor: '#334155',
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  jobTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  jobDetails: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  jobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  jobStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jobStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  jobTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  jobActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creditsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#475569',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  creditsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  actionButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#475569',
  },
  jobExpanded: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#475569',
  },
  expandedContent: {
    gap: 8,
  },
  expandedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  expandedValue: {
    fontSize: 12,
    color: '#E5E7EB',
    fontFamily: 'monospace',
  },
  errorText: {
    color: '#EF4444',
  },
  // Compact styles
  compactContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  compactStats: {
    flexDirection: 'row',
    gap: 8,
  },
  compactStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  compactStatText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});