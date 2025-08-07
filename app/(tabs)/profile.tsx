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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, Crown, Heart, Grid3x3 as Grid, Film, Bell, Shield, CircleHelp as HelpCircle, LogOut, Check, Star, Zap, TrendingUp, Award, Calendar, Download, Share, Eye, Users, Bookmark } from 'lucide-react-native';

export default function ProfileScreen() {
  const [isPremium, setIsPremium] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [privateProfile, setPrivateProfile] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'videos' | 'images' | 'liked'>('videos');

  const userStats = [
    { label: 'Videos Created', value: '1,247', icon: <Film size={16} color="#8B5CF6" /> },
    { label: 'Images Generated', value: '15,432', icon: <Grid size={16} color="#EC4899" /> },
    { label: 'Followers', value: '23.4K', icon: <Users size={16} color="#10B981" /> },
    { label: 'Following', value: '567', icon: <Heart size={16} color="#EF4444" /> },
  ];

  const achievements = [
    { title: 'Early Adopter', description: 'Joined in the first month', icon: <Star size={16} color="#F59E0B" /> },
    { title: 'Creator Pro', description: '1000+ generations', icon: <Crown size={16} color="#8B5CF6" /> },
    { title: 'Viral Hit', description: 'Video with 100K+ views', icon: <TrendingUp size={16} color="#10B981" /> },
  ];

  const subscriptionPlans = [
    {
      name: 'Basic',
      price: 'Free',
      period: 'Forever',
      features: ['10 videos/month', '50 images/month', 'Basic models only', 'Standard quality'],
      current: !isPremium,
      color: ['#6B7280', '#6B7280'],
    },
    {
      name: 'Pro',
      price: '$9.99',
      period: '/month',
      features: ['Unlimited videos', 'Unlimited images', 'All AI models', 'High quality', 'Priority support'],
      current: isPremium,
      color: ['#8B5CF6', '#3B82F6'],
      popular: true,
    },
    {
      name: 'Premium',
      price: '$19.99',
      period: '/month',
      features: ['Everything in Pro', 'Custom model training', 'API access', 'Commercial license', 'White-label'],
      current: false,
      color: ['#F59E0B', '#EF4444'],
    },
  ];

  const recentContent = [
    { type: 'video', title: 'Cyberpunk City', views: '125K', likes: '12.5K' },
    { type: 'image', title: 'Fantasy Portrait', views: '89K', likes: '8.9K' },
    { type: 'video', title: 'Ocean Waves', views: '67K', likes: '6.7K' },
    { type: 'image', title: 'Space Station', views: '45K', likes: '4.5K' },
  ];

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
        {achievement.icon}
      </View>
      <View style={styles.achievementContent}>
        <Text style={styles.achievementTitle}>{achievement.title}</Text>
        <Text style={styles.achievementDescription}>{achievement.description}</Text>
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
        <TouchableOpacity style={styles.upgradeButton}>
          <LinearGradient
            colors={plan.color}
            style={styles.upgradeGradient}
          >
            <Text style={styles.upgradeButtonText}>
              {plan.name === 'Basic' ? 'Downgrade' : 'Upgrade'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  const ContentCard = ({ content }: { content: any }) => (
    <TouchableOpacity style={styles.contentCard}>
      <View style={styles.contentPreview}>
        {content.type === 'video' ? (
          <Film size={24} color="#8B5CF6" />
        ) : (
          <Grid size={24} color="#EC4899" />
        )}
      </View>
      <View style={styles.contentInfo}>
        <Text style={styles.contentTitle}>{content.title}</Text>
        <View style={styles.contentStats}>
          <View style={styles.contentStat}>
            <Eye size={12} color="#94A3B8" />
            <Text style={styles.contentStatText}>{content.views}</Text>
          </View>
          <View style={styles.contentStat}>
            <Heart size={12} color="#94A3B8" />
            <Text style={styles.contentStatText}>{content.likes}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.contentAction}>
        <Share size={16} color="#8B5CF6" />
      </TouchableOpacity>
    </TouchableOpacity>
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
      style={[styles.tabButton, selectedTab === tab && styles.activeTabButton]}
      onPress={() => setSelectedTab(tab)}
    >
      {icon}
      <Text style={[styles.tabButtonText, selectedTab === tab && styles.activeTabButtonText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
                <Text style={styles.avatarText}>AI</Text>
              </LinearGradient>
              {isPremium && (
                <View style={styles.premiumBadge}>
                  <Crown size={16} color="#FFFFFF" />
                </View>
              )}
            </View>
            <Text style={styles.username}>@ai_creator_pro</Text>
            <Text style={styles.bio}>
              Creating stunning AI content daily ✨ | Digital Artist | Tech Enthusiast
            </Text>
            <View style={styles.joinDate}>
              <Calendar size={14} color="#E5E7EB" />
              <Text style={styles.joinDateText}>Joined December 2024</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.statsContainer}>
            {userStats.map((stat, index) => (
              <StatCard key={index} stat={stat} />
            ))}
          </View>

          <View style={styles.achievementsSection}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.achievementsContainer}>
                {achievements.map((achievement, index) => (
                  <AchievementCard key={index} achievement={achievement} />
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.contentTabsSection}>
            <View style={styles.contentTabs}>
              <TabButton
                tab="videos"
                icon={<Film size={20} color={selectedTab === 'videos' ? '#8B5CF6' : '#6B7280'} />}
                title="Videos"
              />
              <TabButton
                tab="images"
                icon={<Grid size={20} color={selectedTab === 'images' ? '#8B5CF6' : '#6B7280'} />}
                title="Images"
              />
              <TabButton
                tab="liked"
                icon={<Heart size={20} color={selectedTab === 'liked' ? '#8B5CF6' : '#6B7280'} />}
                title="Liked"
              />
            </View>
            
            <View style={styles.contentGrid}>
              {recentContent.map((content, index) => (
                <ContentCard key={index} content={content} />
              ))}
            </View>
          </View>

          <View style={styles.subscriptionSection}>
            <Text style={styles.sectionTitle}>Subscription Plans</Text>
            <View style={styles.subscriptionGrid}>
              {subscriptionPlans.map((plan, index) => (
                <SubscriptionCard key={index} plan={plan} />
              ))}
            </View>
          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Settings & Preferences</Text>
            
            <SettingRow
              icon={<Bell size={24} color="#8B5CF6" />}
              title="Push Notifications"
              subtitle="Get notified about new features and updates"
              showSwitch
              switchValue={notifications}
              onSwitchChange={setNotifications}
            />
            
            <SettingRow
              icon={<Shield size={24} color="#8B5CF6" />}
              title="Private Profile"
              subtitle="Hide your profile from public discovery"
              showSwitch
              switchValue={privateProfile}
              onSwitchChange={setPrivateProfile}
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
            
            <SettingRow
              icon={<LogOut size={24} color="#EF4444" />}
              title="Sign Out"
              subtitle="Sign out of your account"
              action={() => {}}
              danger
            />
          </View>
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
  contentAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
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
});