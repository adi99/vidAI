import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, RefreshCw } from 'lucide-react-native';
import CreditPurchaseInterface from './CreditPurchaseInterface';
import { useIAP } from '@/hooks/useIAP';

interface CreditPurchaseScreenProps {
  onBack?: () => void;
  onPurchaseComplete?: (credits: number) => void;
}

export default function CreditPurchaseScreen({
  onBack,
  onPurchaseComplete,
}: CreditPurchaseScreenProps) {
  const { restorePurchases, loading } = useIAP();

  const handleRestorePurchases = async () => {
    const result = await restorePurchases();
    
    if (result.success) {
      if (result.restoredCount > 0) {
        // Show success message - this will be handled by the hook
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Purchase Credits</Text>
            <Text style={styles.headerSubtitle}>
              Power your AI creations with credits
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <CreditPurchaseInterface
          onPurchaseComplete={onPurchaseComplete}
          showCurrentBalance={true}
          compactMode={false}
        />

        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestorePurchases}
          disabled={loading}
        >
          <RefreshCw size={16} color="#8B5CF6" />
          <Text style={styles.restoreButtonText}>Restore Purchases</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Secure payments powered by Apple/Google Pay
          </Text>
          <Text style={styles.footerSubtext}>
            Credits never expire and are tied to your account
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E5E7EB',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginBottom: 24,
    gap: 8,
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
});