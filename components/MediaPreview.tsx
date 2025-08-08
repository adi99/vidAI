import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
  X,
  Download,
  Share2,
  Edit3,
  RotateCw,
  Crop,
  Palette,
  Play,
  Pause,
  Volume2,
  VolumeX
} from 'lucide-react-native';
import { mediaService } from '@/services/mediaService';
import { rotateImage, flipImage, resizeImage } from '@/utils/imageUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export interface MediaPreviewProps {
  visible: boolean;
  onClose: () => void;
  mediaUri: string;
  mediaType: 'image' | 'video';
  title?: string;
  onEdit?: (editedUri: string) => void;
  showEditOptions?: boolean;
}

export function MediaPreview({
  visible,
  onClose,
  mediaUri,
  mediaType,
  title,
  onEdit,
  showEditOptions = true,
}: MediaPreviewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);

  const player = useVideoPlayer(
    mediaType === 'video' ? { uri: mediaUri } : null,
    (player) => {
      if (player) {
        player.loop = true;
        player.muted = isMuted;
      }
    }
  );

  // Listen to player status changes
  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener('playingChange', (payload) => {
      setIsPlaying(payload.isPlaying);
    });

    return () => {
      subscription?.remove();
    };
  }, [player]);

  const handleDownload = async () => {
    try {
      setIsLoading(true);
      const fileName = `${title || 'media'}_${Date.now()}.${mediaType === 'image' ? 'jpg' : 'mp4'}`;
      await mediaService.downloadFile(mediaUri, fileName);
      await mediaService.saveToGallery(mediaUri);
    } catch (error) {
      console.error('Error downloading media:', error);
      Alert.alert('Error', 'Failed to download media file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      setIsLoading(true);
      await mediaService.shareFile(mediaUri, title);
    } catch (error) {
      console.error('Error sharing media:', error);
      Alert.alert('Error', 'Failed to share media file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRotate = async () => {
    if (mediaType !== 'image') return;

    try {
      setIsLoading(true);
      const rotatedUri = await rotateImage(mediaUri, 90);
      onEdit?.(rotatedUri);
      Alert.alert('Success', 'Image rotated successfully');
    } catch (error) {
      console.error('Error rotating image:', error);
      Alert.alert('Error', 'Failed to rotate image');
    } finally {
      setIsLoading(false);
      setShowEditMenu(false);
    }
  };

  const handleFlip = async (direction: 'horizontal' | 'vertical') => {
    if (mediaType !== 'image') return;

    try {
      setIsLoading(true);
      const flippedUri = await flipImage(mediaUri, direction);
      onEdit?.(flippedUri);
      Alert.alert('Success', `Image flipped ${direction}ly`);
    } catch (error) {
      console.error('Error flipping image:', error);
      Alert.alert('Error', 'Failed to flip image');
    } finally {
      setIsLoading(false);
      setShowEditMenu(false);
    }
  };

  const handleResize = async () => {
    if (mediaType !== 'image') return;

    Alert.alert(
      'Resize Image',
      'Choose a resize option:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Small (512px)', onPress: () => performResize(512, 512) },
        { text: 'Medium (1024px)', onPress: () => performResize(1024, 1024) },
        { text: 'Large (2048px)', onPress: () => performResize(2048, 2048) },
      ]
    );
  };

  const performResize = async (width: number, height: number) => {
    try {
      setIsLoading(true);
      const resizedUri = await resizeImage(mediaUri, width, height, true);
      onEdit?.(resizedUri);
      Alert.alert('Success', 'Image resized successfully');
    } catch (error) {
      console.error('Error resizing image:', error);
      Alert.alert('Error', 'Failed to resize image');
    } finally {
      setIsLoading(false);
      setShowEditMenu(false);
    }
  };

  const togglePlayback = () => {
    if (mediaType !== 'video' || !player) return;

    try {
      if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  const toggleMute = () => {
    if (mediaType !== 'video' || !player) return;

    try {
      player.muted = !isMuted;
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const renderEditMenu = () => (
    <Modal
      visible={showEditMenu}
      transparent
      animationType="slide"
      onRequestClose={() => setShowEditMenu(false)}
    >
      <View style={styles.editMenuOverlay}>
        <View style={styles.editMenu}>
          <View style={styles.editMenuHeader}>
            <Text style={styles.editMenuTitle}>Edit Options</Text>
            <TouchableOpacity onPress={() => setShowEditMenu(false)}>
              <X size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editOptions}>
            <TouchableOpacity style={styles.editOption} onPress={handleRotate}>
              <RotateCw size={20} color="#333" />
              <Text style={styles.editOptionText}>Rotate 90°</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editOption}
              onPress={() => handleFlip('horizontal')}
            >
              <Crop size={20} color="#333" />
              <Text style={styles.editOptionText}>Flip Horizontal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editOption}
              onPress={() => handleFlip('vertical')}
            >
              <Crop size={20} color="#333" />
              <Text style={styles.editOptionText}>Flip Vertical</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.editOption} onPress={handleResize}>
              <Palette size={20} color="#333" />
              <Text style={styles.editOptionText}>Resize</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#fff" />
          </TouchableOpacity>

          {title && (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          )}

          <View style={styles.headerActions}>
            {showEditOptions && mediaType === 'image' && (
              <TouchableOpacity
                onPress={() => setShowEditMenu(true)}
                style={styles.headerButton}
                disabled={isLoading}
              >
                <Edit3 size={20} color="#fff" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleShare}
              style={styles.headerButton}
              disabled={isLoading}
            >
              <Share2 size={20} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDownload}
              style={styles.headerButton}
              disabled={isLoading}
            >
              <Download size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Media Content */}
        <View style={styles.mediaContainer}>
          {mediaType === 'image' ? (
            <Image
              source={{ uri: mediaUri }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : (
            <VideoView
              player={player}
              style={styles.video}
              contentFit="contain"
              allowsFullscreen
              allowsPictureInPicture
            />
          )}

          {/* Video Controls */}
          {mediaType === 'video' && (
            <View style={styles.videoControls}>
              <TouchableOpacity onPress={togglePlayback} style={styles.playButton}>
                {isPlaying ? (
                  <Pause size={32} color="#fff" />
                ) : (
                  <Play size={32} color="#fff" />
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={toggleMute} style={styles.muteButton}>
                {isMuted ? (
                  <VolumeX size={24} color="#fff" />
                ) : (
                  <Volume2 size={24} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Loading Overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}

        {/* Edit Menu */}
        {renderEditMenu()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  image: {
    width: screenWidth,
    height: screenHeight * 0.7,
  },
  video: {
    width: screenWidth,
    height: screenHeight * 0.7,
  },
  videoControls: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 25,
    padding: 12,
  },
  muteButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  editMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  editMenu: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.6,
  },
  editMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  editMenuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  editOptions: {
    padding: 20,
  },
  editOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  editOptionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
});