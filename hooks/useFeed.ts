import { useState, useEffect, useCallback } from 'react';
import { socialService, FeedItem } from '@/services/socialService';
import { useAuth } from '@/contexts/AuthContext';

export interface UseFeedOptions {
  limit?: number;
  content_type?: 'video' | 'image' | 'all';
  user_id?: string;
  sort?: 'recent' | 'popular' | 'trending';
}

export interface UseFeedReturn {
  feed: FeedItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  refreshing: boolean;
  loadMore: () => Promise<FeedItem[] | null>;
  refresh: () => Promise<void>;
  toggleLike: (contentId: string, contentType: 'video' | 'image') => Promise<void>;
  addComment: (contentId: string, contentType: 'video' | 'image', text: string) => Promise<void>;
  shareContent: (contentId: string, contentType: 'video' | 'image', platform: string) => Promise<string>;
}

export function useFeed(options: UseFeedOptions = {}): UseFeedReturn {
  const { session } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const limit = options.limit || 20;

  const loadFeed = useCallback(async (isRefresh = false, currentOffset = 0) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      } else if (currentOffset === 0) {
        setLoading(true);
        setError(null);
      }

      const response = await socialService.getFeed({
        ...options,
        limit,
        offset: currentOffset,
      });

      if (isRefresh || currentOffset === 0) {
        setFeed(response.feed);
      } else {
        setFeed(prev => [...prev, ...response.feed]);
      }

      setHasMore(response.pagination.hasMore);
      setOffset(currentOffset + response.feed.length);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load feed';
      setError(errorMessage);
      console.error('Feed loading error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [options, limit]);

  const refresh = useCallback(async () => {
    setOffset(0);
    await loadFeed(true, 0);
  }, [loadFeed]);

  const loadMore = useCallback(async (): Promise<FeedItem[] | null> => {
    if (!hasMore || loading || refreshing) return null;
    
    const currentOffset = offset;
    await loadFeed(false, currentOffset);
    
    // Return the new items that were loaded
    const newItems = feed.slice(currentOffset);
    return newItems;
  }, [hasMore, loading, refreshing, offset, loadFeed, feed]);

  const toggleLike = useCallback(async (contentId: string, contentType: 'video' | 'image') => {
    if (!session?.user) return;

    // Optimistically update UI
    setFeed(prev => prev.map(item => {
      if (item.id === contentId) {
        const isCurrentlyLiked = item.is_liked;
        return {
          ...item,
          is_liked: !isCurrentlyLiked,
          likes_count: isCurrentlyLiked ? item.likes_count - 1 : item.likes_count + 1,
        };
      }
      return item;
    }));

    try {
      const currentItem = feed.find(item => item.id === contentId);
      const action = currentItem?.is_liked ? 'unlike' : 'like';
      
      const response = await socialService.toggleLike(contentId, contentType, action);
      
      // Update with server response
      setFeed(prev => prev.map(item => {
        if (item.id === contentId) {
          return {
            ...item,
            is_liked: response.userLiked,
            likes_count: response.likesCount,
          };
        }
        return item;
      }));
    } catch (err) {
      // Revert optimistic update on error
      setFeed(prev => prev.map(item => {
        if (item.id === contentId) {
          const wasLiked = !item.is_liked; // Revert the optimistic change
          return {
            ...item,
            is_liked: wasLiked,
            likes_count: wasLiked ? item.likes_count + 1 : item.likes_count - 1,
          };
        }
        return item;
      }));
      console.error('Error toggling like:', err);
    }
  }, [session, feed]);

  const addComment = useCallback(async (contentId: string, contentType: 'video' | 'image', text: string) => {
    if (!session?.user || !text.trim()) return;

    try {
      await socialService.addComment(contentId, contentType, text.trim());
      
      // Update comment count
      setFeed(prev => prev.map(item => {
        if (item.id === contentId) {
          return {
            ...item,
            comments_count: item.comments_count + 1,
          };
        }
        return item;
      }));
    } catch (err) {
      console.error('Error adding comment:', err);
      throw err;
    }
  }, [session]);

  const shareContent = useCallback(async (
    contentId: string, 
    contentType: 'video' | 'image', 
    platform: string
  ): Promise<string> => {
    try {
      const response = await socialService.shareContent(
        contentId, 
        contentType, 
        platform as any
      );
      
      // Update share count
      setFeed(prev => prev.map(item => {
        if (item.id === contentId) {
          return {
            ...item,
            shares_count: item.shares_count + 1,
          };
        }
        return item;
      }));

      return response.shareUrl;
    } catch (err) {
      console.error('Error sharing content:', err);
      throw err;
    }
  }, []);

  // Load initial feed
  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Check user likes for loaded content
  useEffect(() => {
    if (!session?.user || feed.length === 0) return;

    const checkLikes = async () => {
      const updatedFeed = await Promise.all(
        feed.map(async (item) => {
          if (item.is_liked === undefined) {
            const isLiked = await socialService.checkUserLike(item.id, item.content_type);
            return { ...item, is_liked: isLiked };
          }
          return item;
        })
      );

      setFeed(updatedFeed);
    };

    checkLikes();
  }, [session, feed.length]);

  return {
    feed,
    loading,
    error,
    hasMore,
    refreshing,
    loadMore,
    refresh,
    toggleLike,
    addComment,
    shareContent,
  };
}