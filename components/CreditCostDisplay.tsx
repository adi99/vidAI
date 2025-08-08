import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Zap, AlertTriangle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

interface CreditCostDisplayProps {
  generationType: 'image' | 'video' | 'training' | 'editing';
  options: {
    quality?: 'basic' | 'standard' | 'high';
    duration?: '3s' | '5s' | '10s' | '15s';
    steps?: 600 | 1200 | 2000;
    editType?: 'basic' | 'advanced';
    quantity?: number;
    model?: string;
  };
  showValidation?: boolean;
  style?: any;
}

export default function CreditCostDisplay({ 
  generationType, 
  options, 
  showValidation = true,
  style 
}: CreditCostDisplayProps) {
  const { credits, getCreditCost, formatCredits } = useAuth();
  
  const cost = getCreditCost(generationType, options);
  const hasEnoughCredits = credits >= cost;
  const remaining = credits - cost;

  const getGenerationLabel = () => {
    switch (generationType) {
      case 'image':
        return `Image Generation (${options.quality || 'standard'})`;
      case 'video':
        return `Video Generation (${options.duration || '5s'}, ${options.quality || 'standard'})`;
      case 'training':
        return `Model Training (${options.steps || 1200} steps)`;
      case 'editing':
        return `Image Editing (${options.editType || 'basic'})`;
      default:
        return 'Generation';
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.costRow}>
        <Text style={styles.label}>{getGenerationLabel()}</Text>
        <View style={styles.costContainer}>
          <Zap size={14} color="#FCD34D" />
          <Text style={styles.costText}>{formatCredits(cost)}</Text>
        </View>
      </View>

      {showValidation && (
        <View style={styles.validationRow}>
          {hasEnoughCredits ? (
            <View style={styles.validContainer}>
              <Text style={styles.validText}>
                {remaining} credits remaining after generation
              </Text>
            </View>
          ) : (
            <View style={styles.invalidContainer}>
              <AlertTriangle size={14} color="#EF4444" />
              <Text style={styles.invalidText}>
                Insufficient credits. Need {formatCredits(cost - credits)} more.
              </Text>
            </View>
          )}
        </View>
      )}

      {options.quantity && options.quantity > 1 && (
        <View style={styles.quantityRow}>
          <Text style={styles.quantityText}>
            {formatCredits(cost / options.quantity)} credits × {options.quantity} = {formatCredits(cost)} total
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  costContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  costText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FCD34D',
  },
  validationRow: {
    marginTop: 4,
  },
  validContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  validText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  invalidContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  invalidText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
    flex: 1,
  },
  quantityRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  quantityText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});