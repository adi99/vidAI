import React, { useRef, useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

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
  const player = useVideoPlayer(source, (player) => {
    player.loop = isLooping;
    player.muted = false;
  });

  useEffect(() => {
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [shouldPlay, player]);

  return (
    <VideoView
      player={player}
      style={[styles.video, style]}
      contentFit="cover"
      allowsFullscreen
      allowsPictureInPicture
    />
  );
}

const styles = StyleSheet.create({
  video: {
    width: '100%',
    height: '100%',
  },
});