import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MotiView } from 'moti';
import { Button, Surface, useTheme } from 'react-native-paper';
import { Camera, Image as ImageIcon, X, Smartphone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useImageUpload } from '@/hooks/useImageUpload';
import CameraModal from './CameraModal';

interface ImageUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onImageSelected: (uri: string) => void;
  title?: string;
  aspectRatio?: [number, number];
  quality?: number;
  showCameraOption?: boolean;
}

export default function ImageUploadModal({
  visible,
  onClose,
  onImageSelected,
  title = "Select Image",
  aspectRatio = [16, 9],
  quality = 0.8,
  showCameraOption = true,
}: ImageUploadModalProps) {
  const theme = useTheme();
  const { 
    isUploading, 
    takePhoto, 
    pickFromGallery, 
    hasCameraPermission, 
    hasLibraryPermission 
  } = useImageUpload();
  
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [permissions, setPermissions] = useState({
    camera: false,
    library: false,
  });

  // Check permissions on mount
  useEffect(() => {
    if (visible) {
      checkPermissions();
    }
  }, [visible]);

  const checkPermissions = useCallback(async () => {
    const [cameraPermission, libraryPermission] = await Promise.all([
      hasCameraPermission(),
      hasLibraryPermission(),
    ]);
    
    setPermissions({
      camera: cameraPermission,
      library: libraryPermission,
    });
  }, [hasCameraPermission, hasLibraryPermission]);

  const handleTakePhoto = useCallback(async () => {
    if (Platform.OS !== 'web' && showCameraOption) {
      // Use full-screen camera modal on mobile
      setCameraModalVisible(true);
    } else {
      // Fallback to image picker camera
      const uri = await takePhoto({ aspectRatio, quality });
      if (uri) {
        onImageSelected(uri);
        onClose();
      }
    }
  }, [takePhoto, aspectRatio, quality, onImageSelected, onClose, showCameraOption]);

  const handlePickFromGallery = useCallback(async () => {
    const uri = await pickFromGallery({ aspectRatio, quality });
    if (uri) {
      onImageSelected(uri);
      onClose();
    }
  }, [pickFromGallery, aspectRatio, quality, onImageSelected, onClose]);

  const handleCameraPhotoTaken = useCallback((uri: string) => {
    setCameraModalVisible(false);
    onImageSelected(uri);
    onClose();
  }, [onImageSelected, onClose]);

  const handleCloseCameraModal = useCallback(() => {
    setCameraModalVisible(false);
  }, []);

  const handleClose = useCallback(async () => {
    if (isUploading) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [isUploading, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <MotiView
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{
            type: 'spring',
            damping: 20,
            stiffness: 300,
          }}
          style={styles.modalContainer}
        >
          <Surface
            style={[styles.modal, { backgroundColor: theme.colors.surface }]}
            elevation={4}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                {title}
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={[styles.closeButton, { backgroundColor: theme.colors.outline + '20' }]}
                disabled={isUploading}
              >
                <X size={20} color={theme.colors.onSurface} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={[styles.subtitle, { color: theme.colors.onSurface + '80' }]}>
                Choose how you want to add an image
              </Text>

              <View style={styles.optionsContainer}>
                {/* Camera Option */}
                {showCameraOption && (
                  <TouchableOpacity
                    onPress={handleTakePhoto}
                    disabled={isUploading}
                    style={[styles.option, { opacity: isUploading ? 0.6 : 1 }]}
                  >
                    <LinearGradient
                      colors={['#8B5CF6', '#3B82F6']}
                      style={styles.optionGradient}
                    >
                      <View style={styles.optionIcon}>
                        {Platform.OS === 'web' ? (
                          <Smartphone size={32} color="#FFFFFF" />
                        ) : (
                          <Camera size={32} color="#FFFFFF" />
                        )}
                      </View>
                      <Text style={styles.optionTitle}>
                        {Platform.OS === 'web' ? 'Camera (Mobile Only)' : 'Take Photo'}
                      </Text>
                      <Text style={styles.optionDescription}>
                        {Platform.OS === 'web' 
                          ? 'Camera is available on mobile devices'
                          : permissions.camera 
                            ? 'Use your camera to take a new photo'
                            : 'Camera permission required'
                        }
                      </Text>
                      {!permissions.camera && Platform.OS !== 'web' && (
                        <View style={styles.permissionBadge}>
                          <Text style={styles.permissionBadgeText}>Permission needed</Text>
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* Gallery Option */}
                <TouchableOpacity
                  onPress={handlePickFromGallery}
                  disabled={isUploading}
                  style={[styles.option, { opacity: isUploading ? 0.6 : 1 }]}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.optionGradient}
                  >
                    <View style={styles.optionIcon}>
                      <ImageIcon size={32} color="#FFFFFF" />
                    </View>
                    <Text style={styles.optionTitle}>Choose from Gallery</Text>
                    <Text style={styles.optionDescription}>
                      {permissions.library || Platform.OS === 'web'
                        ? 'Select an existing photo from your gallery'
                        : 'Photo library permission required'
                      }
                    </Text>
                    {!permissions.library && Platform.OS !== 'web' && (
                      <View style={styles.permissionBadge}>
                        <Text style={styles.permissionBadgeText}>Permission needed</Text>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {isUploading && (
                <MotiView
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  style={styles.processingContainer}
                >
                  <Text style={[styles.processingText, { color: theme.colors.primary }]}>
                    Processing image...
                  </Text>
                </MotiView>
              )}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Button
                mode="outlined"
                onPress={handleClose}
                disabled={isUploading}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
            </View>
          </Surface>
        </MotiView>
      </View>

      {/* Camera Modal */}
      <CameraModal
        visible={cameraModalVisible}
        onClose={handleCloseCameraModal}
        onPhotoTaken={handleCameraPhotoTaken}
        aspectRatio={aspectRatio}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modal: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    paddingTop: 0,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 16,
  },
  option: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  optionGradient: {
    padding: 20,
    alignItems: 'center',
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
    textAlign: 'center',
  },
  processingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  processingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    paddingTop: 16,
    alignItems: 'center',
  },
  cancelButton: {
    borderRadius: 20,
    minWidth: 120,
  },
  permissionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  permissionBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});