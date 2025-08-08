import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  Image,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, Crown, Heart, Grid3x3 as Grid, Film, Bell, Shield, CircleHelp as HelpCircle, LogOut, Check, Star, Zap, TrendingUp, Award, Calendar, Download, Share, Eye, Users, Bookmark, Trash2 } from 'lucide-react-native';
import { notificationService } from '@/services/notificationService';
import NotificationPreferences from '@/components/NotificationPreferences';
import SubscriptionStatusBadge from '@/components/SubscriptionStatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import CreditDisplay from '@/components/CreditDisplay';
import CreditPurchaseButton from '@/components/CreditPurchaseButton';

export default function ProfileScreen() {
  const { user, profile, credits, subscriptionStatus, isSubscribed, signOut } = useAuth();
  const {
    // User data
    stats,
    achievements,
    userContent,
    settings,
    
    // Subscription data
    subscriptionPlans,
    subscriptionStatus: backendSubscriptionStatus,
    
    // Content management
    selectedContentTab,
    setSelectedContentTab,
    
    // Actions
    loadUserData,
    updateSettings,
    shareContent,
    deleteContent,
    manageSubscription,
    
    // State
    isLoading,
    isLoadingContent,
    error,
    
    // Pagination
    hasMoreContent,
    loadMoreContent,
  } = useProfile();

  const [showNotificationPreferences, setShowNotificationPreferences] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const testNotification = async () => {
    try {
      await notificationService.scheduleLocalNotification(
        'Test Notification',
        'This is a test notification to verify the system is working!',
        { type: 'test' }
      );
    } catch (error) {
      console.error('Failed to send test notification:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUserData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSettingToggle = async (setting: string, value: boolean) => {
    try {
      await updateSettings({ [setting]: value });
    } catch (error) {
      console.error('Failed to update setting:', error);
    }
  };

  const handleSubscriptionAction = async (action: 'subscribe' | 'upgrade' | 'downgrade' | 'cancel', planId?: string) => {
    try {
      await manageSubscription(action, planId);
    } catch (error) {
      console.error('Failed to manage subscription:', error);
    }
  };

  const userStats = [
    { 
      label: 'Videos Created', 
      value: stats?.content.videosCreated?.toLocaleString() || '0', 
      icon: <Film size={16} color="#8B5CF6" /> 
    },
    { 
      label: 'Images Generated', 
      value: stats?.content.imagesGenerated?.toLocaleString() || '0', 
      icon: <Grid size={16} color="#EC4899" /> 
    },
    { 
      label: 'Followers', 
      value: stats?.social.followers?.toLocaleString() || '0', 
      icon: <Users size={16} color="#10B981" /> 
    },
    { 
      label: 'Following', 
      value: stats?.social.following?.toLocaleString() || '0', 
      icon: <Heart size={16} color="#EF4444" /> 
    },
  ];

  const getAchievementIcon = (iconName: string) => {
    switch (iconName) {
      case 'star': return <Star size={16} color="#F59E0B" />;
      case 'crown': return <Crown size={16} color="#8B5CF6" />;
      case 'trending': return <TrendingUp size={16} color="#10B981" />;
      case 'award': return <Award size={16} color="#EC4899" />;
      default: return <Star size={16} color="#F59E0B" />;
    }
  };

  const getSubscriptionPlansWithStatus = () => {
    return subscriptionPlans.map(plan => ({
      ...plan,
      current: backendSubscriptionStatus?.planId === plan.id,
      price: plan.price_monthly === 0 ? 'Free' : `$${plan.price_monthly}`,
      period: plan.price_monthly === 0 ? 'Forever' : '/month',
      color: plan.id === 'basic' ? ['#6B7280', '#6B7280'] :
             plan.id === 'pro' ? ['#8B5CF6', '#3B82F6'] :
             ['#F59E0B', '#EF4444'],
    }));
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const StatCard = ({ stat }: { stat: any }) => (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        {stat.icon}
      </View>
      <Text style={styles.statValue}>{stat.value}</Text>
      <Text style={styles.statLabel}>{stat.label}</Text>
    </View>
  );

  const AchievementCard = ({ achievement }: { achievement: any }) => (
    <View style={styles.achievementCard}>
      <View style={styles.achievementIcon}>
        {getAchievementIcon(achievement.icon)}
      </View>
      <View style={styles.achievementContent}>
        <Text style={styles.achievementTitle}>{achievement.title}</Text>
        <Text style={styles.achievementDescription}>{achievement.description}</Text>
        {achievement.rarity && (
          <Text style={[styles.achievementRarity, { 
            color: achievement.rarity === 'legendary' ? '#F59E0B' :
                  achievement.rarity === 'epic' ? '#8B5CF6' :
                  achievement.rarity === 'rare' ? '#10B981' : '#6B7280'
          }]}>
            {achievement.rarity.toUpperCase()}
          </Text>
        )}
      </View>
    </View>
  );

  const SubscriptionCard = ({ plan }: { plan: any }) => (
    <View style={[styles.subscriptionCard, plan.current && styles.currentPlan]}>
      {plan.popular && (
        <View style={styles.popularBadge}>
          <Star size={12} color="#FFFFFF" />
          <Text style={styles.popularText}>MOST POPULAR</Text>
        </View>
      )}
      {plan.current && (
        <View style={styles.currentBadge}>
          <Check size={12} color="#FFFFFF" />
          <Text style={styles.currentBadgeText}>CURRENT PLAN</Text>
        </View>
      )}
      <Text style={styles.planName}>{plan.name}</Text>
      <View style={styles.priceContainer}>
        <Text style={styles.planPrice}>{plan.price}</Text>
        <Text style={styles.planPeriod}>{plan.period}</Text>
      </View>
      <View style={styles.featuresContainer}>
        {plan.features.map((feature: string, index: number) => (
          <View key={index} style={styles.feature}>
            <Check size={14} color="#10B981" />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
      {!plan.current && (
        <TouchableOpacity 
          style={styles.upgradeButton}
          onPress={() => {
            const currentPlanId = backendSubscriptionStatus?.planId || 'basic';
            const action = plan.id === 'basic' ? 'downgrade' : 
                          currentPlanId === 'basic' ? 'subscribe' : 'upgrade';
            handleSubscriptionAction(action, plan.id);
          }}
        >
          <LinearGradient
            colors={plan.color}
            style={styles.upgradeGradient}
          >
            <Text style={styles.upgradeButtonText}>
              {plan.id === 'basic' ? 'Downgrade' : 
               backendSubscriptionStatus?.planId === 'basic' ? 'Subscribe' : 'Upgrade'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  const ContentCard = ({ content }: { content: any }) => (
    <View style={styles.contentCard}>
      <View style={styles.contentPreview}>
        {content.content_type === 'video' ? (
          content.thumbnail_url ? (
            <Image source={{ uri: content.thumbnail_url }} style={styles.contentThumbnail} />
          ) : (
            <Film size={24} color="#8B5CF6" />
          )
        ) : (
          content.image_url ? (
            <Image source={{ uri: content.image_url }} style={styles.contentThumbnail} />
          ) : (
            <Grid size={24} color="#EC4899" />
          )
        )}
      </View>
      <View style={styles.contentInfo}>
        <Text style={styles.contentTitle} numberOfLines={1}>
          {content.prompt || 'Untitled'}
        </Text>
        <View style={styles.contentStats}>
          <View style={styles.contentStat}>
            <Heart size={12} color="#94A3B8" />
            <Text style={styles.contentStatText}>{formatNumber(content.likes_count)}</Text>
          </View>
          <View style={styles.contentStat}>
            <Share size={12} color="#94A3B8" />
            <Text style={styles.contentStatText}>{formatNumber(content.shares_count)}</Text>
          </View>
          <View style={styles.contentStat}>
            <Zap size={12} color="#F59E0B" />
            <Text style={styles.contentStatText}>{content.credits_used}</Text>
          </View>
        </View>
      </View>
      <View style={styles.contentActions}>
        <TouchableOpacity 
          style={styles.contentAction}
          onPress={() => shareContent(content.id)}
        >
          <Share size={16} color="#8B5CF6" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.contentAction}
          onPress={() => deleteContent(content.id)}
        >
          <Trash2 size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const SettingRow = ({ 
    icon, 
    title, 
    subtitle, 
    action, 
    showSwitch = false, 
    switchValue = false, 
    onSwitchChange,
    danger = false
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    action?: () => void;
    showSwitch?: boolean;
    switchValue?: boolean;
    onSwitchChange?: (value: boolean) => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity 
      style={styles.settingRow} 
      onPress={action}
      disabled={showSwitch}
    >
      <View style={[styles.settingIcon, danger && styles.dangerIcon]}>
        {icon}
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && styles.dangerText]}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {showSwitch && (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: '#374151', true: '#8B5CF6' }}
          thumbColor="#FFFFFF"
        />
      )}
    </TouchableOpacity>
  );

  const TabButton = ({ 
    tab, 
    icon, 
    title 
  }: { 
    tab: 'videos' | 'images' | 'liked';
    icon: React.ReactNode;
    title: string;
  }) => (
    <TouchableOpacity
      style={[styles.tabButton, selectedContentTab === tab && styles.activeTabButton]}
      onPress={() => setSelectedContentTab(tab)}
    >
      {icon}
      <Text style={[styles.tabButtonText, selectedContentTab === tab && styles.activeTabButtonText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8B5CF6"
          />
        }
      >
        <LinearGradient
          colors={['#8B5CF6', '#EC4899']}
          style={styles.header}
        >
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={['#FFFFFF', '#F3F4F6']}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{profile?.username?.substring(0, 2).toUpperCase() || 'AI'}</Text>
              </LinearGradient>
              {isSubscribed && (
                <View style={styles.premiumBadge}>
                  <Crown size={16} color="#FFFFFF" />
                </View>
              )}
            </View>
            <Text style={styles.username}>@{profile?.username || user?.email?.split('@')[0] || 'user'}</Text>
            <Text style={styles.bio}>
              Creating stunning AI content daily ✨ | Digital Artist | Tech Enthusiast
            </Text>
            <View style={styles.profileBadges}>
              <SubscriptionStatusBadge
                status={subscriptionStatus}
                size="medium"
                daysRemaining={profile?.subscriptionDaysRemaining}
              />
              <CreditDisplay size="small" showAddButton />
            </View>
            <View style={styles.joinDate}>
              <Calendar size={14} color="#E5E7EB" />
              <Text style={styles.joinDateText}>
                Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.statsContainer}>
            {userStats.map((stat, index) => (
              <StatCard key={index} stat={stat} />
            ))}
          </View>

          <View style={styles.achievementsSection}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            {isLoading ? (
              <ActivityIndicator size="small" color="#8B5CF6" style={{ marginVertical: 20 }} />
            ) : achievements.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.achievementsContainer}>
                  {achievements.map((achievement, index) => (
                    <AchievementCard key={achievement.id || index} achievement={achievement} />
                  ))}
                </View>
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>No achievements yet. Keep creating to unlock them!</Text>
            )}
          </View>

          <View style={styles.contentTabsSection}>
            <View style={styles.contentTabs}>
              <TabButton
                tab="videos"
                icon={<Film size={20} color={selectedContentTab === 'videos' ? '#8B5CF6' : '#6B7280'} />}
                title="Videos"
              />
              <TabButton
                tab="images"
                icon={<Grid size={20} color={selectedContentTab === 'images' ? '#8B5CF6' : '#6B7280'} />}
                title="Images"
              />
              <TabButton
                tab="liked"
                icon={<Heart size={20} color={selectedContentTab === 'liked' ? '#8B5CF6' : '#6B7280'} />}
                title="Liked"
              />
            </View>
            
            <View style={styles.contentGrid}>
              {isLoadingContent && userContent.length === 0 ? (
                <ActivityIndicator size="small" color="#8B5CF6" style={{ marginVertical: 20 }} />
              ) : userContent.length > 0 ? (
                <>
                  {userContent.map((content, index) => (
                    <ContentCard key={content.id} content={content} />
                  ))}
                  {hasMoreContent && (
                    <TouchableOpacity 
                      style={styles.loadMoreButton}
                      onPress={loadMoreContent}
                      disabled={isLoadingContent}
                    >
                      {isLoadingContent ? (
                        <ActivityIndicator size="small" color="#8B5CF6" />
                      ) : (
                        <Text style={styles.loadMoreText}>Load More</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <Text style={styles.emptyText}>
                  {selectedContentTab === 'videos' ? 'No videos created yet' :
                   selectedContentTab === 'images' ? 'No images generated yet' :
                   'No liked content yet'}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.creditPurchaseSection}>
            <View style={styles.creditPurchaseHeader}>
              <Text style={styles.sectionTitle}>Need More Credits?</Text>
              <CreditPurchaseButton
                variant="secondary"
                text="Buy Credits"
                onPurchaseComplete={(credits) => {
                  console.log(`Successfully purchased ${credits} credits`);
                }}
              />
            </View>
            <Text style={styles.creditPurchaseDescription}>
              Purchase credits to generate more AI content, train custom models, and access premium features.
            </Text>
          </View>

          <View style={styles.subscriptionSection}>
            <Text style={styles.sectionTitle}>Subscription Plans</Text>
            <View style={styles.subscriptionGrid}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#8B5CF6" style={{ marginVertical: 20 }} />
              ) : (
                getSubscriptionPlansWithStatus().map((plan, index) => (
                  <SubscriptionCard key={plan.id} plan={plan} />
                ))
              )}
            </View>
          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Settings & Preferences</Text>
            
            <SettingRow
              icon={<Bell size={24} color="#8B5CF6" />}
              title="Push Notifications"
              subtitle="Manage notification preferences and permissions"
              action={() => setShowNotificationPreferences(true)}
            />
            
            <SettingRow
              icon={<Shield size={24} color="#8B5CF6" />}
              title="Private Profile"
              subtitle="Hide your profile from public discovery"
              showSwitch
              switchValue={settings?.privacy_profile === 'private'}
              onSwitchChange={(value) => handleSettingToggle('privacy_profile', value)}
            />
            
            <SettingRow
              icon={<Download size={24} color="#8B5CF6" />}
              title="Download Quality"
              subtitle="Manage download preferences and formats"
              action={() => {}}
            />
            
            <SettingRow
              icon={<Settings size={24} color="#8B5CF6" />}
              title="Account Settings"
              subtitle="Manage your account and preferences"
              action={() => {}}
            />
            
            <SettingRow
              icon={<HelpCircle size={24} color="#8B5CF6" />}
              title="Help & Support"
              subtitle="Get help, report issues, and contact support"
              action={() => {}}
            />
            
            {__DEV__ && (
              <SettingRow
                icon={<Bell size={24} color="#F59E0B" />}
                title="Test Notification"
                subtitle="Send a test push notification (Development only)"
                action={testNotification}
              />
            )}
            
            <SettingRow
              icon={<LogOut size={24} color="#EF4444" />}
              title="Sign Out"
              subtitle="Sign out of your account"
              action={signOut}
              danger
            />
          </View>
        </View>
      </ScrollView>
      
      {/* Notification Preferences Modal */}
      <Modal
        visible={showNotificationPreferences}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotificationPreferences(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowNotificationPreferences(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <NotificationPreferences
            onPreferencesChange={(preferences) => {
              console.log('Notification preferences updated:', preferences);
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 30,
    paddingTop: 60,
  },
  profileSection: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#8B5CF6',
  },
  premiumBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#F59E0B',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  username: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: '#E5E7EB',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  joinDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  joinDateText: {
    fontSize: 12,
    color: '#E5E7EB',
    opacity: 0.8,
  },
  profileBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  creditsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  creditsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    padding: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '500',
  },
  achievementsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  achievementsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 20,
  },
  achievementCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    width: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  achievementDescription: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 14,
  },
  achievementRarity: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  contentTabsSection: {
    marginBottom: 32,
  },
  contentTabs: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 6,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  activeTabButton: {
    backgroundColor: '#334155',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabButtonText: {
    color: '#FFFFFF',
  },
  contentGrid: {
    gap: 12,
  },
  contentCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  contentPreview: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentInfo: {
    flex: 1,
  },
  contentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  contentStats: {
    flexDirection: 'row',
    gap: 16,
  },
  contentStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contentStatText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  contentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  contentAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: 20,
    fontStyle: 'italic',
  },
  loadMoreButton: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  creditPurchaseSection: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  creditPurchaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  creditPurchaseDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 18,
  },
  subscriptionSection: {
    marginBottom: 32,
  },
  subscriptionGrid: {
    gap: 16,
  },
  subscriptionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  currentPlan: {
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
  currentBadge: {
    position: 'absolute',
    top: -8,
    right: 20,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  planPeriod: {
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 4,
  },
  featuresContainer: {
    gap: 8,
    marginBottom: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#E5E7EB',
    flex: 1,
  },
  upgradeButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  upgradeGradient: {
    padding: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settingsSection: {
    gap: 12,
  },
  settingRow: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  settingIcon: {
    width: 44,
    height: 44,
    backgroundColor: '#334155',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerIcon: {
    backgroundColor: '#7F1D1D',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  dangerText: {
    color: '#EF4444',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalCloseButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  errorContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
});