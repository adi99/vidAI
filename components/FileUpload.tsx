import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Upload, X, CheckCircle, AlertCircle, Image as ImageIcon, Video } from 'lucide-react-native';
import { useImagePicker, ImagePickerResult } from '@/hooks/useImagePicker';
import { mediaService } from '@/services/mediaService';
import { formatFileSize } from '@/utils/imageUtils';

export interface UploadedFile {
  id: string;
  uri: string;
  fileName: string;
  fileSize: number;
  type: 'image' | 'video';
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
  uploadedUrl?: string;
}

interface FileUploadProps {
  onFilesUploaded: (files: UploadedFile[]) => void;
  maxFiles?: number;
  allowedTypes?: ('image' | 'video')[];
  bucket: string;
  pathPrefix?: string;
  showPreview?: boolean;
  disabled?: boolean;
}

export function FileUpload({
  onFilesUploaded,
  maxFiles = 10,
  allowedTypes = ['image', 'video'],
  bucket,
  pathPrefix = '',
  showPreview = true,
  disabled = false,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { pickImage, pickMultipleImages, takePhoto } = useImagePicker();

  const addFiles = (pickedFiles: ImagePickerResult[]) => {
    const newFiles: UploadedFile[] = pickedFiles.map((file, index) => ({
      id: `${Date.now()}_${index}`,
      uri: file.uri,
      fileName: `file_${Date.now()}_${index}.${file.type === 'image' ? 'jpg' : 'mp4'}`,
      fileSize: file.fileSize || 0,
      type: file.type === 'image' ? 'image' : 'video',
      status: 'pending',
      progress: 0,
    }));

    setFiles(prev => {
      const combined = [...prev, ...newFiles];
      return combined.slice(0, maxFiles);
    });
  };

  const handlePickImages = async () => {
    try {
      if (maxFiles === 1) {
        const result = await pickImage();
        if (result) {
          addFiles([result]);
        }
      } else {
        const results = await pickMultipleImages({ maxImages: maxFiles - files.length });
        if (results.length > 0) {
          addFiles(results);
        }
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const result = await takePhoto();
      if (result) {
        addFiles([result]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    const updatedFiles: UploadedFile[] = [];

    for (const file of files) {
      if (file.status === 'completed') {
        updatedFiles.push(file);
        continue;
      }

      // Update status to uploading
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'uploading', progress: 0 } : f
      ));

      try {
        // Validate file
        const validation = await mediaService.validateMediaFile(file.uri, file.type);
        if (!validation.isValid) {
          throw new Error(validation.error);
        }

        // Compress if it's an image
        let uploadUri = file.uri;
        if (file.type === 'image') {
          uploadUri = await mediaService.compressImage(file.uri, {
            quality: 0.8,
            maxWidth: 2048,
            maxHeight: 2048,
          });
        }

        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setFiles(prev => prev.map(f => 
            f.id === file.id && f.progress < 90 
              ? { ...f, progress: f.progress + 10 } 
              : f
          ));
        }, 200);

        // Upload to storage
        const fileName = mediaService.generateUniqueFileName(file.fileName, pathPrefix);
        const uploadedUrl = await mediaService.uploadToStorage(
          uploadUri,
          bucket,
          fileName,
          { contentType: file.type === 'image' ? 'image/jpeg' : 'video/mp4' }
        );

        clearInterval(progressInterval);

        // Update file status
        const completedFile: UploadedFile = {
          ...file,
          status: 'completed',
          progress: 100,
          uploadedUrl,
        };

        setFiles(prev => prev.map(f => 
          f.id === file.id ? completedFile : f
        ));

        updatedFiles.push(completedFile);

      } catch (error) {
        console.error(`Error uploading file ${file.id}:`, error);
        
        setFiles(prev => prev.map(f => 
          f.id === file.id 
            ? { 
                ...f, 
                status: 'error', 
                progress: 0, 
                error: error instanceof Error ? error.message : 'Upload failed' 
              } 
            : f
        ));
      }
    }

    setIsUploading(false);
    onFilesUploaded(updatedFiles);
  };

  const retryUpload = (fileId: string) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status: 'pending', progress: 0, error: undefined } : f
    ));
  };

  const renderFileItem = ({ item }: { item: UploadedFile }) => (
    <View style={styles.fileItem}>
      <View style={styles.fileIcon}>
        {item.type === 'image' ? (
          <ImageIcon size={24} color="#666" />
        ) : (
          <Video size={24} color="#666" />
        )}
      </View>
      
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {item.fileName}
        </Text>
        <Text style={styles.fileSize}>
          {formatFileSize(item.fileSize)}
        </Text>
        
        {item.status === 'uploading' && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${item.progress}%` }]} />
            <Text style={styles.progressText}>{item.progress}%</Text>
          </View>
        )}
        
        {item.error && (
          <Text style={styles.errorText} numberOfLines={2}>
            {item.error}
          </Text>
        )}
      </View>
      
      <View style={styles.fileActions}>
        {item.status === 'completed' && (
          <CheckCircle size={20} color="#4CAF50" />
        )}
        
        {item.status === 'error' && (
          <TouchableOpacity onPress={() => retryUpload(item.id)}>
            <AlertCircle size={20} color="#f44336" />
          </TouchableOpacity>
        )}
        
        {item.status === 'uploading' && (
          <ActivityIndicator size="small" color="#2196F3" />
        )}
        
        {(item.status === 'pending' || item.status === 'error') && (
          <TouchableOpacity onPress={() => removeFile(item.id)}>
            <X size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const canAddMore = files.length < maxFiles;
  const hasFiles = files.length > 0;
  const hasCompletedFiles = files.some(f => f.status === 'completed');
  const hasPendingFiles = files.some(f => f.status === 'pending' || f.status === 'error');

  return (
    <View style={styles.container}>
      {/* Upload Actions */}
      {canAddMore && !disabled && (
        <View style={styles.uploadActions}>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handlePickImages}
            disabled={isUploading}
          >
            <Upload size={20} color="#2196F3" />
            <Text style={styles.uploadButtonText}>
              {maxFiles === 1 ? 'Pick File' : 'Pick Files'}
            </Text>
          </TouchableOpacity>
          
          {allowedTypes.includes('image') && (
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={handleTakePhoto}
              disabled={isUploading}
            >
              <ImageIcon size={20} color="#2196F3" />
              <Text style={styles.uploadButtonText}>Take Photo</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* File List */}
      {hasFiles && showPreview && (
        <View style={styles.fileList}>
          <Text style={styles.fileListTitle}>
            Selected Files ({files.length}/{maxFiles})
          </Text>
          
          <FlatList
            data={files}
            renderItem={renderFileItem}
            keyExtractor={(item) => item.id}
            style={styles.fileListContainer}
          />
        </View>
      )}

      {/* Upload Button */}
      {hasPendingFiles && !disabled && (
        <TouchableOpacity
          style={[styles.uploadAllButton, isUploading && styles.uploadAllButtonDisabled]}
          onPress={uploadFiles}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Upload size={20} color="#fff" />
          )}
          <Text style={styles.uploadAllButtonText}>
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Status */}
      {hasCompletedFiles && (
        <Text style={styles.statusText}>
          {files.filter(f => f.status === 'completed').length} of {files.length} files uploaded successfully
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  uploadActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    marginLeft: 8,
    color: '#2196F3',
    fontWeight: '500',
  },
  fileList: {
    marginBottom: 16,
  },
  fileListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  fileListContainer: {
    maxHeight: 200,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  fileIcon: {
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  progressContainer: {
    position: 'relative',
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginTop: 4,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 2,
  },
  progressText: {
    position: 'absolute',
    right: 0,
    top: -16,
    fontSize: 10,
    color: '#666',
  },
  errorText: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 2,
  },
  fileActions: {
    marginLeft: 12,
  },
  uploadAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    marginBottom: 12,
  },
  uploadAllButtonDisabled: {
    backgroundColor: '#ccc',
  },
  uploadAllButtonText: {
    marginLeft: 8,
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  statusText: {
    textAlign: 'center',
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
  },
});