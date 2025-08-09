import { useEffect, useRef, useCallback } from 'react';
import { mediaOptimizationService, MediaItem } from '@/services/mediaOptimizationService';
import { FeedItem } from '@/services/socialService';

interface UseMediaPreloaderOptions {
  preloadDistance?: number; // How many items ahead to preload
  maxConcurrentPreloads?: number;
  enableThumbnails?: boolean;
  quality?: 'low' | 'medium' | 'high';
}

interface MediaPreloaderState {
  preloadedItems: Set<string>;
  isPreloading: boolean;
  preloadProgress: number;
}

export function useMediaPreloader(
  feedItems: FeedItem[],
  currentIndex: number,
  options: UseMediaPreloaderOptions = {}
) {
  const {
    preloadDistance = 3,
    maxConcurrentPreloads = 2,
    enableThumbnails = true,
    quality = 'medium',
  } = options;

  const preloadedItems = useRef<Set<string>>(new Set());
  const preloadQueue = useRef<Set<string>>(new Set());
  const isPreloading = useRef(false);

  // Convert feed items to media items
  const convertToMediaItems = useCallback((items: FeedItem[]): MediaItem[] => {
    return items.map(item => ({
      id: item.id,
      url: item.media_url,
      type: item.content_type as 'image' | 'video',
      thumbnail: item.thumbnail_url,
      duration: item.duration ? parseFloat(item.duration) : undefined,
    }));
  }, []);

  // Preload media items
  const preloadMediaItems = useCallback(async (items: MediaItem[]) => {
    if (isPreloading.current || items.length === 0) return;

    isPreloading.current = true;

    try {
      // Filter out already preloaded items
      const itemsToPreload = items.filter(item => 
        !preloadedItems.current.has(item.id) && !preloadQueue.current.has(item.id)
      );

      if (itemsToPreload.length === 0) {
        isPreloading.current = false;
        return;
      }

      // Add to preload queue
      itemsToPreload.forEach(item => preloadQueue.current.add(item.id));

      // Preload with priority based on distance from current index
      await mediaOptimizationService.preloadMedia(itemsToPreload, {
        priority: 'normal',
        maxConcurrent: maxConcurrentPreloads,
        prefetchThumbnails: enableThumbnails,
      });

      // Mark as preloaded
      itemsToPreload.forEach(item => {
        preloadedItems.current.add(item.id);
        preloadQueue.current.delete(item.id);
      });
    } catch (error) {
      console.error('Failed to preload media items:', error);
      // Remove failed items from queue
      items.forEach(item => preloadQueue.current.delete(item.id));
    } finally {
      isPreloading.current = false;
    }
  }, [maxConcurrentPreloads, enableThumbnails]);

  // Get items to preload based on current index
  const getItemsToPreload = useCallback((index: number): FeedItem[] => {
    const startIndex = Math.max(0, index);
    const endIndex = Math.min(feedItems.length, index + preloadDistance + 1);
    return feedItems.slice(startIndex, endIndex);
  }, [feedItems, preloadDistance]);

  // Preload items around current index
  const preloadAroundIndex = useCallback(async (index: number) => {
    const itemsToPreload = getItemsToPreload(index);
    const mediaItems = convertToMediaItems(itemsToPreload);
    await preloadMediaItems(mediaItems);
  }, [getItemsToPreload, convertToMediaItems, preloadMediaItems]);

  // Initial preload when feed items change
  useEffect(() => {
    if (feedItems.length > 0) {
      preloadAroundIndex(currentIndex);
    }
  }, [feedItems, preloadAroundIndex]);

  // Preload when current index changes
  useEffect(() => {
    preloadAroundIndex(currentIndex);
  }, [currentIndex, preloadAroundIndex]);

  // Cleanup old preloaded items to manage memory
  const cleanupOldPreloads = useCallback(() => {
    const currentItems = new Set(
      getItemsToPreload(currentIndex).map(item => item.id)
    );

    // Remove items that are far from current index
    const itemsToRemove: string[] = [];
    preloadedItems.current.forEach(itemId => {
      if (!currentItems.has(itemId)) {
        const itemIndex = feedItems.findIndex(item => item.id === itemId);
        if (itemIndex === -1 || Math.abs(itemIndex - currentIndex) > preloadDistance * 2) {
          itemsToRemove.push(itemId);
        }
      }
    });

    itemsToRemove.forEach(itemId => {
      preloadedItems.current.delete(itemId);
    });
  }, [currentIndex, feedItems, preloadDistance, getItemsToPreload]);

  // Cleanup periodically
  useEffect(() => {
    const interval = setInterval(cleanupOldPreloads, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [cleanupOldPreloads]);

  // Prefetch next batch when approaching end
  const prefetchNextBatch = useCallback(async (nextBatchItems: FeedItem[]) => {
    if (nextBatchItems.length === 0) return;

    const mediaItems = convertToMediaItems(nextBatchItems.slice(0, 5)); // Prefetch first 5 items
    await preloadMediaItems(mediaItems);
  }, [convertToMediaItems, preloadMediaItems]);

  // Get preload status for an item
  const getPreloadStatus = useCallback((itemId: string) => {
    return {
      isPreloaded: preloadedItems.current.has(itemId),
      isPreloading: preloadQueue.current.has(itemId),
    };
  }, []);

  // Force preload specific items
  const forcePreload = useCallback(async (items: FeedItem[]) => {
    const mediaItems = convertToMediaItems(items);
    await preloadMediaItems(mediaItems);
  }, [convertToMediaItems, preloadMediaItems]);

  // Clear all preloaded items
  const clearPreloadCache = useCallback(() => {
    preloadedItems.current.clear();
    preloadQueue.current.clear();
  }, []);

  // Get preload statistics
  const getPreloadStats = useCallback(() => {
    return {
      preloadedCount: preloadedItems.current.size,
      preloadingCount: preloadQueue.current.size,
      isPreloading: isPreloading.current,
      preloadedItems: Array.from(preloadedItems.current),
    };
  }, []);

  return {
    preloadAroundIndex,
    prefetchNextBatch,
    getPreloadStatus,
    forcePreload,
    clearPreloadCache,
    getPreloadStats,
    isPreloading: isPreloading.current,
    preloadedCount: preloadedItems.current.size,
  };
}

export default useMediaPreloader;