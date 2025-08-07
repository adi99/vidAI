import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  Animated,
} from 'react-native';
import { Heart, MessageCircle, Share, MoveVertical as MoreVertical, Play, Pause, Volume2, VolumeX, Bookmark, User, EggFried as Verified } from 'lucide-react-native';
import VideoPlayer from '@/components/VideoPlayer';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const mockVideos = [
  {
    id: '1',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    title: 'Futuristic Cyberpunk City',
    description: 'A breathtaking AI-generated cyberpunk cityscape with neon lights, flying cars, and towering skyscrapers in the rain',
    author: '@ai_visionary',
    authorVerified: true,
    avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop',
    likes: 125000,
    comments: 3240,
    shares: 890,
    bookmarks: 1200,
    isLiked: false,
    isBookmarked: false,
    duration: '0:15',
    model: 'RunwayML Gen-3',
    prompt: 'cyberpunk city at night, neon lights, flying cars, rain, cinematic',
  },
  {
    id: '2',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    title: 'Mystical Ocean Waves',
    description: 'Peaceful golden hour ocean scene with magical particles floating above the waves, created with advanced AI',
    author: '@ocean_dreams',
    authorVerified: false,
    avatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop',
    likes: 89000,
    comments: 1560,
    shares: 450,
    bookmarks: 780,
    isLiked: true,
    isBookmarked: true,
    duration: '0:12',
    model: 'Pika Labs',
    prompt: 'golden hour ocean waves, magical particles, peaceful, cinematic lighting',
  },
  {
    id: '3',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    title: 'Enchanted Forest Portal',
    description: 'A magical portal opening in an ancient forest with glowing particles and ethereal light beams',
    author: '@fantasy_realm',
    authorVerified: true,
    avatar: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop',
    likes: 157000,
    comments: 4320,
    shares: 1230,
    bookmarks: 2100,
    isLiked: false,
    isBookmarked: false,
    duration: '0:18',
    model: 'Stable Video Diffusion',
    prompt: 'magical forest portal, glowing particles, ethereal light, fantasy',
  },
];

export default function FeedScreen() {
  const [videos, setVideos] = useState(mockVideos);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const toggleLike = (videoId: string) => {
    setVideos(prev =>
      prev.map(video =>
        video.id === videoId
          ? {
              ...video,
              isLiked: !video.isLiked,
              likes: video.isLiked ? video.likes - 1 : video.likes + 1,
            }
          : video
      )
    );
    
    // Animate like action
    Animated.sequence([
      Animated.timing(fadeAnim, { duration: 100, toValue: 0.7, useNativeDriver: true }),
      Animated.timing(fadeAnim, { duration: 100, toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  const toggleBookmark = (videoId: string) => {
    setVideos(prev =>
      prev.map(video =>
        video.id === videoId
          ? {
              ...video,
              isBookmarked: !video.isBookmarked,
              bookmarks: video.isBookmarked ? video.bookmarks - 1 : video.bookmarks + 1,
            }
          : video
      )
    );
  };

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

  const renderVideo = ({ item, index }: { item: any; index: number }) => (
    <View style={styles.videoContainer}>
      <VideoPlayer
        source={{ uri: item.url }}
        shouldPlay={index === currentIndex && isPlaying}
        isLooping
        style={styles.video}
      />
      
      {/* Top overlay with model info */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={styles.topOverlay}
      >
        <View style={styles.modelBadge}>
          <Text style={styles.modelText}>{item.model}</Text>
        </View>
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{item.duration}</Text>
        </View>
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
            <Text style={styles.author}>{item.author}</Text>
            {item.authorVerified && (
              <Verified size={16} color="#3B82F6" fill="#3B82F6" />
            )}
          </View>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={styles.promptContainer}>
            <Text style={styles.promptLabel}>Prompt:</Text>
            <Text style={styles.promptText} numberOfLines={1}>
              "{item.prompt}"
            </Text>
          </View>
        </View>
        
        <View style={styles.rightActions}>
          <ActionButton
            icon={
              <Heart
                size={28}
                color={item.isLiked ? '#EF4444' : '#FFFFFF'}
                fill={item.isLiked ? '#EF4444' : 'transparent'}
              />
            }
            count={item.likes}
            onPress={() => toggleLike(item.id)}
            isActive={item.isLiked}
            activeColor="#EF4444"
          />
          
          <ActionButton
            icon={<MessageCircle size={28} color="#FFFFFF" />}
            count={item.comments}
            onPress={() => {}}
          />
          
          <ActionButton
            icon={
              <Bookmark
                size={28}
                color={item.isBookmarked ? '#F59E0B' : '#FFFFFF'}
                fill={item.isBookmarked ? '#F59E0B' : 'transparent'}
              />
            }
            count={item.bookmarks}
            onPress={() => toggleBookmark(item.id)}
            isActive={item.isBookmarked}
            activeColor="#F59E0B"
          />
          
          <ActionButton
            icon={<Share size={28} color="#FFFFFF" />}
            count={item.shares}
            onPress={() => {}}
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

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={videos}
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
      />
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
});