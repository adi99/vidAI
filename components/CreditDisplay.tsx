import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap, Plus } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import CreditPurchaseModal from './CreditPurchaseModal';

interface CreditDisplayProps {
  size?: 'small' | 'medium' | 'large';
  showAddButton?: boolean;
  onAddCredits?: () => void;
  style?: any;
}

export default function CreditDisplay({ 
  size = 'medium', 
  showAddButton = false, 
  onAddCredits,
  style 
}: CreditDisplayProps) {
  const { credits, formatCredits } = useAuth();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const getStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: styles.smallContainer,
          text: styles.smallText,
          icon: 12,
        };
      case 'large':
        return {
          container: styles.largeContainer,
          text: styles.largeText,
          icon: 20,
        };
      default:
        return {
          container: styles.mediumContainer,
          text: styles.mediumText,
          icon: 16,
        };
    }
  };

  const componentStyles = getStyles();

  const getCreditColor = () => {
    if (credits <= 10) return '#EF4444'; // Red for low credits
    if (credits <= 50) return '#F59E0B'; // Orange for medium credits
    return '#10B981'; // Green for good credits
  };

  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.creditContainer, componentStyles.container]}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.1)']}
          style={styles.gradient}
        >
          <Zap size={componentStyles.icon} color="#FCD34D" />
          <Text style={[styles.creditText, componentStyles.text]}>
            {formatCredits(credits)}
          </Text>
          <Text style={[styles.creditLabel, componentStyles.text]}>
            credits
          </Text>
        </LinearGradient>
      </View>
      
      {showAddButton && (
        <TouchableOpacity 
          style={[styles.addButton, size === 'small' && styles.smallAddButton]}
          onPress={() => {
            if (onAddCredits) {
              onAddCredits();
            } else {
              setShowPurchaseModal(true);
            }
          }}
        >
          <LinearGradient
            colors={['#8B5CF6', '#3B82F6']}
            style={styles.addButtonGradient}
          >
            <Plus size={size === 'small' ? 12 : 16} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}
      
      <CreditPurchaseModal
        visible={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        onPurchaseComplete={(credits) => {
          console.log(`Successfully purchased ${credits} credits`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creditContainer: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  creditText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  creditLabel: {
    fontWeight: '500',
    color: '#E5E7EB',
    opacity: 0.8,
  },
  smallContainer: {
    borderRadius: 16,
  },
  smallText: {
    fontSize: 12,
  },
  mediumContainer: {
    borderRadius: 20,
  },
  mediumText: {
    fontSize: 14,
  },
  largeContainer: {
    borderRadius: 24,
  },
  largeText: {
    fontSize: 16,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  smallAddButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  addButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});