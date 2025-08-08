import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { VideoView, useVideoPlayer, VideoSource } from 'expo-video';
import { MotiView, MotiText } from 'moti';
import { useTheme, IconButton } from 'react-native-paper';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface GestureVideoPlayerProps {
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
}

const { width: screenWidth } = Dimensions.get('window');

export default function GestureVideoPlayer({
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
}: GestureVideoPlayerProps) {
  const theme = useTheme();
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(shouldPlay);
  const [isMutedState, setIsMutedState] = useState(isMuted);
  const [showControlsState, setShowControlsState] = useState(showControls);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);

  const player = useVideoPlayer(source, (player) => {
    player.loop = isLooping;
    player.muted = isMutedState;
  });

  const hideControlsAfterTimeout = useCallback(() => {
    if (!autoHideControls) return;
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControlsState(false);
    }, controlsTimeout);
  }, [autoHideControls, controlsTimeout]);

  const showControlsTemporarily = useCallback(() => {
    setShowControlsState(true);
    hideControlsAfterTimeout();
  }, [hideControlsAfterTimeout]);

  const handlePlayPause = useCallback(() => {
    try {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        player.play();
        setIsPlaying(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Play/pause error:', error);
    }
  }, [isPlaying, player]);

  const handleMuteToggle = useCallback(() => {
    try {
      player.muted = !isMutedState;
      setIsMutedState(!isMutedState);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Mute toggle error:', error);
    }
  }, [isMutedState, player]);

  const handleSeek = useCallback((seekTime: number) => {
    try {
      player.currentTime = seekTime / 1000; // expo-video uses seconds
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Seek error:', error);
    }
  }, [player]);

  const handleSkipForward = useCallback(() => {
    const newPosition = Math.min(position + 10000, duration); // Skip 10 seconds
    handleSeek(newPosition);
  }, [position, duration, handleSeek]);

  const handleSkipBackward = useCallback(() => {
    const newPosition = Math.max(position - 10000, 0); // Skip back 10 seconds
    handleSeek(newPosition);
  }, [position, handleSeek]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only respond to significant movements
      return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
    },
    
    onPanResponderGrant: () => {
      showControlsTemporarily();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    
    onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      // Handle horizontal swipe for seeking
      if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
        const seekPercentage = gestureState.dx / screenWidth;
        const seekTime = position + (seekPercentage * duration * 0.1); // 10% of duration per full swipe
        Math.max(0, Math.min(seekTime, duration));
        
        // Visual feedback for seeking (you could show a seek preview here)
        if (Math.abs(gestureState.dx) > 50) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    },
    
    onPanResponderRelease: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      // Handle tap to play/pause
      if (Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10) {
        handlePlayPause();
        return;
      }
      
      // Handle horizontal swipe for seeking
      if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 50) {
        const seekPercentage = gestureState.dx / screenWidth;
        const seekTime = position + (seekPercentage * duration * 0.1);
        const clampedSeekTime = Math.max(0, Math.min(seekTime, duration));
        handleSeek(clampedSeekTime);
      }
      
      // Handle vertical swipe for volume (you could implement volume control here)
      if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 50) {
        if (gestureState.dy < 0) {
          // Swipe up - could increase volume
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          // Swipe down - could decrease volume or mute
          handleMuteToggle();
        }
      }
    },
  });

  // Listen to player status changes
  useEffect(() => {
    const subscription = player.addListener('playingChange', (payload) => {
      setIsPlaying(payload.isPlaying);
    });

    return () => {
      subscription?.remove();
    };
  }, [player]);

  useEffect(() => {
    const subscription = player.addListener('timeUpdate', (payload) => {
      setPosition(payload.currentTime * 1000); // Convert to milliseconds
      setDuration(player.duration * 1000); // Convert to milliseconds
    });

    return () => {
      subscription?.remove();
    };
  }, [player]);

  useEffect(() => {
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [shouldPlay, player]);

  const formatTime = useCallback((timeMs: number) => {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <View style={[styles.container, style]} {...panResponder.panHandlers}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit={contentFit}
        allowsFullscreen
        allowsPictureInPicture
      />

      {/* Buffering indicator */}
      {isBuffering && (
        <MotiView
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{
            type: 'spring',
            damping: 15,
            stiffness: 300,
          }}
          style={[styles.bufferingIndicator, { backgroundColor: theme.colors.surface + 'CC' }]}
        >
          <MotiView
            animate={{ rotate: '360deg' }}
            transition={{
              type: 'timing',
              duration: 1000,
              repeat: -1,
            }}
          >
            <Play size={24} color={theme.colors.primary} />
          </MotiView>
        </MotiView>
      )}

      {/* Controls overlay */}
      {showControlsState && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            type: 'timing',
            duration: 200,
          }}
          style={styles.controlsOverlay}
        >
          {/* Top controls */}
          <View style={styles.topControls}>
            <IconButton
              icon={({ size, color }) => 
                isMutedState ? <VolumeX size={size} color={color} /> : <Volume2 size={size} color={color} />
              }
              iconColor={theme.colors.onSurface}
              onPress={handleMuteToggle}
              style={[styles.controlButton, { backgroundColor: theme.colors.surface + 'CC' }]}
            />
          </View>

          {/* Center controls */}
          <View style={styles.centerControls}>
            <IconButton
              icon={({ size, color }) => <SkipBack size={size} color={color} />}
              iconColor={theme.colors.onSurface}
              onPress={handleSkipBackward}
              style={[styles.controlButton, { backgroundColor: theme.colors.surface + 'CC' }]}
            />
            
            <IconButton
              icon={({ size, color }) => 
                isPlaying ? <Pause size={size} color={color} /> : <Play size={size} color={color} />
              }
              iconColor={theme.colors.onSurface}
              onPress={handlePlayPause}
              style={[styles.playButton, { backgroundColor: theme.colors.primary + 'CC' }]}
            />
            
            <IconButton
              icon={({ size, color }) => <SkipForward size={size} color={color} />}
              iconColor={theme.colors.onSurface}
              onPress={handleSkipForward}
              style={[styles.controlButton, { backgroundColor: theme.colors.surface + 'CC' }]}
            />
          </View>

          {/* Bottom controls */}
          <View style={styles.bottomControls}>
            <MotiText style={[styles.timeText, { color: theme.colors.onSurface }]}>
              {formatTime(position)}
            </MotiText>
            
            <View style={styles.progressContainer}>
              <View style={[styles.progressTrack, { backgroundColor: theme.colors.outline }]}>
                <MotiView
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{
                    type: 'timing',
                    duration: 100,
                  }}
                  style={[styles.progressFill, { backgroundColor: theme.colors.primary }]}
                />
              </View>
            </View>
            
            <MotiText style={[styles.timeText, { color: theme.colors.onSurface }]}>
              {formatTime(duration)}
            </MotiText>
          </View>
        </MotiView>
      )}
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
  bufferingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 16,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlButton: {
    margin: 0,
  },
  playButton: {
    margin: 0,
    transform: [{ scale: 1.2 }],
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'center',
  },
  progressContainer: {
    flex: 1,
    height: 20,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});