import React, { useRef, useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

interface VideoPlayerProps {
  source: { uri: string };
  shouldPlay: boolean;
  isLooping?: boolean;
  style?: ViewStyle;
}

export default function VideoPlayer({ 
  source, 
  shouldPlay, 
  isLooping = true, 
  style 
}: VideoPlayerProps) {
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (shouldPlay) {
        videoRef.current.playAsync();
      } else {
        videoRef.current.pauseAsync();
      }
    }
  }, [shouldPlay]);

  return (
    <Video
      ref={videoRef}
      source={source}
      style={[styles.video, style]}
      isLooping={isLooping}
      shouldPlay={shouldPlay}
      isMuted={false}
      resizeMode={ResizeMode.COVER}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    width: '100%',
    height: '100%',
  },
});