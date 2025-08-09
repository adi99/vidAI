import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  ViewStyle,
  ImageStyle,
  ActivityIndicator,
} from 'react-native';
import { MotiView } from 'moti';
import { mediaOptimizationService } from '@/services/mediaOptimizationService';

interface LazyImageProps {
  source: { uri: string };
  style?: ImageStyle;
  placeholder?: React.ReactNode;
  fadeDuration?: number;
  quality?: 'low' | 'medium' | 'high';
  maxWidth?: number;
  maxHeight?: number;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  blurRadius?: number;
  progressive?: boolean; // Enable progressive loading (low -> high quality)
}

export default function LazyImage({
  source,
  style,
  placeholder,
  fadeDuration = 300,
  quality = 'high',
  maxWidth,
  maxHeight,
  onLoad,
  onError,
  onProgress,
  resizeMode = 'cover',
  blurRadius,
  progressive = true,
}: LazyImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [lowQualityUri, setLowQualityUri] = useState<string | null>(null);
  const [highQualityUri, setHighQualityUri] = useState<string | null>(null);
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    loadImage();
  }, [source.uri, quality, maxWidth, maxHeight]);

  const loadImage = async () => {
    if (!source.uri) return;

    setIsLoading(true);
    setHasError(false);
    setCurrentUri(null);
    fadeAnim.setValue(0);
    progressAnim.setValue(0);

    try {
      if (progressive && quality === 'high') {
        // Progressive loading: low quality first, then high quality
        const { lowQuality, highQuality } = await mediaOptimizationService.lazyLoadMedia(
          source.uri,
          (progress) => {
            if (isMounted.current) {
              onProgress?.(progress);
              Animated.timing(progressAnim, {
                toValue: progress / 100,
                duration: 200,
                useNativeDriver: false,
              }).start();
            }
          }
        );

        if (isMounted.current) {
          // Show low quality first
          setLowQualityUri(lowQuality);
          setCurrentUri(lowQuality);
          setIsLoading(false);
          
          // Fade in low quality
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: fadeDuration / 2,
            useNativeDriver: true,
          }).start();

          // Load high quality in background
          setTimeout(() => {
            if (isMounted.current) {
              setHighQualityUri(highQuality);
              setCurrentUri(highQuality);
              
              // Smooth transition to high quality
              Animated.timing(fadeAnim, {
                toValue: 0,
                duration: fadeDuration / 4,
                useNativeDriver: true,
              }).start(() => {
                if (isMounted.current) {
                  Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: fadeDuration / 4,
                    useNativeDriver: true,
                  }).start();
                }
              });
            }
          }, 100);
        }
      } else {
        // Single quality loading
        const cachedUri = await mediaOptimizationService.getCachedMedia(source.uri, {
          quality,
          maxWidth,
          maxHeight,
        });

        if (isMounted.current) {
          setCurrentUri(cachedUri);
          setIsLoading(false);
          onProgress?.(100);
          
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: fadeDuration,
            useNativeDriver: true,
          }).start();
        }
      }

      if (isMounted.current) {
        onLoad?.();
      }
    } catch (error) {
      if (isMounted.current) {
        setHasError(true);
        setIsLoading(false);
        onError?.(error as Error);
      }
    }
  };

  const renderPlaceholder = () => {
    if (placeholder) {
      return placeholder;
    }

    return (
      <MotiView
        from={{ opacity: 0.3 }}
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{
          type: 'timing',
          duration: 1500,
          repeat: -1,
        }}
        style={[styles.placeholder, style]}
      >
        <ActivityIndicator size="small" color="#8B5CF6" />
      </MotiView>
    );
  };

  const renderError = () => (
    <View style={[styles.errorContainer, style]}>
      <View style={styles.errorIcon}>
        <ActivityIndicator size="small" color="#EF4444" />
      </View>
    </View>
  );

  const renderProgressBar = () => (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: isLoading ? 1 : 0 }}
      transition={{ type: 'timing', duration: 200 }}
      style={styles.progressContainer}
    >
      <Animated.View
        style={[
          styles.progressBar,
          {
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </MotiView>
  );

  if (hasError) {
    return renderError();
  }

  return (
    <View style={[styles.container, style]}>
      {/* Placeholder */}
      {isLoading && renderPlaceholder()}
      
      {/* Progress bar */}
      {progressive && renderProgressBar()}
      
      {/* Main image */}
      {currentUri && (
        <Animated.View
          style={[
            styles.imageContainer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <Image
            source={{ uri: currentUri }}
            style={[styles.image, style]}
            resizeMode={resizeMode}
            blurRadius={blurRadius}
            onLoad={() => {
              if (isMounted.current) {
                onLoad?.();
              }
            }}
            onError={(error) => {
              if (isMounted.current) {
                setHasError(true);
                setIsLoading(false);
                onError?.(new Error(error.nativeEvent.error));
              }
            }}
          />
        </Animated.View>
      )}
      
      {/* Low quality background (for progressive loading) */}
      {progressive && lowQualityUri && highQualityUri && currentUri === highQualityUri && (
        <View style={[styles.backgroundImage, style]}>
          <Image
            source={{ uri: lowQualityUri }}
            style={[styles.image, style]}
            resizeMode={resizeMode}
            blurRadius={2} // Slight blur for low quality
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#1F2937',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  placeholder: {
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  errorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#8B5CF6',
  },
});