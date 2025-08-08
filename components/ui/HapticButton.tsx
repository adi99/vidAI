import React, { useState, useCallback } from 'react';
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Button, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';

interface HapticButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  mode?: 'text' | 'outlined' | 'contained' | 'elevated' | 'contained-tonal';
  disabled?: boolean;
  loading?: boolean;
  icon?: string | ((props: { size: number; color: string }) => React.ReactNode);
  style?: ViewStyle;
  labelStyle?: TextStyle;
  contentStyle?: ViewStyle;
  buttonColor?: string;
  textColor?: string;
  rippleColor?: string;
  compact?: boolean;
  uppercase?: boolean;
  hapticType?: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';
  animatePress?: boolean;
  animateHover?: boolean;
  testID?: string;
}

export default function HapticButton({
  children,
  onPress,
  mode = 'contained',
  disabled = false,
  loading = false,
  icon,
  style,
  labelStyle,
  contentStyle,
  buttonColor,
  textColor,
  rippleColor,
  compact = false,
  uppercase = false,
  hapticType = 'light',
  animatePress = true,
  animateHover = true,
  testID,
}: HapticButtonProps) {
  const theme = useTheme();
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const getHapticFeedback = useCallback(() => {
    switch (hapticType) {
      case 'light':
        return Haptics.ImpactFeedbackStyle.Light;
      case 'medium':
        return Haptics.ImpactFeedbackStyle.Medium;
      case 'heavy':
        return Haptics.ImpactFeedbackStyle.Heavy;
      case 'selection':
        return Haptics.selectionAsync();
      case 'success':
        return Haptics.NotificationFeedbackType.Success;
      case 'warning':
        return Haptics.NotificationFeedbackType.Warning;
      case 'error':
        return Haptics.NotificationFeedbackType.Error;
      default:
        return Haptics.ImpactFeedbackStyle.Light;
    }
  }, [hapticType]);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;

    // Provide haptic feedback
    if (hapticType === 'selection') {
      Haptics.selectionAsync();
    } else if (['success', 'warning', 'error'].includes(hapticType)) {
      Haptics.notificationAsync(getHapticFeedback() as Haptics.NotificationFeedbackType);
    } else {
      Haptics.impactAsync(getHapticFeedback() as Haptics.ImpactFeedbackStyle);
    }

    onPress();
  }, [disabled, loading, hapticType, getHapticFeedback, onPress]);

  const handlePressIn = useCallback(() => {
    if (disabled || loading) return;
    setIsPressed(true);
  }, [disabled, loading]);

  const handlePressOut = useCallback(() => {
    setIsPressed(false);
  }, []);

  const handleHoverIn = useCallback(() => {
    if (disabled || loading) return;
    setIsHovered(true);
  }, [disabled, loading]);

  const handleHoverOut = useCallback(() => {
    setIsHovered(false);
  }, []);

  return (
    <MotiView
      animate={{
        scale: animatePress && isPressed ? 0.95 : animateHover && isHovered ? 1.02 : 1,
        opacity: disabled ? 0.6 : 1,
      }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 300,
      }}
      style={[styles.container, style]}
    >
      <Button
        mode={mode}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}


        disabled={disabled}
        loading={loading}
        icon={icon}
        buttonColor={buttonColor}
        textColor={textColor}
        rippleColor={rippleColor}
        compact={compact}
        uppercase={uppercase}
        style={[
          styles.button,
          {
            backgroundColor: mode === 'contained' ? (buttonColor || theme.colors.primary) : undefined,
          }
        ]}
        labelStyle={[styles.label, labelStyle]}
        contentStyle={[styles.content, contentStyle]}
        testID={testID}
      >
        {children}
      </Button>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  button: {
    borderRadius: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});