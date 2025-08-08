import React, { ReactNode } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { Pressable } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface AnimatedCardProps {
  children: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  elevation?: number;
  animateOnPress?: boolean;
  hapticFeedback?: boolean;
  gradient?: boolean;
  gradientColors?: string[];
  borderRadius?: number;
  padding?: number;
  margin?: number;
  delay?: number;
  duration?: number;
  scaleOnPress?: number;
  glowOnSelect?: boolean;
}

export default function AnimatedCard({
  children,
  onPress,
  selected = false,
  disabled = false,
  style,
  elevation = 2,
  animateOnPress = true,
  hapticFeedback = true,
  gradient = false,
  gradientColors,
  borderRadius = 12,
  padding = 16,
  margin = 8,
  delay = 0,
  duration = 300,
  scaleOnPress = 0.98,
  glowOnSelect = true,
}: AnimatedCardProps) {
  const theme = useTheme();

  const handlePress = () => {
    if (disabled) return;
    
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    onPress?.();
  };

  const cardContent = (
    <MotiView
      from={{ opacity: 0, scale: 0.9, translateY: 20 }}
      animate={{ 
        opacity: disabled ? 0.6 : 1, 
        scale: 1, 
        translateY: 0 
      }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 300,
        delay,
      }}
      style={[
        styles.container,
        {
          margin,
        },
        style,
      ]}
    >
      {/* Glow effect for selected state */}
      {selected && glowOnSelect && (
        <MotiView
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            type: 'timing',
            duration: 2000,
            loop: true,
          }}
          style={[
            styles.glow,
            {
              borderRadius: borderRadius + 4,
              backgroundColor: theme.colors.primary + '40',
            },
          ]}
        />
      )}

      <Card
        style={[
          styles.card,
          {
            backgroundColor: selected 
              ? theme.colors.primary + '20' 
              : theme.colors.surface,
            borderRadius,
            borderWidth: selected ? 2 : 0,
            borderColor: selected ? theme.colors.primary : 'transparent',
          },
        ]}
        elevation={selected ? Math.min(elevation + 2, 5) as 0 | 1 | 2 | 3 | 4 | 5 : elevation as 0 | 1 | 2 | 3 | 4 | 5}
      >
        {gradient ? (
          <LinearGradient
            colors={(gradientColors || [
              theme.colors.surface,
              theme.colors.surface + 'CC',
            ]) as [string, string, ...string[]]}
            style={[
              styles.gradientContent,
              {
                borderRadius,
                padding,
              },
            ]}
          >
            {children}
          </LinearGradient>
        ) : (
          <MotiView
            style={[
              styles.content,
              {
                padding,
              },
            ]}
          >
            {children}
          </MotiView>
        )}
      </Card>
    </MotiView>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={styles.pressable}
      >
        {({ pressed }) => (
          <MotiView
            animate={{
              scale: pressed && animateOnPress ? scaleOnPress : 1,
            }}
            transition={{
              type: 'spring',
              damping: 15,
              stiffness: 300,
            }}
          >
            {cardContent}
          </MotiView>
        )}
      </Pressable>
    );
  }

  return cardContent;
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  pressable: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    zIndex: -1,
  },
  card: {
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  gradientContent: {
    flex: 1,
  },
});