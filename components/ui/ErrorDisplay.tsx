import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  AlertTriangle, 
  RefreshCw, 
  Wifi, 
  CreditCard, 
  Clock, 
  Shield,
  AlertCircle,
  XCircle
} from 'lucide-react-native';
import { APIError, ERROR_CODES } from '@/services/errorHandlingService';
import AnimatedCard from './AnimatedCard';
import * as Haptics from 'expo-haptics';

interface ErrorDisplayProps {
  error: APIError;
  onRetry?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
  showSuggestions?: boolean;
  style?: any;
}

export default function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  compact = false,
  showSuggestions = true,
  style,
}: ErrorDisplayProps) {
  const getErrorIcon = () => {
    switch (error.code) {
      case ERROR_CODES.NETWORK_ERROR:
        return <Wifi size={compact ? 20 : 32} color="#EF4444" />;
      case ERROR_CODES.INSUFFICIENT_CREDITS:
        return <CreditCard size={compact ? 20 : 32} color="#F59E0B" />;
      case ERROR_CODES.RATE_LIMITED:
        return <Clock size={compact ? 20 : 32} color="#8B5CF6" />;
      case ERROR_CODES.AUTHENTICATION_ERROR:
        return <Shield size={compact ? 20 : 32} color="#EF4444" />;
      case ERROR_CODES.GENERATION_FAILED:
        return <XCircle size={compact ? 20 : 32} color="#EF4444" />;
      default:
        return <AlertTriangle size={compact ? 20 : 32} color="#EF4444" />;
    }
  };

  const getErrorColor = (): [string, string] => {
    switch (error.code) {
      case ERROR_CODES.INSUFFICIENT_CREDITS:
        return ['#F59E0B', '#EF4444'];
      case ERROR_CODES.RATE_LIMITED:
        return ['#8B5CF6', '#3B82F6'];
      case ERROR_CODES.NETWORK_ERROR:
      case ERROR_CODES.AUTHENTICATION_ERROR:
      case ERROR_CODES.GENERATION_FAILED:
        return ['#EF4444', '#DC2626'];
      default:
        return ['#6B7280', '#4B5563'];
    }
  };

  const getSuggestions = () => {
    switch (error.code) {
      case ERROR_CODES.NETWORK_ERROR:
        return [
          'Check your internet connection',
          'Try switching between WiFi and mobile data',
          'Restart the app',
        ];
      case ERROR_CODES.INSUFFICIENT_CREDITS:
        return [
          'Purchase more credits',
          'Use lower quality settings',
          'Check your subscription status',
        ];
      case ERROR_CODES.GENERATION_FAILED:
        return [
          'Try a different prompt',
          'Adjust generation settings',
          'Try again in a few minutes',
        ];
      case ERROR_CODES.RATE_LIMITED:
        return [
          'Wait a few minutes before trying again',
          'Consider upgrading your subscription',
        ];
      case ERROR_CODES.AUTHENTICATION_ERROR:
        return [
          'Log out and log back in',
          'Check your internet connection',
        ];
      default:
        return [
          'Try again',
          'Restart the app if the issue persists',
        ];
    }
  };

  if (compact) {
    return (
      <AnimatedCard
        style={StyleSheet.flatten([styles.compactContainer, style])}
        padding={12}
        margin={0}
      >
        <View style={styles.compactContent}>
          <View style={styles.compactIcon}>
            {getErrorIcon()}
          </View>
          <View style={styles.compactText}>
            <Text style={styles.compactMessage} numberOfLines={2}>
              {error.message}
            </Text>
          </View>
          {error.retryable && onRetry && (
            <TouchableOpacity
              style={styles.compactRetryButton}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onRetry();
              }}
            >
              <RefreshCw size={16} color="#8B5CF6" />
            </TouchableOpacity>
          )}
          {onDismiss && (
            <TouchableOpacity
              style={styles.compactDismissButton}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onDismiss();
              }}
            >
              <XCircle size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </AnimatedCard>
    );
  }

  return (
    <AnimatedCard
      style={StyleSheet.flatten([styles.container, style])}
      padding={0}
      margin={0}
    >
      <LinearGradient
        colors={getErrorColor()}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            {getErrorIcon()}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              {error.code === ERROR_CODES.NETWORK_ERROR ? 'Connection Error' :
               error.code === ERROR_CODES.INSUFFICIENT_CREDITS ? 'Insufficient Credits' :
               error.code === ERROR_CODES.GENERATION_FAILED ? 'Generation Failed' :
               error.code === ERROR_CODES.RATE_LIMITED ? 'Rate Limited' :
               error.code === ERROR_CODES.AUTHENTICATION_ERROR ? 'Authentication Required' :
               'Error'}
            </Text>
            <Text style={styles.message}>
              {error.message}
            </Text>
          </View>
          {onDismiss && (
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onDismiss();
              }}
            >
              <XCircle size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {showSuggestions && (
          <View style={styles.suggestions}>
            <Text style={styles.suggestionsTitle}>Try this:</Text>
            {getSuggestions().map((suggestion, index) => (
              <View key={index} style={styles.suggestion}>
                <View style={styles.bullet} />
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </View>
            ))}
          </View>
        )}

        {error.retryable && onRetry && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onRetry();
            }}
          >
            <LinearGradient
              colors={['#FFFFFF', '#F3F4F6']}
              style={styles.retryGradient}
            >
              <RefreshCw size={20} color="#374151" />
              <Text style={styles.retryText}>Try Again</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 8,
  },
  gradient: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    lineHeight: 20,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
  suggestions: {
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    opacity: 0.8,
  },
  suggestionText: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.8,
    flex: 1,
  },
  retryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  retryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  // Compact styles
  compactContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactIcon: {
    marginRight: 12,
  },
  compactText: {
    flex: 1,
  },
  compactMessage: {
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 18,
  },
  compactRetryButton: {
    padding: 8,
    marginLeft: 8,
  },
  compactDismissButton: {
    padding: 8,
    marginLeft: 4,
  },
});

// Specific error display components for common error types
export const NetworkErrorDisplay = (props: Omit<ErrorDisplayProps, 'error'>) => (
  <ErrorDisplay
    {...props}
    error={{
      code: ERROR_CODES.NETWORK_ERROR,
      message: 'Network connection failed. Please check your internet connection.',
      timestamp: new Date().toISOString(),
      retryable: true,
    }}
  />
);

export const InsufficientCreditsDisplay = (props: Omit<ErrorDisplayProps, 'error'>) => (
  <ErrorDisplay
    {...props}
    error={{
      code: ERROR_CODES.INSUFFICIENT_CREDITS,
      message: 'You don\'t have enough credits for this operation.',
      timestamp: new Date().toISOString(),
      retryable: false,
    }}
  />
);

export const GenerationFailedDisplay = (props: Omit<ErrorDisplayProps, 'error'>) => (
  <ErrorDisplay
    {...props}
    error={{
      code: ERROR_CODES.GENERATION_FAILED,
      message: 'Generation failed. Please try again with different settings.',
      timestamp: new Date().toISOString(),
      retryable: true,
    }}
  />
);