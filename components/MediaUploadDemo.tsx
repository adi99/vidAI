import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Upload, Camera, Video, Image as ImageIcon, Folder } from 'lucide-react-native';
import { useMediaManager } from '@/hooks/useMediaManager';
import { FileUpload } from './FileUpload';
import { MediaGallery, MediaItem } from './MediaGallery';
import { MediaPreview } from './MediaPreview';

interface MediaUploadDemoProps {
  bucket?: string;
  pathPrefix?: string;
  title?: string;
}

export function MediaUploadDemo({
  bucket = 'user-uploads',
  pathPrefix = 'demo/',
  title = 'Media Upload Demo',
}: MediaUploadDemoProps) {
  const [selectedFiles, setSelectedFiles] = useState<MediaItem[]>([]);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'gallery'>('upload');

  const mediaManager = useMediaManager({
    bucket,
    pathPrefix,
    allowedTypes: ['image', 'video'],
    compressionQuality: 0.8,
    autoUpload: false,
  });

  const handleQuickActions = async (action: 'photo' | 'video' | 'images' | 'videos' | 'media') => {
    try {
      let results;
      
      switch (action) {
        case 'photo':
          const photo = await mediaManager.takePhoto();
          if (photo) {
            results = [photo];
          }
          break;
        case 'video':
          const video = await mediaManager.recordVideo();
          if (video) {
            results = [video];
          }
          break;
        case 'images':
          results = await mediaManager.selectImages(5);
          break;
        case 'videos':
          results = await mediaManager.selectVideos(3);
          break;
        case 'media':
          results = await mediaManager.selectMedia(8);
          break;
      }

      if (results && results.length > 0) {
        // Convert to MediaItem format
        const mediaItems: MediaItem[] = results.map((result, index) => ({
          id: `${Date.now()}_${index}`,
          uri: result.uri,
          type: result.type === 'video' ? 'video' : 'image',
          title: `${result.type}_${Date.now()}`,
          createdAt: new Date().toISOString(),
          fileSize: result.fileSize,
          width: result.width,
          height: result.height,
        }));

        setSelectedFiles(prev => [...prev, ...mediaItems]);
        Alert.alert('Success', `Selected ${results.length} file(s)`);
      }
    } catch (error) {
      console.error('Error in quick action:', error);
      Alert.alert('Error', 'Failed to perform action');
    }
  };

  const handleUploadComplete = (uploadedFiles: any[]) => {
    Alert.alert('Upload Complete', `Successfully uploaded ${uploadedFiles.length} files`);
  };

  const handleItemPress = (item: MediaItem) => {
    setPreviewItem(item);
  };

  const handleItemDelete = (item: MediaItem) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== item.id));
    Alert.alert('Deleted', 'File removed from selection');
  };

  const handlePreviewEdit = (editedUri: string) => {
    if (previewItem) {
      setSelectedFiles(prev => prev.map(item => 
        item.id === previewItem.id 
          ? { ...item, uri: editedUri }
          : item
      ));
      setPreviewItem(prev => prev ? { ...prev, uri: editedUri } : null);
    }
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    Alert.alert('Cleared', 'All files removed from selection');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {mediaManager.isLoading && (
          <Text style={styles.loadingText}>Processing...</Text>
        )}
      </View>

      {/* Error Display */}
      {mediaManager.error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{mediaManager.error}</Text>
        </View>
      )}

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upload' && styles.activeTab]}
          onPress={() => setActiveTab('upload')}
        >
          <Upload size={20} color={activeTab === 'upload' ? '#2196F3' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'upload' && styles.activeTabText]}>
            Upload
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'gallery' && styles.activeTab]}
          onPress={() => setActiveTab('gallery')}
        >
          <Folder size={20} color={activeTab === 'gallery' ? '#2196F3' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'gallery' && styles.activeTabText]}>
            Gallery ({selectedFiles.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'upload' ? (
          <View>
            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => handleQuickActions('photo')}
                  disabled={mediaManager.isLoading}
                >
                  <Camera size={24} color="#2196F3" />
                  <Text style={styles.quickActionText}>Take Photo</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => handleQuickActions('video')}
                  disabled={mediaManager.isLoading}
                >
                  <Video size={24} color="#2196F3" />
                  <Text style={styles.quickActionText}>Record Video</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => handleQuickActions('images')}
                  disabled={mediaManager.isLoading}
                >
                  <ImageIcon size={24} color="#2196F3" />
                  <Text style={styles.quickActionText}>Pick Images</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => handleQuickActions('media')}
                  disabled={mediaManager.isLoading}
                >
                  <Folder size={24} color="#2196F3" />
                  <Text style={styles.quickActionText}>Pick Media</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* File Upload Component */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>File Upload</Text>
              <FileUpload
                onFilesUploaded={handleUploadComplete}
                maxFiles={10}
                allowedTypes={['image', 'video']}
                bucket={bucket}
                pathPrefix={pathPrefix}
                showPreview={true}
              />
            </View>
          </View>
        ) : (
          <View>
            {/* Gallery Actions */}
            {selectedFiles.length > 0 && (
              <View style={styles.galleryActions}>
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={clearSelection}
                >
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Media Gallery */}
            <MediaGallery
              items={selectedFiles}
              onItemPress={handleItemPress}
              onItemDelete={handleItemDelete}
              numColumns={2}
              showActions={true}
              emptyMessage="No files selected. Use the Upload tab to add files."
            />
          </View>
        )}
      </ScrollView>

      {/* Media Preview Modal */}
      {previewItem && (
        <MediaPreview
          visible={!!previewItem}
          onClose={() => setPreviewItem(null)}
          mediaUri={previewItem.uri}
          mediaType={previewItem.type}
          title={previewItem.title}
          onEdit={handlePreviewEdit}
          showEditOptions={previewItem.type === 'image'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  loadingText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ffcdd2',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#2196F3',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e3f2fd',
  },
  quickActionText: {
    marginTop: 8,
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
    textAlign: 'center',
  },
  galleryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#ff5722',
    borderRadius: 6,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});