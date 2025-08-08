import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { MotiView, MotiText } from 'moti';
import { useTheme, Text, Card, IconButton } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, X, Sparkles, Wand2, Image as ImageIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import SmoothProgressBar from './SmoothProgressBar';
import HapticButton from './HapticButton';

interface GenerationProgressProps {
  progress: number; // 0-100
  type: 'image' | 'video' | 'edit';
  isActive: boolean;
  onCancel?: () => void;
  estimatedTime?: number; // in seconds
  currentStep?: string;
  showSteps?: boolean;
}

const GENERATION_STEPS = {
  image: [
    'Analyzing prompt...',
    'Initializing AI model...',
    'Generating image...',
    'Applying enhancements...',
    'Finalizing result...',
  ],
  video: [
    'Processing input...',
    'Generating keyframes...',
    'Creating motion...',
    'Rendering video...',
    'Optimizing output...',
  ],
  edit: [
    'Analyzing image...',
    'Preparing edit tools...',
    'Applying changes...',
    'Refining details...',
    'Saving result...',
  ],
};

export default function GenerationProgress({
  progress,
  type,
  isActive,
  onCancel,
  estimatedTime,
  currentStep,
  showSteps = true,
}: GenerationProgressProps) {
  const theme = useTheme();
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const steps = GENERATION_STEPS[type];
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const isComplete = clampedProgress >= 100;

  // Update current step based on progress
  useEffect(() => {
    if (showSteps && steps.length > 0) {
      const stepIndex = Math.min(
        Math.floor((clampedProgress / 100) * steps.length),
        steps.length - 1
      );
      setCurrentStepIndex(stepIndex);
    }
  }, [clampedProgress, steps.length, showSteps]);

  // Timer for elapsed time
  useEffect(() => {
    if (!isActive) {
      setTimeElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  // Haptic feedback on progress milestones
  useEffect(() => {
    if (clampedProgress > 0 && clampedProgress % 25 === 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [clampedProgress]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'image':
        return <ImageIcon size={20} color={theme.colors.primary} />;
      case 'video':
        return <Sparkles size={20} color={theme.colors.primary} />;
      case 'edit':
        return <Wand2 size={20} color={theme.colors.primary} />;
      default:
        return <Sparkles size={20} color={theme.colors.primary} />;
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'image':
        return 'Generating Image';
      case 'video':
        return 'Creating Video';
      case 'edit':
        return 'Editing Image';
      default:
        return 'Processing';
    }
  };

  if (!isActive) return null;

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9, translateY: 20 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      exit={{ opacity: 0, scale: 0.9, translateY: -20 }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 300,
      }}
      style={styles.container}
    >
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={4}>
        <LinearGradient
          colors={[theme.colors.primary + '20', 'transparent']}
          style={styles.cardGradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MotiView
                animate={{
                  rotate: isComplete ? '0deg' : '360deg',
                }}
                transition={{
                  type: 'timing',
                  duration: 2000,
                  loop: !isComplete,
                }}
              >
                {getTypeIcon()}
              </MotiView>
              
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                  {getTypeLabel()}
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {isComplete ? 'Complete!' : `${Math.round(clampedProgress)}% complete`}
                </Text>
              </View>
            </View>

            {onCancel && !isComplete && (
              <HapticButton
                mode="text"
                onPress={onCancel}
                style={styles.cancelButton}
                hapticType="light"
              >
                <X size={20} color={theme.colors.onSurfaceVariant} />
              </HapticButton>
            )}
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <SmoothProgressBar
              progress={clampedProgress}
              height={6}
              animated={true}
              showGlow={true}
              pulseOnComplete={true}
              hapticFeedback={false} // We handle haptics above
            />
          </View>

          {/* Current Step */}
          {showSteps && steps.length > 0 && (
            <MotiView
              animate={{
                opacity: isComplete ? 0.7 : 1,
              }}
              transition={{
                type: 'timing',
                duration: 300,
              }}
              style={styles.stepSection}
            >
              <MotiText
                key={currentStepIndex}
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  type: 'spring',
                  damping: 20,
                  stiffness: 300,
                }}
                style={[styles.currentStep, { color: theme.colors.onSurfaceVariant }]}
              >
                {currentStep || steps[currentStepIndex]}
              </MotiText>
            </MotiView>
          )}

          {/* Time Information */}
          <View style={styles.timeSection}>
            <View style={styles.timeItem}>
              <Clock size={14} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
                {formatTime(timeElapsed)}
              </Text>
            </View>

            {estimatedTime && !isComplete && (
              <Text style={[styles.estimatedTime, { color: theme.colors.onSurfaceVariant }]}>
                ~{formatTime(Math.max(0, estimatedTime - timeElapsed))} remaining
              </Text>
            )}
          </View>

          {/* Completion Animation */}
          {isComplete && (
            <MotiView
              from={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                type: 'spring',
                damping: 15,
                stiffness: 300,
                delay: 300,
              }}
              style={styles.completionBadge}
            >
              <LinearGradient
                colors={[theme.colors.primary, '#10B981']}
                style={styles.completionGradient}
              >
                <Text style={[styles.completionText, { color: theme.colors.onPrimary }]}>
                  ✓ Ready!
                </Text>
              </LinearGradient>
            </MotiView>
          )}
        </LinearGradient>
      </Card>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  cancelButton: {
    margin: 0,
    minWidth: 40,
  },
  progressSection: {
    marginBottom: 16,
  },
  stepSection: {
    marginBottom: 12,
  },
  currentStep: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  timeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  estimatedTime: {
    fontSize: 12,
  },
  completionBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  completionGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  completionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});