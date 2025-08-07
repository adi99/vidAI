import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

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
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (shouldPlay) {
        videoRef.current.play().catch(() => {
          // Handle autoplay restrictions
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [shouldPlay]);

  return (
    <View style={[styles.container, style]}>
      <video
        ref={videoRef}
        src={source.uri}
        loop={isLooping}
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
});