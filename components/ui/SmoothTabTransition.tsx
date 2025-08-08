import React, { ReactNode } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useTheme } from 'react-native-paper';

const { width } = Dimensions.get('window');

interface SmoothTabTransitionProps {
  activeTab: string;
  tabs: {
    key: string;
    content: ReactNode;
  }[];
  direction?: 'horizontal' | 'vertical';
  duration?: number;
  staggerDelay?: number;
}

export default function SmoothTabTransition({
  activeTab,
  tabs,
  direction = 'horizontal',
  duration = 300,
  staggerDelay = 50,
}: SmoothTabTransitionProps) {
  const theme = useTheme();

  const getTransitionConfig = (isActive: boolean) => {
    const slideDistance = direction === 'horizontal' ? width * 0.3 : 100;
    
    if (direction === 'horizontal') {
      return {
        from: { 
          opacity: 0, 
          translateX: isActive ? slideDistance : -slideDistance,
          scale: 0.95,
        },
        animate: { 
          opacity: 1, 
          translateX: 0,
          scale: 1,
        },
        exit: { 
          opacity: 0, 
          translateX: isActive ? -slideDistance : slideDistance,
          scale: 0.95,
        },
      };
    } else {
      return {
        from: { 
          opacity: 0, 
          translateY: slideDistance,
          scale: 0.95,
        },
        animate: { 
          opacity: 1, 
          translateY: 0,
          scale: 1,
        },
        exit: { 
          opacity: 0, 
          translateY: -slideDistance,
          scale: 0.95,
        },
      };
    }
  };

  const activeTabData = tabs.find(tab => tab.key === activeTab);

  return (
    <View style={styles.container}>
      <AnimatePresence exitBeforeEnter>
        {activeTabData && (
          <MotiView
            key={activeTab}
            {...getTransitionConfig(true)}
            transition={{
              type: 'spring',
              damping: 20,
              stiffness: 300,
            }}
            style={styles.tabContent}
          >
            {activeTabData.content}
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  tabContent: {
    flex: 1,
    width: '100%',
  },
});