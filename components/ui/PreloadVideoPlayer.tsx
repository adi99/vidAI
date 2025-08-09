import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { VideoView, useVideoPlayer, VideoSource } from 'expo-video';
import { MotiView, MotiText } from 'moti';
import { useTheme } from 'react-native-paper';
import { mediaOptimizationService, MediaItem } from '@/services/mediaOptimizationService';
import GestureVideoPlayer from './GestureVideoPlayer';

interface PreloadVideoPlayerProps {
  source: VideoSource;
  style?: any;
  contentFit?: 'contain' | 'cover' | 'fill';
  shouldPlay?: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
  onPlaybackStatusUpdate?: (status: any) => void;
  onLoadStart?: () => void;
  onLoad?: (status: any) => void;
  onError?: (error: string) => void;
  showControls?: boolean;
  autoHideControls?: boolean;
  controlsTimeout?: number;
  preloadNext?: MediaItem[]; // Videos to preload for smooth scrolling
  quality?: 'low' | 'medium' | 'high';
  enableThumbnail?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

export default function PreloadVideoPlayer({
  source,
  style,
  contentFit = 'contain',
  shouldPlay = false,
  isLooping = false,
  isMuted = false,
  onPlaybackStatusUpdate,
  onLoadStart,
  onLoad,
  onError,
  showControls = true,
  autoHideControls = true,
  controlsTimeout = 3000,
  preloadNext = [],
  quality = 'medium',
  enableThumbnail = true,
}: PreloadVideoPlayerProps) {
  const theme = useTheme();
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [optimizedSource, setOptimizedSource] = useState<VideoSource>(source);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [isPreloading, setIsPreloading] = useState(false);
  
  const preloadedVideos = useRef<Set<string>>(new Set());
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    initializeVideo();
  }, [source, quality]);

  useEffect(() => {
    if (preloadNext.length > 0) {
      preloadNextVideos();
    }
  }, [preloadNext]);

  const initializeVideo = async () => {
    if (!source || typeof source === 'string' || typeof source === 'number' || !source.uri) return;

    setIsLoading(true);
    setHasError(false);
    onLoadStart?.();

    try {
      // Get optimized video URL
      const optimizedUri = await mediaOptimizationService.getCachedMedia(source.uri!, {
        quality,
        compress: true,
      });

      if (isMounted.current) {
        setOptimizedSource({ uri: optimizedUri });
        
        // Load thumbnail if enabled
        if (enableThumbnail) {
          loadThumbnail(source.uri!);
        }
        
        setIsLoading(false);
        onLoad?.({ uri: optimizedUri });
      }
    } catch (error) {
      if (isMounted.current) {
        setHasError(true);
        setIsLoading(false);
        onError?.(error instanceof Error ? error.message : 'Failed to load video');
      }
    }
  };

  const loadThumbnail = async (videoUri: string) => {
    try {
      const thumbnail = await mediaOptimizationService.getVideoThumbnail(videoUri);
      if (isMounted.current) {
        setThumbnailUri(thumbnail);
      }
    } catch (error) {
      console.error('Failed to load video thumbnail:', error);
    }
  };

  const preloadNextVideos = async () => {
    if (isPreloading || preloadNext.length === 0) return;

    setIsPreloading(true);
    setPreloadProgress(0);

    try {
      const videosToPreload = preloadNext.filter(
        item => item.type === 'video' && !preloadedVideos.current.has(item.url)
      );

      if (videosToPreload.length === 0) {
        setIsPreloading(false);
        return;
      }

      // Preload videos with progress tracking
      await mediaOptimizationService.preloadMedia(videosToPreload, {
        priority: 'normal',
        maxConcurrent: 2,
        prefetchThumbnails: true,
      });

      // Mark as preloaded
      videosToPreload.forEach(video => {
        preloadedVideos.current.add(video.url);
      });

      if (isMounted.current) {
        setPreloadProgress(100);
        setTimeout(() => {
          if (isMounted.current) {
            setIsPreloading(false);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Failed to preload videos:', error);
      if (isMounted.current) {
        setIsPreloading(false);
      }
    }
  };

  const renderLoadingState = () => (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={[styles.loadingContainer, style]}
    >
      {thumbnailUri ? (
        <View style={styles.thumbnailContainer}>
          <img
            src={thumbnailUri}
            style={styles.thumbnail}
            alt="Video thumbnail"
          />
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <MotiText style={[styles.loadingText, { color: theme.colors.onSurface }]}>
              Loading video...
            </MotiText>
          </View>
        </View>
      ) : (
        <View style={styles.placeholderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <MotiText style={[styles.loadingText, { color: theme.colors.onSurface }]}>
            Loading video...
          </MotiText>
        </View>
      )}
    </MotiView>
  );

  const renderErrorState = () => (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={[styles.errorContainer, style]}
    >
      <View style={styles.errorIcon}>
        <MotiText style={styles.errorEmoji}>⚠️</MotiText>
      </View>
      <MotiText style={[styles.errorText, { color: theme.colors.error }]}>
        Failed to load video
      </MotiText>
    </MotiView>
  );

  const renderPreloadIndicator = () => {
    if (!isPreloading) return null;

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        exit={{ opacity: 0, translateY: 20 }}
        style={[styles.preloadIndicator, { backgroundColor: theme.colors.surface + 'E6' }]}
      >
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <MotiText style={[styles.preloadText, { color: theme.colors.onSurface }]}>
          Preloading next videos...
        </MotiText>
        <View style={styles.preloadProgressContainer}>
          <View style={[styles.preloadProgressTrack, { backgroundColor: theme.colors.outline }]}>
            <MotiView
              animate={{ width: `${preloadProgress}%` }}
              transition={{ type: 'timing', duration: 200 }}
              style={[styles.preloadProgressFill, { backgroundColor: theme.colors.primary }]}
            />
          </View>
        </View>
      </MotiView>
    );
  };

  if (hasError) {
    return renderErrorState();
  }

  if (isLoading) {
    return renderLoadingState();
  }

  return (
    <View style={[styles.container, style]}>
      <GestureVideoPlayer
        source={optimizedSource}
        style={styles.video}
        contentFit={contentFit}
        shouldPlay={shouldPlay}
        isLooping={isLooping}
        isMuted={isMuted}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        onLoadStart={onLoadStart}
        onLoad={onLoad}
        onError={onError}
        showControls={showControls}
        autoHideControls={autoHideControls}
        controlsTimeout={controlsTimeout}
      />
      
      {renderPreloadIndicator()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  thumbnailContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    width: '100%',
    height: '100%',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2937',
  },
  errorIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorEmoji: {
    fontSize: 24,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  preloadIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 200,
  },
  preloadText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  preloadProgressContainer: {
    width: 60,
    height: 4,
  },
  preloadProgressTrack: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  preloadProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
});