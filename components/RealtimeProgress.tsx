import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader, 
  Zap, 
  X,
  AlertCircle,
  Play,
  Pause
} from 'lucide-react-native';
import { useGenerationProgress, useTrainingProgress } from '@/hooks/useRealtime';

interface RealtimeProgressProps {
  jobId?: string;
  type: 'generation' | 'training';
  title?: string;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  showModal?: boolean;
  autoHide?: boolean;
  hideDelay?: number;
}

export function RealtimeProgress({
  jobId,
  type,
  title,
  onComplete,
  onError,
  onCancel,
  showModal = false,
  autoHide = true,
  hideDelay = 3000,
}: RealtimeProgressProps) {
  const [visible, setVisible] = useState(false);
  const [animatedWidth] = useState(new Animated.Value(0));
  const [pulseAnimation] = useState(new Animated.Value(1));
  
  const generationProgress = useGenerationProgress(type === 'generation' ? jobId : undefined);
  const trainingProgress = useTrainingProgress(type === 'training' ? jobId : undefined);
  
  const progress = type === 'generation' ? generationProgress.progress : trainingProgress.progress;
  const isLoading = type === 'generation' ? generationProgress.isLoading : trainingProgress.isLoading;

  // Show/hide modal based on job status
  useEffect(() => {
    if (jobId && isLoading) {
      setVisible(true);
    } else if (!isLoading && autoHide) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, hideDelay);
      
      return () => clearTimeout(timer);
    }
  }, [jobId, isLoading, autoHide, hideDelay]);

  // Animate progress bar
  useEffect(() => {
    if (progress) {
      Animated.timing(animatedWidth, {
        toValue: progress.progress,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  }, [progress?.progress, animatedWidth]);

  // Pulse animation for active states
  useEffect(() => {
    if (progress?.status === 'active') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      
      return () => pulse.stop();
    }
  }, [progress?.status, pulseAnimation]);

  // Handle completion
  useEffect(() => {
    if (progress?.status === 'completed' && 'result' in progress && progress.result) {
      onComplete?.(progress.result);
    } else if (progress?.status === 'failed' && progress.error) {
      onError?.(progress.error);
    }
  }, [progress?.status, progress, onComplete, onError]);

  const getStatusIcon = () => {
    if (!progress) return <Loader size={20} color="#8B5CF6" />;
    
    switch (progress.status) {
      case 'waiting':
        return <Clock size={20} color="#FF9800" />;
      case 'active':
        return (
          <Animated.View style={{ transform: [{ scale: pulseAnimation }] }}>
            <Zap size={20} color="#8B5CF6" />
          </Animated.View>
        );
      case 'completed':
        return <CheckCircle size={20} color="#4CAF50" />;
      case 'failed':
        return <XCircle size={20} color="#F44336" />;
      default:
        return <Loader size={20} color="#8B5CF6" />;
    }
  };

  const getStatusText = () => {
    if (!progress) return 'Initializing...';
    
    switch (progress.status) {
      case 'waiting':
        return 'Waiting in queue...';
      case 'active':
        return type === 'generation' ? 'Generating...' : 'Training model...';
      case 'completed':
        return type === 'generation' ? 'Generation complete!' : 'Training complete!';
      case 'failed':
        return 'Failed';
      default:
        return 'Processing...';
    }
  };

  const getProgressText = () => {
    if (!progress) return '0%';
    
    if (type === 'training' && 'currentStep' in progress && progress.currentStep) {
      return `${progress.progress}% - ${progress.currentStep}`;
    }
    
    return `${progress.progress}%`;
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: animatedWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.progressText}>{getProgressText()}</Text>
    </View>
  );

  const renderError = () => {
    if (progress?.status !== 'failed' || !progress.error) return null;
    
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={16} color="#F44336" />
        <Text style={styles.errorText} numberOfLines={2}>
          {progress.error}
        </Text>
      </View>
    );
  };

  const renderContent = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          {getStatusIcon()}
          <Text style={styles.title}>
            {title || (type === 'generation' ? 'AI Generation' : 'Model Training')}
          </Text>
        </View>
        
        {onCancel && progress?.status !== 'completed' && progress?.status !== 'failed' && (
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <X size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>
      
      <Text style={styles.statusText}>{getStatusText()}</Text>
      
      {progress && progress.status !== 'completed' && progress.status !== 'failed' && (
        renderProgressBar()
      )}
      
      {renderError()}
      
      {progress?.status === 'completed' && (
        <View style={styles.successContainer}>
          <CheckCircle size={24} color="#4CAF50" />
          <Text style={styles.successText}>
            {type === 'generation' ? 'Your content is ready!' : 'Model training completed!'}
          </Text>
        </View>
      )}
    </View>
  );

  if (showModal) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {renderContent()}
          </View>
        </View>
      </Modal>
    );
  }

  if (!visible) return null;

  return (
    <View style={styles.inlineContainer}>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  inlineContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    alignItems: 'stretch',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  cancelButton: {
    padding: 4,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#C62828',
  },
  successContainer: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    textAlign: 'center',
  },
});