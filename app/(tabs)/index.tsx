import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Heart, MessageCircle, Share, MoveVertical as MoreVertical, Play, Pause, Volume2, VolumeX, Bookmark, User, EggFried as Verified } from 'lucide-react-native';
import VideoPlayer from '@/components/VideoPlayer';
import { LinearGradient } from 'expo-linear-gradient';
import { useFeed } from '@/hooks/useFeed';
import { FeedItem } from '@/services/socialService';
import { useAuth } from '@/contexts/AuthContext';
import CommentsModal from '@/components/CommentsModal';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export default function FeedScreen() {
  const { session } = useAuth();
  const {
    feed,
    loading,
    error,
    hasMore,
    refreshing,
    loadMore,
    refresh,
    toggleLike,
    addComment,
    shareContent
  } = useFeed({
    content_type: 'all',
    sort: 'recent',
    limit: 10
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleToggleLike = useCallback(async (item: FeedItem) => {
    if (!session?.user) {
      Alert.alert('Login Required', 'Please log in to like content');
      return;
    }

    // Animate like action
    Animated.sequence([
      Animated.timing(fadeAnim, { duration: 100, toValue: 0.7, useNativeDriver: true }),
      Animated.timing(fadeAnim, { duration: 100, toValue: 1, useNativeDriver: true }),
    ]).start();

    try {
      await toggleLike(item.id, item.content_type);
    } catch (error) {
      Alert.alert('Error', 'Failed to update like. Please try again.');
    }
  }, [session, toggleLike, fadeAnim]);

  const handleShare = useCallback(async (item: FeedItem) => {
    try {
      const shareUrl = await shareContent(item.id, item.content_type, 'copy_link');
      Alert.alert('Share', `Link copied: ${shareUrl}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to share content. Please try again.');
    }
  }, [shareContent]);

  const handleComment = useCallback((item: FeedItem) => {
    setSelectedItem(item);
    setCommentsModalVisible(true);
  }, []);

  const handleCommentAdded = useCallback(() => {
    // Refresh the feed to get updated comment counts
    // In a real app, you might want to update the specific item's comment count
    if (selectedItem) {
      // Update the comment count for the specific item
      // This is handled by the useFeed hook's addComment method
    }
  }, [selectedItem]);

  const handleBookmark = useCallback((item: FeedItem) => {
    // Bookmarks aren't implemented in the backend yet
    Alert.alert('Bookmarks', 'Bookmark feature coming soon!');
  }, []);

  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const ActionButton = ({
    icon,
    count,
    onPress,
    isActive = false,
    activeColor = '#EF4444'
  }: {
    icon: React.ReactNode;
    count: number;
    onPress: () => void;
    isActive?: boolean;
    activeColor?: string;
  }) => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity style={styles.actionButton} onPress={onPress}>
        <View style={[styles.actionIconContainer, isActive && { backgroundColor: activeColor + '20' }]}>
          {icon}
        </View>
        <Text style={styles.actionCount}>{formatCount(count)}</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderVideo = ({ item, index }: { item: FeedItem; index: number }) => (
    <View style={styles.videoContainer}>
      <VideoPlayer
        source={{ uri: item.media_url }}
        shouldPlay={index === currentIndex && isPlaying}
        isLooping
        style={styles.video}
      />

      {/* Top overlay with model info */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={styles.topOverlay}
      >
        {item.model && (
          <View style={styles.modelBadge}>
            <Text style={styles.modelText}>{item.model}</Text>
          </View>
        )}
        {item.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{item.duration}</Text>
          </View>
        )}
      </LinearGradient>

      {/* Bottom overlay with content */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.bottomOverlay}
      />

      {/* Play/Pause overlay */}
      <TouchableOpacity
        style={styles.playPauseOverlay}
        onPress={() => setIsPlaying(!isPlaying)}
      >
        {!isPlaying && (
          <View style={styles.playButton}>
            <Play size={32} color="#FFFFFF" fill="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>

      {/* Content container */}
      <View style={styles.contentContainer}>
        <View style={styles.leftContent}>
          <View style={styles.authorContainer}>
            <View style={styles.authorAvatar}>
              <User size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.author}>@{item.username}</Text>
            {/* Note: authorVerified would need to be added to the backend data */}
          </View>
          <Text style={styles.title}>AI Generated {item.content_type === 'video' ? 'Video' : 'Image'}</Text>
          <View style={styles.promptContainer}>
            <Text style={styles.promptLabel}>Prompt:</Text>
            <Text style={styles.promptText} numberOfLines={2}>
              "{item.prompt}"
            </Text>
          </View>
        </View>

        <View style={styles.rightActions}>
          <ActionButton
            icon={
              <Heart
                size={28}
                color={item.is_liked ? '#EF4444' : '#FFFFFF'}
                fill={item.is_liked ? '#EF4444' : 'transparent'}
              />
            }
            count={item.likes_count}
            onPress={() => handleToggleLike(item)}
            isActive={item.is_liked}
            activeColor="#EF4444"
          />

          <ActionButton
            icon={<MessageCircle size={28} color="#FFFFFF" />}
            count={item.comments_count}
            onPress={() => handleComment(item)}
          />

          <ActionButton
            icon={
              <Bookmark
                size={28}
                color={item.is_bookmarked ? '#F59E0B' : '#FFFFFF'}
                fill={item.is_bookmarked ? '#F59E0B' : 'transparent'}
              />
            }
            count={0} // Bookmarks not implemented yet
            onPress={() => handleBookmark(item)}
            isActive={item.is_bookmarked}
            activeColor="#F59E0B"
          />

          <ActionButton
            icon={<Share size={28} color="#FFFFFF" />}
            count={item.shares_count}
            onPress={() => handleShare(item)}
          />

          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionIconContainer}>
              <MoreVertical size={28} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {/* Sound toggle */}
          <TouchableOpacity
            style={styles.soundButton}
            onPress={() => setIsMuted(!isMuted)}
          >
            {isMuted ? (
              <VolumeX size={24} color="#FFFFFF" />
            ) : (
              <Volume2 size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!hasMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading more content...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.emptyText}>Loading feed...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>Failed to load feed</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No content available</Text>
        <Text style={styles.emptySubtext}>Check back later for new AI-generated content!</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={feed}
        renderItem={renderVideo}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.y / SCREEN_HEIGHT);
          setCurrentIndex(index);
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#8B5CF6"
            colors={['#8B5CF6']}
          />
        }
      />

      {/* Comments Modal */}
      {selectedItem && (
        <CommentsModal
          visible={commentsModalVisible}
          onClose={() => {
            setCommentsModalVisible(false);
            setSelectedItem(null);
          }}
          contentId={selectedItem.id}
          contentType={selectedItem.content_type}
          onCommentAdded={handleCommentAdded}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoContainer: {
    height: SCREEN_HEIGHT,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 60,
  },
  modelBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  durationBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  playPauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 20,
    alignItems: 'flex-end',
  },
  leftContent: {
    flex: 1,
    marginRight: 20,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  author: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 24,
  },
  description: {
    fontSize: 15,
    color: '#E5E7EB',
    lineHeight: 20,
    marginBottom: 12,
  },
  promptContainer: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  promptLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C4B5FD',
    marginBottom: 4,
  },
  promptText: {
    fontSize: 13,
    color: '#E5E7EB',
    fontStyle: 'italic',
  },
  rightActions: {
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionCount: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  soundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loadingFooter: {
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#9CA3AF',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});