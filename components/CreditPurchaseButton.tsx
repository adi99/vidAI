import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, ShoppingCart } from 'lucide-react-native';
import CreditPurchaseModal from './CreditPurchaseModal';

interface CreditPurchaseButtonProps {
  variant?: 'primary' | 'secondary' | 'compact';
  text?: string;
  onPurchaseComplete?: (credits: number) => void;
  disabled?: boolean;
  style?: any;
}

export default function CreditPurchaseButton({
  variant = 'primary',
  text,
  onPurchaseComplete,
  disabled = false,
  style,
}: CreditPurchaseButtonProps) {
  const [showModal, setShowModal] = useState(false);

  const getButtonText = () => {
    if (text) return text;
    switch (variant) {
      case 'compact':
        return '';
      case 'secondary':
        return 'Buy Credits';
      default:
        return 'Add Credits';
    }
  };

  const getButtonStyle = () => {
    switch (variant) {
      case 'compact':
        return styles.compactButton;
      case 'secondary':
        return styles.secondaryButton;
      default:
        return styles.primaryButton;
    }
  };

  const getGradientColors = (): [string, string, ...string[]] => {
    switch (variant) {
      case 'secondary':
        return ['#6B7280', '#4B5563'];
      default:
        return ['#8B5CF6', '#3B82F6'];
    }
  };

  const getIconSize = () => {
    return variant === 'compact' ? 16 : 18;
  };

  const renderIcon = () => {
    if (variant === 'compact') {
      return <Plus size={getIconSize()} color="#FFFFFF" />;
    }
    return <ShoppingCart size={getIconSize()} color="#FFFFFF" />;
  };

  return (
    <>
      <TouchableOpacity
        style={[getButtonStyle(), disabled && styles.disabled, style]}
        onPress={() => setShowModal(true)}
        disabled={disabled}
      >
        <LinearGradient
          colors={getGradientColors()}
          style={styles.gradient}
        >
          {renderIcon()}
          {getButtonText() && (
            <Text style={styles.buttonText}>{getButtonText()}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <CreditPurchaseModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onPurchaseComplete={(credits) => {
          onPurchaseComplete?.(credits);
          setShowModal(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  secondaryButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  compactButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});