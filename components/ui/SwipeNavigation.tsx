import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useTheme } from 'react-native-paper';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface SwipeNavigationProps {
  children: React.ReactNode[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  showIndicators?: boolean;
  showArrows?: boolean;
  enableSwipe?: boolean;
  swipeThreshold?: number;
  animationDuration?: number;
  style?: any;
}

const { width: screenWidth } = Dimensions.get('window');

export default function SwipeNavigation({
  children,
  initialIndex = 0,
  onIndexChange,
  showIndicators = true,
  showArrows = false,
  enableSwipe = true,
  swipeThreshold = 50,
  animationDuration = 300,
  style,
}: SwipeNavigationProps) {
  const theme = useTheme();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const handleIndexChange = useCallback((newIndex: number) => {
    if (newIndex >= 0 && newIndex < children.length) {
      setCurrentIndex(newIndex);
      onIndexChange?.(newIndex);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [children.length, onIndexChange]);

  const goToNext = useCallback(() => {
    if (currentIndex < children.length - 1) {
      handleIndexChange(currentIndex + 1);
    }
  }, [currentIndex, children.length, handleIndexChange]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      handleIndexChange(currentIndex - 1);
    }
  }, [currentIndex, handleIndexChange]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => enableSwipe,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return enableSwipe && Math.abs(gestureState.dx) > 10;
    },
    
    onPanResponderGrant: () => {
      setIsDragging(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    
    onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      if (!enableSwipe) return;
      
      // Limit drag offset to prevent over-scrolling
      const maxOffset = screenWidth * 0.3;
      const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, gestureState.dx));
      setDragOffset(clampedOffset);
      
      // Provide haptic feedback at threshold
      if (Math.abs(gestureState.dx) > swipeThreshold && Math.abs(gestureState.dx) < swipeThreshold + 10) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    },
    
    onPanResponderRelease: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      setIsDragging(false);
      setDragOffset(0);
      
      if (!enableSwipe) return;
      
      // Determine if swipe was significant enough to change index
      if (Math.abs(gestureState.dx) > swipeThreshold) {
        if (gestureState.dx > 0) {
          // Swipe right - go to previous
          goToPrevious();
        } else {
          // Swipe left - go to next
          goToNext();
        }
      }
    },
  });

  const translateX = isDragging ? dragOffset : 0;

  return (
    <View style={[styles.container, style]} {...panResponder.panHandlers}>
      <View style={styles.contentContainer}>
        <AnimatePresence exitBeforeEnter>
          <MotiView
            key={currentIndex}
            from={{ 
              opacity: 0, 
              translateX: dragOffset > 0 ? -screenWidth * 0.3 : screenWidth * 0.3 
            }}
            animate={{ 
              opacity: 1, 
              translateX: translateX 
            }}
            exit={{ 
              opacity: 0, 
              translateX: dragOffset > 0 ? screenWidth * 0.3 : -screenWidth * 0.3 
            }}
            transition={{
              type: 'spring',
              damping: 20,
              stiffness: 300,
            }}
            style={styles.contentItem}
          >
            {children[currentIndex]}
          </MotiView>
        </AnimatePresence>
      </View>

      {/* Navigation arrows */}
      {showArrows && (
        <>
          {currentIndex > 0 && (
            <MotiView
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                type: 'spring',
                damping: 15,
                stiffness: 300,
              }}
              style={[styles.arrowLeft, { backgroundColor: theme.colors.surface + 'CC' }]}
            >
              <ChevronLeft 
                size={24} 
                color={theme.colors.onSurface} 
                onPress={goToPrevious}
              />
            </MotiView>
          )}
          
          {currentIndex < children.length - 1 && (
            <MotiView
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                type: 'spring',
                damping: 15,
                stiffness: 300,
              }}
              style={[styles.arrowRight, { backgroundColor: theme.colors.surface + 'CC' }]}
            >
              <ChevronRight 
                size={24} 
                color={theme.colors.onSurface} 
                onPress={goToNext}
              />
            </MotiView>
          )}
        </>
      )}

      {/* Page indicators */}
      {showIndicators && children.length > 1 && (
        <View style={styles.indicatorsContainer}>
          {children.map((_, index) => (
            <MotiView
              key={index}
              animate={{
                scale: index === currentIndex ? 1.2 : 1,
                opacity: index === currentIndex ? 1 : 0.5,
                backgroundColor: index === currentIndex ? theme.colors.primary : theme.colors.outline,
              }}
              transition={{
                type: 'spring',
                damping: 15,
                stiffness: 300,
              }}
              style={styles.indicator}
              onTouchEnd={() => handleIndexChange(index)}
            />
          ))}
        </View>
      )}

      {/* Swipe hint overlay */}
      {isDragging && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          exit={{ opacity: 0 }}
          transition={{
            type: 'timing',
            duration: 150,
          }}
          style={[styles.swipeHint, { backgroundColor: theme.colors.surface + '40' }]}
        >
          <MotiView
            animate={{
              translateX: dragOffset * 0.5,
              scale: Math.abs(dragOffset) > swipeThreshold ? 1.2 : 1,
            }}
            transition={{
              type: 'spring',
              damping: 15,
              stiffness: 300,
            }}
          >
            {dragOffset > 0 ? (
              <ChevronLeft size={32} color={theme.colors.primary} />
            ) : (
              <ChevronRight size={32} color={theme.colors.primary} />
            )}
          </MotiView>
        </MotiView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  contentContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  contentItem: {
    flex: 1,
    width: '100%',
  },
  arrowLeft: {
    position: 'absolute',
    left: 16,
    top: '50%',
    transform: [{ translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  arrowRight: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  indicatorsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  swipeHint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
});