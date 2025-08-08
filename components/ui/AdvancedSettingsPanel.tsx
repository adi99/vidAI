import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Switch, Divider, useTheme, IconButton } from 'react-native-paper';
import { MotiView, AnimatePresence } from 'moti';
import { ChevronDown, ChevronUp, Settings } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import InteractiveSlider from './InteractiveSlider';
import HapticButton from './HapticButton';

interface SettingItem {
  id: string;
  type: 'slider' | 'switch' | 'button';
  label: string;
  value: number | boolean;
  onValueChange: (value: number | boolean) => void;
  // Slider specific props
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  unit?: string;
  // Switch specific props
  disabled?: boolean;
  // Button specific props
  onPress?: () => void;
  buttonText?: string;
  buttonMode?: 'text' | 'outlined' | 'contained';
}

interface AdvancedSettingsPanelProps {
  title?: string;
  settings: SettingItem[];
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  disabled?: boolean;
  showDividers?: boolean;
}

export default function AdvancedSettingsPanel({
  title = "Advanced Settings",
  settings,
  expanded = false,
  onExpandedChange,
  disabled = false,
  showDividers = true,
}: AdvancedSettingsPanelProps) {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(expanded);

  const handleToggleExpanded = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpandedChange?.(newExpanded);
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isExpanded, onExpandedChange]);

  const renderSettingItem = useCallback((setting: SettingItem, index: number) => {
    const isLast = index === settings.length - 1;

    return (
      <MotiView
        key={setting.id}
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        exit={{ opacity: 0, translateY: -20 }}
        transition={{
          type: 'spring',
          damping: 20,
          stiffness: 300,
          delay: index * 50,
        }}
        style={styles.settingItem}
      >
        {setting.type === 'slider' && (
          <InteractiveSlider
            label={setting.label}
            value={setting.value as number}
            onValueChange={setting.onValueChange as (value: number) => void}
            minimumValue={setting.minimumValue}
            maximumValue={setting.maximumValue}
            step={setting.step}
            unit={setting.unit}
            disabled={disabled || setting.disabled}
          />
        )}

        {setting.type === 'switch' && (
          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { color: theme.colors.onSurface }]}>
              {setting.label}
            </Text>
            <MotiView
              animate={{
                scale: setting.value ? 1.1 : 1,
              }}
              transition={{
                type: 'spring',
                damping: 15,
                stiffness: 300,
              }}
            >
              <Switch
                value={setting.value as boolean}
                onValueChange={(value) => {
                  setting.onValueChange(value);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                disabled={disabled || setting.disabled}
                thumbColor={setting.value ? theme.colors.primary : theme.colors.outline}
                trackColor={{
                  false: theme.colors.surfaceVariant,
                  true: theme.colors.primary + '40',
                }}
              />
            </MotiView>
          </View>
        )}

        {setting.type === 'button' && (
          <HapticButton
            mode={setting.buttonMode || 'outlined'}
            onPress={setting.onPress || (() => {})}
            disabled={disabled || setting.disabled}
            style={styles.settingButton}
          >
            {setting.buttonText || setting.label}
          </HapticButton>
        )}

        {showDividers && !isLast && (
          <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
        )}
      </MotiView>
    );
  }, [settings, disabled, theme, showDividers]);

  return (
    <MotiView
      animate={{
        opacity: disabled ? 0.6 : 1,
      }}
      transition={{
        type: 'timing',
        duration: 200,
      }}
      style={styles.container}
    >
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
        {/* Header */}
        <MotiView
          animate={{
            backgroundColor: isExpanded ? theme.colors.primary + '10' : 'transparent',
          }}
          transition={{
            type: 'timing',
            duration: 200,
          }}
          style={styles.header}
        >
          <HapticButton
            mode="text"
            onPress={handleToggleExpanded}
            disabled={disabled}
            style={styles.headerButton}
            contentStyle={styles.headerButtonContent}
            hapticType="light"
            animatePress={false}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <MotiView
                  animate={{
                    rotate: isExpanded ? '0deg' : '0deg',
                    scale: isExpanded ? 1.1 : 1,
                  }}
                  transition={{
                    type: 'spring',
                    damping: 15,
                    stiffness: 300,
                  }}
                >
                  <Settings size={20} color={theme.colors.primary} />
                </MotiView>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                  {title}
                </Text>
              </View>
              
              <MotiView
                animate={{
                  rotate: isExpanded ? '180deg' : '0deg',
                }}
                transition={{
                  type: 'spring',
                  damping: 15,
                  stiffness: 300,
                }}
              >
                <ChevronDown size={20} color={theme.colors.onSurface} />
              </MotiView>
            </View>
          </HapticButton>
        </MotiView>

        {/* Content */}
        <AnimatePresence>
          {isExpanded && (
            <MotiView
              from={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                type: 'spring',
                damping: 20,
                stiffness: 300,
              }}
              style={styles.content}
            >
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {settings.map(renderSettingItem)}
              </ScrollView>
            </MotiView>
          )}
        </AnimatePresence>
      </Card>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  headerButton: {
    borderRadius: 0,
    margin: 0,
  },
  headerButtonContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  content: {
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 16,
  },
  settingItem: {
    marginVertical: 4,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  settingButton: {
    marginVertical: 8,
  },
  divider: {
    marginVertical: 8,
    height: 1,
  },
});