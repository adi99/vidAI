import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import { Surface, useTheme } from 'react-native-paper';
import { Upload, Image as ImageIcon, X, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import ImageUploadModal from './ImageUploadModal';

interface ImageUploadButtonProps {
  onImageSelected: (uri: string) => void;
  onImageRemoved?: () => void;
  selectedImage?: string | null;
  placeholder?: string;
  aspectRatio?: [number, number];
  maxWidth?: number;
  maxHeight?: number;
  disabled?: boolean;
  title?: string;
  quality?: number;
  showCameraOption?: boolean;
}

export default function ImageUploadButton({
  onImageSelected,
  onImageRemoved,
  selectedImage,
  placeholder = "Tap to upload an image",
  aspectRatio = [16, 9],
  maxWidth = 300,
  maxHeight = 200,
  disabled = false,
  title = "Select Image",
  quality = 0.8,
  showCameraOption = true,
}: ImageUploadButtonProps) {
  const theme = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const handlePress = useCallback(async () => {
    if (disabled) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(true);
  }, [disabled]);

  const handleImageSelected = useCallback((uri: string) => {
    onImageSelected(uri);
    setModalVisible(false);
  }, [onImageSelected]);

  const handleRemoveImage = useCallback(async () => {
    if (disabled) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onImageRemoved?.();
  }, [disabled, onImageRemoved]);

  const closeModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  return (
    <>
      <MotiView
        animate={{
          opacity: disabled ? 0.6 : 1,
        }}
        transition={{
          type: 'spring',
          damping: 20,
          stiffness: 300,
        }}
        style={[styles.container, { maxWidth, maxHeight }]}
      >
        <Surface
          style={[
            styles.surface,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline,
            }
          ]}
          elevation={1}
        >
          {selectedImage ? (
            <MotiView
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                type: 'spring',
                damping: 15,
                stiffness: 200,
              }}
              style={styles.imageContainer}
            >
              <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
              
              {/* Success indicator */}
              <MotiView
                from={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: 'spring',
                  damping: 15,
                  stiffness: 300,
                  delay: 200,
                }}
                style={[styles.successIndicator, { backgroundColor: theme.colors.primary }]}
              >
                <Check size={16} color={theme.colors.onPrimary} />
              </MotiView>

              {/* Remove button */}
              <TouchableOpacity
                onPress={handleRemoveImage}
                style={[styles.removeButton, { backgroundColor: theme.colors.error }]}
                disabled={disabled}
              >
                <X size={16} color={theme.colors.onError} />
              </TouchableOpacity>

              {/* Change image overlay */}
              <TouchableOpacity
                onPress={handlePress}
                style={styles.changeOverlay}
                disabled={disabled}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(0, 0, 0, 0.7)']}
                  style={styles.changeGradient}
                >
                  <Text style={styles.changeText}>Tap to change</Text>
                </LinearGradient>
              </TouchableOpacity>
            </MotiView>
          ) : (
            <TouchableOpacity
              onPress={handlePress}
              disabled={disabled}
              style={styles.uploadArea}
            >
              <LinearGradient
                colors={[
                  theme.colors.primary + '20',
                  theme.colors.primary + '10',
                  'transparent'
                ]}
                style={styles.gradientBackground}
              />
              
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                <ImageIcon size={32} color={theme.colors.primary} />
              </View>

              <Text style={[styles.placeholderText, { color: theme.colors.onSurface }]}>
                {placeholder}
              </Text>

              <View style={[styles.uploadButton, { borderColor: theme.colors.primary }]}>
                <Upload size={16} color={theme.colors.primary} />
                <Text style={[styles.uploadButtonText, { color: theme.colors.primary }]}>
                  Select Image
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </Surface>
      </MotiView>

      <ImageUploadModal
        visible={modalVisible}
        onClose={closeModal}
        onImageSelected={handleImageSelected}
        title={title}
        aspectRatio={aspectRatio}
        quality={quality}
        showCameraOption={showCameraOption}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  surface: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    minHeight: 150,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  selectedImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  successIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  changeGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  uploadArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
    padding: 20,
    position: 'relative',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});