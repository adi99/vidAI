import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, TextInput as RNTextInput, Animated } from 'react-native';
import { TextInput, useTheme, HelperText } from 'react-native-paper';
import { MotiView, MotiText } from 'moti';
import * as Haptics from 'expo-haptics';

interface AnimatedTextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  disabled?: boolean;
  error?: boolean;
  errorText?: string;
  helperText?: string;
  mode?: 'flat' | 'outlined';
  left?: React.ReactNode;
  right?: React.ReactNode;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: string;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  onSubmitEditing?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  testID?: string;
  animateOnFocus?: boolean;
  showCharacterCount?: boolean;
  hapticFeedback?: boolean;
}

export default function AnimatedTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  numberOfLines = 1,
  maxLength,
  disabled = false,
  error = false,
  errorText,
  helperText,
  mode = 'outlined',
  left,
  right,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoComplete,
  returnKeyType = 'done',
  onSubmitEditing,
  onFocus,
  onBlur,
  testID,
  animateOnFocus = true,
  showCharacterCount = false,
  hapticFeedback = true,
}: AnimatedTextInputProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onFocus?.();
  }, [hapticFeedback, onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setIsTyping(false);
    onBlur?.();
  }, [onBlur]);

  const handleChangeText = useCallback((text: string) => {
    if (!isTyping && text.length > 0) {
      setIsTyping(true);
    } else if (isTyping && text.length === 0) {
      setIsTyping(false);
    }

    // Provide haptic feedback for typing
    if (hapticFeedback && text.length > value.length) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    onChangeText(text);
  }, [isTyping, value.length, hapticFeedback, onChangeText]);

  const shakeInput = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    if (hapticFeedback) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [shakeAnimation, hapticFeedback]);

  // Trigger shake animation when error changes to true
  React.useEffect(() => {
    if (error) {
      shakeInput();
    }
  }, [error, shakeInput]);

  const characterCount = value.length;
  const isNearLimit = maxLength && characterCount > maxLength * 0.8;
  const isOverLimit = maxLength && characterCount > maxLength;

  return (
    <MotiView
      animate={{
        scale: animateOnFocus && isFocused ? 1.02 : 1,
        opacity: disabled ? 0.6 : 1,
      }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 300,
      }}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.inputContainer,
          {
            transform: [{ translateX: shakeAnimation }],
          },
        ]}
      >
        <TextInput
          label={label}
          value={value}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          disabled={disabled}
          error={error}
          mode={mode}
          left={left}
          right={right}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete as any}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          testID={testID}
          style={[
            styles.textInput,
            {
              backgroundColor: isFocused ? theme.colors.surface : theme.colors.background,
            }
          ]}
          outlineStyle={[
            styles.outline,
            {
              borderColor: error 
                ? theme.colors.error 
                : isFocused 
                  ? theme.colors.primary 
                  : theme.colors.outline,
              borderWidth: isFocused ? 2 : 1,
            }
          ]}
        />

        {/* Typing indicator */}
        {isTyping && (
          <MotiView
            from={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{
              type: 'spring',
              damping: 15,
              stiffness: 300,
            }}
            style={[
              styles.typingIndicator,
              { backgroundColor: theme.colors.primary }
            ]}
          />
        )}
      </Animated.View>

      {/* Helper text and character count */}
      <View style={styles.bottomContainer}>
        <View style={styles.helperContainer}>
          {error && errorText && (
            <MotiText
              from={{ opacity: 0, translateY: -10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{
                type: 'spring',
                damping: 15,
                stiffness: 300,
              }}
            >
              <HelperText type="error" visible={error}>
                {errorText}
              </HelperText>
            </MotiText>
          )}
          
          {!error && helperText && (
            <HelperText type="info" visible={!error}>
              {helperText}
            </HelperText>
          )}
        </View>

        {showCharacterCount && maxLength && (
          <MotiView
            animate={{
              scale: isNearLimit ? 1.1 : 1,
            }}
            transition={{
              type: 'spring',
              damping: 15,
              stiffness: 300,
            }}
          >
            <MotiText
              style={[
                styles.characterCount,
                {
                  fontWeight: isNearLimit ? '600' : '400',
                  color: isOverLimit 
                    ? theme.colors.error 
                    : isNearLimit 
                      ? theme.colors.onSurfaceVariant 
                      : theme.colors.onSurfaceVariant,
                }
              ]}
            >
              {characterCount}/{maxLength}
            </MotiText>
          </MotiView>
        )}
      </View>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  inputContainer: {
    position: 'relative',
  },
  textInput: {
    fontSize: 16,
  },
  outline: {
    borderRadius: 12,
  },
  typingIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bottomContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  helperContainer: {
    flex: 1,
  },
  characterCount: {
    fontSize: 12,
    marginLeft: 8,
  },
});