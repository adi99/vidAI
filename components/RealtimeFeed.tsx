import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Animated,
} from 'react-native';
import { Heart, MessageCircle, Share, Zap } from 'lucide-react-native';
import { useFeedUpdates } from '@/hooks/useRealtime';
import { FeedItem } from '@/services/socialService';

interface RealtimeFeedProps {
  initialData?: FeedItem[];
  onItemPress?: (item: FeedItem) => void;
  onLike?: (itemId: string) => void;
  onComment?: (itemId: string) => void;
  onShare?: (itemId: string) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function RealtimeFeed({
  initialData = [],
  onItemPress,
  onLike,
  onComment,
  onShare,
  refreshing = false,
  onRefresh,
}: RealtimeFeedProps) {
  const [feedData, setFeedData] = useState<FeedItem[]>(initialData);
  const [newContentCount, setNewContentCount] = useState(0);
  const [animatedValue] = useState(new Animated.Value(0));
  const { updates, latestUpdate } = useFeedUpdates();

  // Update feed data when initial data changes
  useEffect(() => {
    setFeedData(initialData);
  }, [initialData]);

  // Handle real-time updates
  useEffect(() => {
    if (!latestUpdate) return;

    switch (latestUpdate.type) {
      case 'new_content':
        handleNewContent(latestUpdate.data);
        break;
      case 'like':
        handleLikeUpdate(latestUpdate.data);
        break;
      case 'comment':
        handleCommentUpdate(latestUpdate.data);
        break;
    }
  }, [latestUpdate]);

  const handleNewContent = (newContent: any) => {
    // Add new content to the top of the feed
    const newItem: FeedItem = {
      id: newContent.id,
      user_id: newContent.user_id,
      username: newContent.username || 'Anonymous',
      content_type: newContent.video_url ? 'video' : 'image',
      prompt: newContent.prompt,
      media_url: newContent.video_url || newContent.image_url,
      thumbnail_url: newContent.thumbnail_url,
      likes_count: 0,
      comments_count: 0,
      shares_count: 0,
      created_at: newContent.created_at,
      model: newContent.model,
      duration: newContent.duration,
      is_liked: false,
      is_bookmarked: false,
    };

    setFeedData(prev => [newItem, ...prev]);
    setNewContentCount(prev => prev + 1);
    
    // Animate new content indicator
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleLikeUpdate = (likeData: any) => {
    setFeedData(prev => prev.map(item => {
      if (item.id === likeData.content_id) {
        return {
          ...item,
          likes_count: item.likes_count + (likeData.event === 'INSERT' ? 1 : -1),
          is_liked: likeData.user_id === item.user_id ? (likeData.event === 'INSERT') : item.is_liked,
        };
      }
      return item;
    }));
  };

  const handleCommentUpdate = (commentData: any) => {
    setFeedData(prev => prev.map(item => {
      if (item.id === commentData.content_id) {
        return {
          ...item,
          comments_count: item.comments_count + (commentData.event === 'INSERT' ? 1 : 0),
        };
      }
      return item;
    }));
  };

  const handleRefresh = useCallback(() => {
    setNewContentCount(0);
    onRefresh?.();
  }, [onRefresh]);

  const renderNewContentIndicator = () => {
    if (newContentCount === 0) return null;

    return (
      <Animated.View 
        style={[
          styles.newContentIndicator,
          { transform: [{ scale: animatedValue }] }
        ]}
      >
        <TouchableOpacity
          style={styles.newContentButton}
          onPress={handleRefresh}
        >
          <Zap size={16} color="#fff" />
          <Text style={styles.newContentText}>
            {newContentCount} new {newContentCount === 1 ? 'post' : 'posts'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderFeedItem = ({ item }: { item: FeedItem }) => (
    <TouchableOpacity
      style={styles.feedItem}
      onPress={() => onItemPress?.(item)}
    >
      <View style={styles.itemHeader}>
        <Text style={styles.username}>@{item.username}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      
      <Text style={styles.prompt} numberOfLines={2}>
        {item.prompt}
      </Text>
      
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={[styles.actionButton, item.is_liked && styles.likedButton]}
          onPress={() => onLike?.(item.id)}
        >
          <Heart 
            size={16} 
            color={item.is_liked ? '#ff4444' : '#666'} 
            fill={item.is_liked ? '#ff4444' : 'none'}
          />
          <Text style={[styles.actionText, item.is_liked && styles.likedText]}>
            {item.likes_count}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onComment?.(item.id)}
        >
          <MessageCircle size={16} color="#666" />
          <Text style={styles.actionText}>{item.comments_count}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onShare?.(item.id)}
        >
          <Share size={16} color="#666" />
          <Text style={styles.actionText}>{item.shares_count}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No content available</Text>
      <Text style={styles.emptySubtext}>Pull to refresh or check back later</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderNewContentIndicator()}
      
      <FlatList
        data={feedData}
        renderItem={renderFeedItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8B5CF6"
            colors={['#8B5CF6']}
          />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  newContentIndicator: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
  },
  newContentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  newContentText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  feedItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  prompt: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 12,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  likedButton: {
    backgroundColor: '#ffebee',
  },
  actionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  likedText: {
    color: '#ff4444',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});