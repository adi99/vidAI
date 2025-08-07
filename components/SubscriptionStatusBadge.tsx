import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Star, Zap } from 'lucide-react-native';
import { SubscriptionStatus } from '@/types/database';

interface SubscriptionStatusBadgeProps {
  status: SubscriptionStatus;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  daysRemaining?: number;
}

export default function SubscriptionStatusBadge({
  status,
  size = 'medium',
  showLabel = true,
  daysRemaining,
}: SubscriptionStatusBadgeProps) {
  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return {
          container: styles.smallContainer,
          text: styles.smallText,
          iconSize: 12,
        };
      case 'large':
        return {
          container: styles.largeContainer,
          text: styles.largeText,
          iconSize: 20,
        };
      case 'medium':
      default:
        return {
          container: styles.mediumContainer,
          text: styles.mediumText,
          iconSize: 16,
        };
    }
  };

  const { container, text, iconSize } = getSizeConfig();
  
  const getStatusConfig = () => {
    switch (status) {
      case 'premium':
        return {
          icon: <Crown size={iconSize} color="#FFFFFF" />,
          label: 'Premium',
          colors: ['#F59E0B', '#EF4444'] as [string, string],
          textColor: '#FFFFFF',
        };
      case 'basic':
        return {
          icon: <Star size={iconSize} color="#FFFFFF" />,
          label: 'Pro',
          colors: ['#8B5CF6', '#3B82F6'] as [string, string],
          textColor: '#FFFFFF',
        };
      case 'free':
      default:
        return {
          icon: <Zap size={iconSize} color="#6B7280" />,
          label: 'Free',
          colors: ['#374151', '#374151'] as [string, string],
          textColor: '#9CA3AF',
        };
    }
  };

  const { icon, label, colors, textColor } = getStatusConfig();

  const showExpiration = status !== 'free' && daysRemaining !== undefined && daysRemaining <= 7;

  return (
    <LinearGradient
      colors={colors}
      style={[styles.container, container]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
    >
      {icon}
      {showLabel && (
        <Text style={[styles.text, text, { color: textColor }]}>
          {label}
        </Text>
      )}
      {showExpiration && (
        <Text style={[styles.expirationText, text, { color: textColor }]}>
          ({daysRemaining}d)
        </Text>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    gap: 4,
  },
  // Small size
  smallContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  smallText: {
    fontSize: 10,
    fontWeight: '600',
  },
  // Medium size
  mediumContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mediumText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Large size
  largeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  largeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  text: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expirationText: {
    marginLeft: 2,
  },
});