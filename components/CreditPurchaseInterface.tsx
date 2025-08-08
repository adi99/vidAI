import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap, Star, Check, ShoppingCart, AlertCircle } from 'lucide-react-native';
import { CreditPackage } from '@/services/iapService';
import { useIAP } from '@/hooks/useIAP';
import { useAuth } from '@/contexts/AuthContext';

interface CreditPurchaseInterfaceProps {
  onPurchaseComplete?: (credits: number) => void;
  showCurrentBalance?: boolean;
  compactMode?: boolean;
}

export default function CreditPurchaseInterface({
  onPurchaseComplete,
  showCurrentBalance = true,
  compactMode = false,
}: CreditPurchaseInterfaceProps) {
  const { credits } = useAuth();
  const {
    packages,
    loading,
    purchasing,
    canMakePayments,
    purchaseCredits,
    formatCredits,
  } = useIAP();

  const handlePurchase = async (packageId: string) => {
    if (!canMakePayments) {
      Alert.alert('Payment Not Available', 'In-app purchases are not available on this device.');
      return;
    }

    const result = await purchaseCredits(packageId);

    if (result.success) {
      Alert.alert(
        'Purchase Successful!',
        `You've received ${result.credits} credits!`,
        [
          {
            text: 'OK',
            onPress: () => {
              onPurchaseComplete?.(result.credits || 0);
            },
          },
        ]
      );
    } else {
      Alert.alert('Purchase Failed', result.error || 'Unknown error occurred');
    }
  };

  const PackageCard = ({ pkg }: { pkg: CreditPackage }) => {
    const isPurchasing = purchasing === pkg.id;
    const totalCredits = pkg.credits + (pkg.bonus || 0);

    if (compactMode) {
      return (
        <TouchableOpacity
          style={[styles.compactCard, pkg.popular && styles.compactPopularCard]}
          onPress={() => handlePurchase(pkg.id)}
          disabled={isPurchasing || !canMakePayments}
        >
          <LinearGradient
            colors={pkg.popular ? ['#8B5CF6', '#3B82F6'] : ['#1E293B', '#334155']}
            style={styles.compactGradient}
          >
            {pkg.popular && (
              <View style={styles.compactPopularBadge}>
                <Star size={10} color="#FFFFFF" />
              </View>
            )}
            
            <View style={styles.compactContent}>
              <View style={styles.compactCredits}>
                <Zap size={14} color="#FCD34D" />
                <Text style={styles.compactCreditsText}>{formatCredits(totalCredits)}</Text>
              </View>
              <Text style={styles.compactPrice}>{pkg.price}</Text>
            </View>

            {isPurchasing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ShoppingCart size={16} color="#FFFFFF" />
            )}
          </LinearGradient>
        </TouchableOpacity>
      );
    }

    return (
      <View style={[styles.packageCard, pkg.popular && styles.popularCard]}>
        {pkg.popular && (
          <View style={styles.popularBadge}>
            <Star size={12} color="#FFFFFF" />
            <Text style={styles.popularText}>MOST POPULAR</Text>
          </View>
        )}
        
        <View style={styles.packageHeader}>
          <Text style={styles.packageTitle}>{pkg.title}</Text>
          <Text style={styles.packageDescription}>{pkg.description}</Text>
        </View>

        <View style={styles.creditsContainer}>
          <View style={styles.mainCredits}>
            <Zap size={20} color="#FCD34D" />
            <Text style={styles.creditsAmount}>{formatCredits(pkg.credits)}</Text>
            <Text style={styles.creditsLabel}>credits</Text>
          </View>
          
          {pkg.bonus && (
            <View style={styles.bonusCredits}>
              <Text style={styles.bonusText}>+{formatCredits(pkg.bonus)} bonus!</Text>
            </View>
          )}
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.price}>{pkg.price}</Text>
          <Text style={styles.pricePerCredit}>
            ${(pkg.priceUsd / totalCredits).toFixed(3)} per credit
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.purchaseButton, isPurchasing && styles.purchasingButton]}
          onPress={() => handlePurchase(pkg.id)}
          disabled={isPurchasing || !canMakePayments}
        >
          <LinearGradient
            colors={pkg.popular ? ['#8B5CF6', '#3B82F6'] : ['#6B7280', '#4B5563']}
            style={styles.purchaseGradient}
          >
            {isPurchasing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.purchaseButtonText}>Purchase</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading packages...</Text>
      </View>
    );
  }

  if (!canMakePayments) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={24} color="#F59E0B" />
        <Text style={styles.errorTitle}>Purchases Not Available</Text>
        <Text style={styles.errorText}>
          In-app purchases are not available on this device
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showCurrentBalance && (
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <View style={styles.balanceDisplay}>
            <Zap size={16} color="#FCD34D" />
            <Text style={styles.balanceAmount}>{formatCredits(credits)}</Text>
            <Text style={styles.balanceText}>credits</Text>
          </View>
        </View>
      )}

      <ScrollView
        horizontal={compactMode}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={compactMode ? styles.compactContainer : styles.packagesContainer}
      >
        {packages.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} />
        ))}
      </ScrollView>

      {!compactMode && (
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>What you get with credits:</Text>
          <View style={styles.featuresList}>
            <View style={styles.feature}>
              <Check size={16} color="#10B981" />
              <Text style={styles.featureText}>Generate AI videos and images</Text>
            </View>
            <View style={styles.feature}>
              <Check size={16} color="#10B981" />
              <Text style={styles.featureText}>Train personalized AI models</Text>
            </View>
            <View style={styles.feature}>
              <Check size={16} color="#10B981" />
              <Text style={styles.featureText}>Access premium AI models</Text>
            </View>
            <View style={styles.feature}>
              <Check size={16} color="#10B981" />
              <Text style={styles.featureText}>Higher quality generations</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F59E0B',
  },
  errorText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  balanceContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  balanceDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  balanceText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
  packagesContainer: {
    gap: 16,
    marginBottom: 32,
  },
  compactContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  packageCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  popularCard: {
    borderColor: '#8B5CF6',
    backgroundColor: '#312E81',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: 20,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  packageHeader: {
    marginBottom: 16,
  },
  packageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  packageDescription: {
    fontSize: 14,
    color: '#94A3B8',
  },
  creditsContainer: {
    marginBottom: 16,
  },
  mainCredits: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  creditsAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  creditsLabel: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
  bonusCredits: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  bonusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  priceContainer: {
    marginBottom: 20,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  pricePerCredit: {
    fontSize: 12,
    color: '#94A3B8',
  },
  purchaseButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  purchasingButton: {
    opacity: 0.7,
  },
  purchaseGradient: {
    padding: 16,
    alignItems: 'center',
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  compactCard: {
    width: 120,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  compactPopularCard: {
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  compactGradient: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
    minHeight: 100,
  },
  compactPopularBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactContent: {
    alignItems: 'center',
    gap: 4,
  },
  compactCredits: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactCreditsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  compactPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  featuresContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  featuresList: {
    gap: 12,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#E5E7EB',
    flex: 1,
  },
});