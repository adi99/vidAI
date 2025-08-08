import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Download, Share2, Trash2, Eye } from 'lucide-react-native';
import { mediaService } from '@/services/mediaService';
import { formatFileSize, getImageGridSize } from '@/utils/imageUtils';

const { width: screenWidth } = Dimensions.get('window');

export interface MediaItem {
  id: string;
  uri: string;
  thumbnailUri?: string;
  type: 'image' | 'video';
  title?: string;
  createdAt: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

interface MediaGalleryProps {
  items: MediaItem[];
  onRefresh?: () => void;
  refreshing?: boolean;
  onItemPress?: (item: MediaItem) => void;
  onItemDelete?: (item: MediaItem) => void;
  numColumns?: number;
  showActions?: boolean;
  emptyMessage?: string;
}

export function MediaGallery({
  items,
  onRefresh,
  refreshing = false,
  onItemPress,
  onItemDelete,
  numColumns = 2,
  showActions = true,
  emptyMessage = 'No media files found',
}: MediaGalleryProps) {
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const itemSize = getImageGridSize(numColumns, 12);

  const handleDownload = async (item: MediaItem) => {
    try {
      setLoadingItems(prev => new Set(prev).add(item.id));
      
      const fileName = `${item.title || 'media'}_${Date.now()}.${item.type === 'image' ? 'jpg' : 'mp4'}`;
      await mediaService.downloadFile(item.uri, fileName);
      await mediaService.saveToGallery(item.uri);
      
    } catch (error) {
      console.error('Error downloading media:', error);
      Alert.alert('Error', 'Failed to download media file');
    } finally {
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };

  const handleShare = async (item: MediaItem) => {
    try {
      setLoadingItems(prev => new Set(prev).add(item.id));
      await mediaService.shareFile(item.uri, item.title);
    } catch (error) {
      console.error('Error sharing media:', error);
      Alert.alert('Error', 'Failed to share media file');
    } finally {
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };

  const handleDelete = (item: MediaItem) => {
    Alert.alert(
      'Delete Media',
      'Are you sure you want to delete this media file?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onItemDelete?.(item),
        },
      ]
    );
  };

  const renderMediaItem = ({ item }: { item: MediaItem }) => {
    const isLoading = loadingItems.has(item.id);

    return (
      <View style={[styles.mediaItem, { width: itemSize, height: itemSize }]}>
        <TouchableOpacity
          style={styles.mediaContainer}
          onPress={() => onItemPress?.(item)}
          disabled={isLoading}
        >
          {item.type === 'image' ? (
            <Image
              source={{ uri: item.thumbnailUri || item.uri }}
              style={styles.media}
              resizeMode="cover"
            />
          ) : (
            <Video
              source={{ uri: item.uri }}
              style={styles.media}
              shouldPlay={false}
              isLooping={false}
              isMuted={true}
              resizeMode={ResizeMode.COVER}
            />
          )}
          
          {/* Media type indicator */}
          <View style={styles.typeIndicator}>
            <Text style={styles.typeText}>
              {item.type === 'video' ? '📹' : '🖼️'}
            </Text>
          </View>

          {/* Loading overlay */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        {/* Media info */}
        <View style={styles.mediaInfo}>
          {item.title && (
            <Text style={styles.mediaTitle} numberOfLines={1}>
              {item.title}
            </Text>
          )}
          <Text style={styles.mediaDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
          {item.fileSize && (
            <Text style={styles.fileSize}>
              {formatFileSize(item.fileSize)}
            </Text>
          )}
        </View>

        {/* Action buttons */}
        {showActions && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onItemPress?.(item)}
              disabled={isLoading}
            >
              <Eye size={16} color="#666" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDownload(item)}
              disabled={isLoading}
            >
              <Download size={16} color="#666" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleShare(item)}
              disabled={isLoading}
            >
              <Share2 size={16} color="#666" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDelete(item)}
              disabled={isLoading}
            >
              <Trash2 size={16} color="#ff4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{emptyMessage}</Text>
    </View>
  );

  return (
    <FlatList
      data={items}
      renderItem={renderMediaItem}
      keyExtractor={(item) => item.id}
      numColumns={numColumns}
      contentContainerStyle={styles.container}
      onRefresh={onRefresh}
      refreshing={refreshing}
      ListEmptyComponent={renderEmpty}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    flexGrow: 1,
  },
  mediaItem: {
    margin: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mediaContainer: {
    position: 'relative',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: '70%',
  },
  typeIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeText: {
    fontSize: 12,
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
  mediaInfo: {
    padding: 8,
    flex: 1,
  },
  mediaTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  mediaDate: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 10,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f8f8f8',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});