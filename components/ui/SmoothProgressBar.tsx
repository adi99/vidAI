import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { MotiView, MotiText } from 'moti';
import { useTheme, Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface SmoothProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  height?: number;
  animated?: boolean;
  color?: string;
  backgroundColor?: string;
  borderRadius?: number;
  hapticFeedback?: boolean;
  pulseOnComplete?: boolean;
  showGlow?: boolean;
}

export default function SmoothProgressBar({
  progress,
  label,
  showPercentage = true,
  height = 8,
  animated = true,
  color,
  backgroundColor,
  borderRadius = 4,
  hapticFeedback = true,
  pulseOnComplete = true,
  showGlow = true,
}: SmoothProgressBarProps) {
  const theme = useTheme();
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const isComplete = clampedProgress >= 100;

  const progressColor = color || theme.colors.primary;
  const trackColor = backgroundColor || theme.colors.surfaceVariant;

  useEffect(() => {
    if (isComplete && hapticFeedback) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [isComplete, hapticFeedback]);

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelContainer}>
          <MotiText
            transition={{
              type: 'timing',
              duration: 300,
            }}
            style={[styles.label, { 
              color: isComplete ? theme.colors.primary : theme.colors.onSurface 
            }]}
          >
            {label}
          </MotiText>
          
          {showPercentage && (
            <MotiText
              animate={{
                scale: isComplete && pulseOnComplete ? [1, 1.1, 1] : 1,
              }}
              transition={{
                type: 'spring',
                damping: 15,
                stiffness: 300,
              }}
              style={[styles.percentage, { 
                color: isComplete ? theme.colors.primary : theme.colors.onSurfaceVariant 
              }]}
            >
              {Math.round(clampedProgress)}%
            </MotiText>
          )}
        </View>
      )}

      <MotiView
        animate={{
          scale: isComplete && pulseOnComplete ? [1, 1.02, 1] : 1,
        }}
        transition={{
          type: 'spring',
          damping: 15,
          stiffness: 300,
        }}
        style={[
          styles.progressContainer,
          {
            height,
            backgroundColor: trackColor,
            borderRadius,
          },
        ]}
      >
        <MotiView
          animate={{
            width: `${clampedProgress}%`,
          }}
          transition={
            animated 
              ? {
                  type: 'spring',
                  damping: 20,
                  stiffness: 300,
                }
              : {
                  type: 'timing',
                  duration: 200,
                }
          }
          style={[
            styles.progressFill,
            {
              height,
              borderRadius,
            },
          ]}
        >
          <LinearGradient
            colors={
              isComplete
                ? [theme.colors.primary, '#10B981']
                : [progressColor, progressColor + 'CC']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.gradient,
              {
                borderRadius,
              },
            ]}
          />

          {/* Animated shine effect */}
          {animated && clampedProgress > 0 && (
            <MotiView
              from={{ translateX: -100 }}
              animate={{ translateX: 200 }}
              transition={{
                type: 'timing',
                duration: 2000,
                loop: true,
              }}
              style={[
                styles.shine,
                {
                  height,
                  borderRadius,
                },
              ]}
            />
          )}
        </MotiView>

        {/* Glow effect */}
        {showGlow && clampedProgress > 0 && (
          <MotiView
            animate={{
              opacity: isComplete ? [0.8, 1, 0.8] : 0.6,
            }}
            transition={{
              type: 'timing',
              duration: 1500,
              loop: true,
            }}
            style={[
              styles.glow,
              {
                height: height + 4,
                borderRadius: borderRadius + 2,
                backgroundColor: progressColor + '40',
              },
            ]}
          />
        )}
      </MotiView>

      {/* Completion indicator */}
      {isComplete && (
        <MotiView
          from={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: 'spring',
            damping: 15,
            stiffness: 300,
            delay: 200,
          }}
          style={[
            styles.completionIndicator,
            { backgroundColor: theme.colors.primary },
          ]}
        >
          <Text style={[styles.completionText, { color: theme.colors.onPrimary }]}>
            ✓
          </Text>
        </MotiView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  percentage: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  shine: {
    position: 'absolute',
    top: 0,
    width: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  glow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    zIndex: -1,
  },
  completionIndicator: {
    position: 'absolute',
    right: -8,
    top: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});