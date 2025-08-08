import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Gift, CreditCard, Star, Zap } from 'lucide-react-native';
import { useIAP } from '@/hooks/useIAP';
import { useAuth } from '@/contexts/AuthContext';

interface CreditPurchaseModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseComplete?: (credits: number) => void;
}

export default function CreditPurchaseModal({ visible, onClose, onPurchaseComplete }: CreditPurchaseModalProps) {
  const { credits } = useAuth();
  const {
    packages,
    loading,
    purchasing,
    canMakePayments,
    purchaseCredits,
    redeemOfferCode,
    formatCredits,
  } = useIAP();

  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  const handlePurchase = async (packageId: string) => {
    if (!canMakePayments) {
      Alert.alert(
        'Purchases Unavailable',
        'In-app purchases are not available on this device or platform.'
      );
      return;
    }

    setSelectedPackage(packageId);
    const result = await purchaseCredits(packageId);
    
    if (result.success) {
      onPurchaseComplete?.(result.credits || 0);
      Alert.alert(
        'Purchase Successful!',
        `You've received ${result.credits} credits!`,
        [{ text: 'OK', onPress: onClose }]
      );
    } else {
      Alert.alert('Purchase Failed', result.error || 'Something went wrong');
    }
    
    setSelectedPackage(null);
  };

  const handleOfferCodeRedemption = async () => {
    const result = await redeemOfferCode();
    if (!result.success && result.error) {
      // Error alerts are handled within the redeemOfferCode function
      // Only show additional error if needed
      console.error('Offer code redemption failed:', result.error);
    }
  };

  const getPackageIcon = (packageId: string) => {
    switch (packageId) {
      case 'credits_100':
        return <Zap size={24} color="#8B5CF6" />;
      case 'credits_500':
        return <CreditCard size={24} color="#10B981" />;
      case 'credits_1000':
        return <Star size={24} color="#F59E0B" />;
      case 'credits_2500':
        return <Gift size={24} color="#EF4444" />;
      default:
        return <CreditCard size={24} color="#8B5CF6" />;
    }
  };

  const getPackageGradient = (packageId: string, isPopular?: boolean) => {
    if (isPopular) {
      return ['#F59E0B', '#D97706']; // Gold for popular
    }
    
    switch (packageId) {
      case 'credits_100':
        return ['#8B5CF6', '#7C3AED'];
      case 'credits_500':
        return ['#10B981', '#059669'];
      case 'credits_1000':
        return ['#F59E0B', '#D97706'];
      case 'credits_2500':
        return ['#EF4444', '#DC2626'];
      default:
        return ['#8B5CF6', '#7C3AED'];
    }
  };

  const getBonusText = (pkg: any) => {
    if (pkg.bonus) {
      return `+${pkg.bonus} bonus credits`;
    }
    return null;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <CreditCard size={24} color="#FFFFFF" />
              <Text style={styles.headerTitle}>Purchase Credits</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.currentBalance}>
            <Text style={styles.balanceLabel}>Current Balance</Text>
            <Text style={styles.balanceAmount}>{formatCredits(credits)} credits</Text>
          </View>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Offer Code Redemption */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Have an Offer Code?</Text>
            <TouchableOpacity
              style={styles.offerCodeButton}
              onPress={handleOfferCodeRedemption}
              disabled={!canMakePayments}
            >
              <LinearGradient
                colors={['#8B5CF6', '#EC4899']}
                style={styles.offerCodeGradient}
              >
                <Gift size={20} color="#FFFFFF" />
                <Text style={styles.offerCodeText}>Redeem Offer Code</Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.offerCodeSubtext}>
              {Platform.OS === 'ios' 
                ? 'Opens Apple\'s redemption sheet' 
                : 'Opens Google Play Store'}
            </Text>
          </View>

          {/* Credit Packages */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Credit Packages</Text>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8B5CF6" />
                <Text style={styles.loadingText}>Loading packages...</Text>
              </View>
            ) : packages.length > 0 ? (
              <View style={styles.packagesGrid}>
                {packages.map((pkg) => {
                  const isSelected = selectedPackage === pkg.id;
                  const isPurchasing = purchasing === pkg.id;
                  const bonusText = getBonusText(pkg);
                  
                  return (
                    <TouchableOpacity
                      key={pkg.id}
                      style={[
                        styles.packageCard,
                        pkg.popular && styles.popularPackage,
                        isSelected && styles.selectedPackage,
                      ]}
                      onPress={() => handlePurchase(pkg.id)}
                      disabled={!canMakePayments || isPurchasing}
                    >
                      {pkg.popular && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                        </View>
                      )}
                      
                      <LinearGradient
                        colors={getPackageGradient(pkg.id, pkg.popular) as [string, string, ...string[]]}
                        style={styles.packageGradient}
                      >
                        <View style={styles.packageHeader}>
                          {getPackageIcon(pkg.id)}
                          <Text style={styles.packageTitle}>{pkg.title}</Text>
                        </View>
                        
                        <View style={styles.packageDetails}>
                          <Text style={styles.packageCredits}>
                            {formatCredits(pkg.credits)} credits
                          </Text>
                          {bonusText && (
                            <Text style={styles.packageBonus}>{bonusText}</Text>
                          )}
                          <Text style={styles.packagePrice}>{pkg.price}</Text>
                        </View>
                        
                        <View style={styles.packageFooter}>
                          {isPurchasing ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.packageButton}>
                              {canMakePayments ? 'Purchase' : 'Unavailable'}
                            </Text>
                          )}
                        </View>
                      </LinearGradient>
                      
                      <Text style={styles.packageDescription}>{pkg.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No packages available</Text>
              </View>
            )}
          </View>

          {/* Platform Notice */}
          {Platform.OS === 'web' && (
            <View style={styles.webNotice}>
              <Text style={styles.webNoticeText}>
                In-app purchases are only available on mobile devices. 
                Please use the mobile app to purchase credits.
              </Text>
            </View>
          )}

          {/* Terms */}
          <View style={styles.terms}>
            <Text style={styles.termsText}>
              • Credits are used for AI generation services{'\n'}
              • Purchases are processed securely through your device's app store{'\n'}
              • Credits do not expire and are tied to your account{'\n'}
              • Refunds are subject to app store policies
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 8,
  },
  currentBalance: {
    alignItems: 'center',
    gap: 4,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  offerCodeButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  offerCodeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  offerCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  offerCodeSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  packagesGrid: {
    gap: 16,
  },
  packageCard: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  popularPackage: {
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  selectedPackage: {
    transform: [{ scale: 0.98 }],
  },
  popularBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  packageGradient: {
    padding: 20,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  packageDetails: {
    marginBottom: 16,
  },
  packageCredits: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  packageBonus: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: 8,
  },
  packagePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  packageFooter: {
    alignItems: 'center',
  },
  packageButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  packageDescription: {
    padding: 16,
    paddingTop: 12,
    fontSize: 12,
    color: '#94A3B8',
    backgroundColor: '#1E293B',
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  webNotice: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  webNoticeText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  terms: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  termsText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
});