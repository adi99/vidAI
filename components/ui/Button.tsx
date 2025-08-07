import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  icon,
  style,
}: ButtonProps) {
  const getColors = (): [string, string] | readonly [string, string, ...string[]] => {
    if (disabled) return ['#6B7280', '#4B5563'];
    switch (variant) {
      case 'primary':
        return ['#8B5CF6', '#EC4899'];
      case 'secondary':
        return ['#374151', '#1F2937'];
      case 'outline':
        return ['transparent', 'transparent'];
      default:
        return ['#8B5CF6', '#EC4899'];
    }
  };

  const getTextColor = () => {
    if (disabled) return '#9CA3AF';
    return variant === 'outline' ? '#8B5CF6' : '#FFFFFF';
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 8, paddingHorizontal: 16 };
      case 'large':
        return { paddingVertical: 16, paddingHorizontal: 24 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 20 };
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'outline' && styles.outlineButton,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <LinearGradient
        colors={getColors() as readonly [string, string, ...string[]]}
        style={[styles.gradient, getSizeStyles()]}
      >
        {icon && <>{icon}</>}
        <Text style={[styles.text, { color: getTextColor() }]}>
          {title}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  outlineButton: {
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  gradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});