import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useTheme } from 'react-native-paper';

interface StateTransitionProps {
  state: string;
  children: ReactNode;
  duration?: number;
  type?: 'fade' | 'slide' | 'scale' | 'flip';
  direction?: 'up' | 'down' | 'left' | 'right';
  staggerDelay?: number;
  exitBeforeEnter?: boolean;
}

export default function StateTransition({
  state,
  children,
  duration = 300,
  type = 'fade',
  direction = 'up',
  staggerDelay = 0,
  exitBeforeEnter = true,
}: StateTransitionProps) {
  const theme = useTheme();

  const getTransitionConfig = () => {
    const baseConfig = {
      type: 'spring' as const,
      damping: 20,
      stiffness: 300,
    };

    switch (type) {
      case 'fade':
        return {
          from: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: baseConfig,
        };

      case 'slide':
        const slideDistance = 50;
        const slideConfig = {
          up: { translateY: slideDistance },
          down: { translateY: -slideDistance },
          left: { translateX: slideDistance },
          right: { translateX: -slideDistance },
        };

        return {
          from: { opacity: 0, ...slideConfig[direction] },
          animate: { opacity: 1, translateY: 0, translateX: 0 },
          exit: { opacity: 0, ...slideConfig[direction] },
          transition: baseConfig,
        };

      case 'scale':
        return {
          from: { opacity: 0, scale: 0.8 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.8 },
          transition: baseConfig,
        };

      case 'flip':
        return {
          from: { opacity: 0, rotateY: '90deg' },
          animate: { opacity: 1, rotateY: '0deg' },
          exit: { opacity: 0, rotateY: '-90deg' },
          transition: baseConfig,
        };

      default:
        return {
          from: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: baseConfig,
        };
    }
  };

  const transitionConfig = getTransitionConfig();

  return (
    <View style={styles.container}>
      <AnimatePresence exitBeforeEnter={exitBeforeEnter}>
        <MotiView
          key={state}
          from={transitionConfig.from}
          animate={transitionConfig.animate}
          exit={transitionConfig.exit}
          transition={{
            ...transitionConfig.transition,
            delay: staggerDelay,
          }}
          style={styles.content}
        >
          {children}
        </MotiView>
      </AnimatePresence>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});