import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { MotiView } from 'moti';
import { useTheme, Surface } from 'react-native-paper';
import * as Haptics from 'expo-haptics';

// Web-compatible slider implementation
const WebSlider = ({ style, value, onValueChange, onSlidingStart, onSlidingComplete, minimumValue, maximumValue, step, disabled, minimumTrackTintColor, maximumTrackTintColor }: any) => {
  return (
    <input
      type="range"
      style={{
        width: '100%',
        height: '40px',
        background: `linear-gradient(to right, ${minimumTrackTintColor} 0%, ${minimumTrackTintColor} ${((value - minimumValue) / (maximumValue - minimumValue)) * 100}%, ${maximumTrackTintColor} ${((value - minimumValue) / (maximumValue - minimumValue)) * 100}%, ${maximumTrackTintColor} 100%)`,
        outline: 'none',
        borderRadius: '5px',
        appearance: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
      min={minimumValue}
      max={maximumValue}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange?.(parseFloat(e.target.value))}
      onMouseDown={() => onSlidingStart?.()}
      onMouseUp={() => onSlidingComplete?.(value)}
      onTouchStart={() => onSlidingStart?.()}
      onTouchEnd={() => onSlidingComplete?.(value)}
    />
  );
};

// Native slider - we'll use a simple View-based implementation to avoid the findDOMNode issue
const NativeSlider = ({ style, value, onValueChange, onSlidingStart, onSlidingComplete, minimumValue, maximumValue, step, disabled, minimumTrackTintColor, maximumTrackTintColor }: any) => {
  const [isDragging, setIsDragging] = useState(false);
  
  const handlePanGesture = useCallback((evt: any) => {
    if (disabled) return;
    
    const { locationX } = evt.nativeEvent;
    const sliderWidth = 300; // Approximate width
    const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
    const newValue = minimumValue + (percentage * (maximumValue - minimumValue));
    const steppedValue = Math.round(newValue / step) * step;
    
    onValueChange?.(steppedValue);
  }, [disabled, minimumValue, maximumValue, step, onValueChange]);

  return (
    <View
      style={[
        {
          height: 40,
          justifyContent: 'center',
          paddingHorizontal: 10,
        },
        style
      ]}
      onStartShouldSetResponder={() => !disabled}
      onResponderGrant={() => {
        setIsDragging(true);
        onSlidingStart?.();
      }}
      onResponderMove={handlePanGesture}
      onResponderRelease={() => {
        setIsDragging(false);
        onSlidingComplete?.(value);
      }}
    >
      <View
        style={{
          height: 6,
          backgroundColor: maximumTrackTintColor,
          borderRadius: 3,
          position: 'relative',
        }}
      >
        <View
          style={{
            height: 6,
            backgroundColor: minimumTrackTintColor,
            borderRadius: 3,
            width: `${((value - minimumValue) / (maximumValue - minimumValue)) * 100}%`,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: `${((value - minimumValue) / (maximumValue - minimumValue)) * 100}%`,
            top: -9,
            width: 24,
            height: 24,
            backgroundColor: minimumTrackTintColor,
            borderRadius: 12,
            marginLeft: -12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        />
      </View>
    </View>
  );
};

const Slider = Platform.OS === 'web' ? WebSlider : NativeSlider;

interface InteractiveSliderProps {
    label: string;
    value: number;
    onValueChange: (value: number) => void;
    minimumValue?: number;
    maximumValue?: number;
    step?: number;
    unit?: string;
    showValue?: boolean;
    disabled?: boolean;
    thumbColor?: string;
    trackColor?: {
        true: string;
        false: string;
    };
}



export default function InteractiveSlider({
    label,
    value,
    onValueChange,
    minimumValue = 0,
    maximumValue = 100,
    step = 1,
    unit = '',
    showValue = true,
    disabled = false,
    thumbColor,
    trackColor,
}: InteractiveSliderProps) {
    const theme = useTheme();
    const [isActive, setIsActive] = useState(false);
    const [localValue, setLocalValue] = useState(value);

    const handleValueChange = useCallback((newValue: number) => {
        setLocalValue(newValue);
        // Provide haptic feedback for significant changes
        if (Math.abs(newValue - value) >= step) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, [value, step]);

    const handleSlidingComplete = useCallback((newValue: number) => {
        onValueChange(newValue);
        setIsActive(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, [onValueChange]);

    const handleSlidingStart = useCallback(() => {
        setIsActive(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const displayValue = isActive ? localValue : value;

    return (
        <MotiView
            animate={{
                scale: isActive ? 1.02 : 1,
                opacity: disabled ? 0.6 : 1,
            }}
            transition={{
                type: 'spring',
                damping: 20,
                stiffness: 300,
            }}
            style={styles.container}
        >
            <Surface style={[styles.surface, { backgroundColor: theme.colors.surface }]} elevation={isActive ? 2 : 1}>
                <View style={styles.header}>
                    <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                        {label}
                    </Text>
                    {showValue && (
                        <MotiView
                            animate={{
                                scale: isActive ? 1.1 : 1,
                            }}
                            transition={{
                                type: 'spring',
                                damping: 15,
                                stiffness: 400,
                            }}
                        >
                            <Text style={[styles.value, { color: theme.colors.primary }]}>
                                {Math.round(displayValue)}{unit}
                            </Text>
                        </MotiView>
                    )}
                </View>

                <View style={styles.sliderContainer}>
                    <Slider
                        style={styles.slider}
                        value={value}
                        onValueChange={handleValueChange}
                        onSlidingStart={handleSlidingStart}
                        onSlidingComplete={handleSlidingComplete}
                        minimumValue={minimumValue}
                        maximumValue={maximumValue}
                        step={step}
                        disabled={disabled}


                        minimumTrackTintColor={trackColor?.true || theme.colors.primary}
                        maximumTrackTintColor={trackColor?.false || theme.colors.outline}
                        thumbColor={thumbColor || theme.colors.primary}
                    />
                </View>

                {/* Progress indicator */}
                <MotiView
                    animate={{
                        width: `${((displayValue - minimumValue) / (maximumValue - minimumValue)) * 100}%`,
                        opacity: isActive ? 0.8 : 0.6,
                    }}
                    transition={{
                        type: 'timing',
                        duration: 150,
                    }}
                    style={[
                        styles.progressIndicator,
                        { backgroundColor: theme.colors.primary }
                    ]}
                />
            </Surface>
        </MotiView>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    surface: {
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
    },
    value: {
        fontSize: 16,
        fontWeight: '700',
    },
    sliderContainer: {
        position: 'relative',
    },
    slider: {
        width: '100%',
        height: 40,
    },
    thumb: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    track: {
        height: 6,
        borderRadius: 3,
    },
    progressIndicator: {
        position: 'absolute',
        bottom: 8,
        left: 16,
        height: 2,
        borderRadius: 1,
    },
});