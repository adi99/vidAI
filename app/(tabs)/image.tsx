import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Image,
  TouchableOpacity,
  TextInput,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Edit3, Wand as Wand2, Palette, Image as ImageIcon, Download, Share, Heart, Clock, Upload, Settings, ChevronDown } from 'lucide-react-native';
import { Provider as PaperProvider, DefaultTheme, SegmentedButtons } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useImagePicker } from '@/hooks/useImagePicker';
import { useImageGeneration } from '@/hooks/useImageGeneration';
import CreditDisplay from '@/components/CreditDisplay';
import CreditCostDisplay from '@/components/CreditCostDisplay';

// Import our new interactive components
import InteractiveSlider from '@/components/ui/InteractiveSlider';
import DragDropImageUpload from '@/components/ui/DragDropImageUpload';
import HapticButton from '@/components/ui/HapticButton';
import AnimatedTextInput from '@/components/ui/AnimatedTextInput';
import AdvancedSettingsPanel from '@/components/ui/AdvancedSettingsPanel';

// Import animation components for enhanced UX
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import SmoothProgressBar from '@/components/ui/SmoothProgressBar';
import GenerationProgress from '@/components/ui/GenerationProgress';
import StateTransition from '@/components/ui/StateTransition';
import AnimatedCard from '@/components/ui/AnimatedCard';

// Paper theme configuration
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#8B5CF6',
    surface: '#1E293B',
    background: '#0F172A',
    onSurface: '#FFFFFF',
    onBackground: '#FFFFFF',
    outline: '#334155',
  },
};

export default function ImageScreen() {
  const { user } = useAuth();
  const { pickImage, takePhoto } = useImagePicker();
  const {
    isGenerating,
    isEditing,
    generationProgress,
    editProgress,
    generatedImages,
    generateImage,
    editImage,
    enhancePrompt,
    uploadImage,
    cancelGeneration,
    clearError,
  } = useImageGeneration();

  const [activeTab, setActiveTab] = useState<'generate' | 'edit'>('generate');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('sdxl');
  const [selectedSize, setSelectedSize] = useState('1024x1024');
  const [selectedQuality, setSelectedQuality] = useState<'basic' | 'standard' | 'high'>('standard');
  const [promptEnhancement, setPromptEnhancement] = useState(true);
  const [selectedStyle, setSelectedStyle] = useState('Realistic');
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const [steps, setSteps] = useState(30);
  const [seed, setSeed] = useState('');
  const [generationType, setGenerationType] = useState<'text-to-image' | 'image-to-image'>('text-to-image');
  const [sourceImage, setSourceImage] = useState<{ uri: string; url?: string } | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [selectedEditTool, setSelectedEditTool] = useState<'inpaint' | 'outpaint' | 'restyle' | 'background_replace' | null>(null);
  const [editImageData, setEditImageData] = useState<{ uri: string; url?: string } | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  const models = [
    { id: 'sdxl', name: 'SDXL', description: 'High quality, versatile', speed: 'Fast' },
    { id: 'flux', name: 'FLUX', description: 'Ultra realistic results', speed: 'Medium' },
    { id: 'midjourney', name: 'Midjourney', description: 'Artistic and creative', speed: 'Slow' },
    { id: 'dalle3', name: 'DALL-E 3', description: 'Best text understanding', speed: 'Fast' }
  ];

  const sizes = [
    { value: '512x512', label: '512×512', aspect: 'Square' },
    { value: '768x768', label: '768×768', aspect: 'Square' },
    { value: '1024x1024', label: '1024×1024', aspect: 'Square' },
    { value: '1024x1536', label: '1024×1536', aspect: 'Portrait' },
    { value: '1536x1024', label: '1536×1024', aspect: 'Landscape' },
    { value: '1280x720', label: '1280×720', aspect: 'Widescreen' }
  ];

  const qualities = [
    { id: 'basic', name: 'Basic', description: 'Fast generation', credits: 1 },
    { id: 'standard', name: 'Standard', description: 'Balanced quality', credits: 2 },
    { id: 'high', name: 'High', description: 'Best quality', credits: 4 }
  ];

  const visualStyles = [
    { name: 'Realistic', emoji: '📸' },
    { name: 'Artistic', emoji: '🎨' },
    { name: 'Anime', emoji: '🌸' },
    { name: 'Cyberpunk', emoji: '🌆' },
    { name: 'Fantasy', emoji: '🧙‍♂️' },
    { name: 'Minimalist', emoji: '⚪' },
    { name: 'Vintage', emoji: '📼' },
    { name: 'Watercolor', emoji: '🖌️' }
  ];

  const promptSuggestions = [
    'A majestic dragon soaring through clouds',
    'Futuristic cityscape at night with neon lights',
    'Beautiful woman with flowing hair in sunlight',
    'Mystical forest with glowing mushrooms',
    'Steampunk mechanical creature',
    'Abstract geometric patterns in vibrant colors'
  ];

  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Error', 'Please enter a prompt');
      return;
    }

    if (generationType === 'image-to-image' && !sourceImage) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Error', 'Please select a source image for image-to-image generation');
      return;
    }

    // Haptic feedback for starting generation
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let initImageUrl: string | undefined;

      // Upload source image if needed
      if (generationType === 'image-to-image' && sourceImage) {
        if (!sourceImage.url) {
          initImageUrl = await uploadImage(sourceImage.uri);
        } else {
          initImageUrl = sourceImage.url;
        }
      }

      // Parse size
      const [width, height] = selectedSize.split('x').map(Number);

      // Generate image
      await generateImage({
        prompt: promptEnhancement ? await enhancePromptText(prompt) : prompt,
        negative_prompt: negativePrompt || undefined,
        model: selectedModel,
        quality: selectedQuality,
        width,
        height,
        init_image_url: initImageUrl,
        strength: generationType === 'image-to-image' ? 0.8 : undefined,
        metadata: {
          style: selectedStyle,
          guidance_scale: guidanceScale,
          steps,
          seed: seed || undefined,
        },
      });
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Generation error:', error);
      Alert.alert('Error', error.message || 'Failed to generate image');
    }
  };

  const handleEditImage = async () => {
    if (!editPrompt.trim()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Error', 'Please describe what you want to edit');
      return;
    }

    if (!selectedEditTool) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Error', 'Please select an editing tool');
      return;
    }

    if (!editImageData) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Error', 'Please upload an image to edit');
      return;
    }

    // Haptic feedback for starting edit
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Upload edit image if needed
      let imageUrl: string;
      if (!editImageData.url) {
        imageUrl = await uploadImage(editImageData.uri);
      } else {
        imageUrl = editImageData.url;
      }

      // Edit image
      await editImage({
        image_url: imageUrl,
        prompt: editPrompt,
        negative_prompt: negativePrompt || undefined,
        edit_type: selectedEditTool,
        strength: 0.8,
        guidance_scale: guidanceScale,
        steps,
        metadata: {
          tool: selectedEditTool,
        },
      });
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Edit error:', error);
      Alert.alert('Error', error.message || 'Failed to edit image');
    }
  };

  const selectSourceImage = async () => {
    try {
      const result = await pickImage({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result) {
        setSourceImage({ uri: result.uri });
        Alert.alert('Success', 'Source image selected for image-to-image generation');
      }
    } catch (error) {
      console.error('Error selecting source image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const selectEditImage = async () => {
    try {
      const result = await pickImage({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result) {
        setEditImageData({ uri: result.uri });
        Alert.alert('Success', 'Image selected for editing');
      }
    } catch (error) {
      console.error('Error selecting edit image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const enhancePromptText = async (text: string): Promise<string> => {
    if (!promptEnhancement) return text;

    try {
      setIsEnhancing(true);
      const result = await enhancePrompt(text);
      return result.enhanced_prompt;
    } catch (error) {
      console.error('Error enhancing prompt:', error);
      return text;
    } finally {
      setIsEnhancing(false);
    }
  };

  const TabButton = ({
    tab,
    icon,
    title,
    subtitle
  }: {
    tab: 'generate' | 'edit';
    icon: React.ReactNode;
    title: string;
    subtitle: string;
  }) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
      onPress={() => setActiveTab(tab)}
    >
      <View style={styles.tabIconContainer}>
        {icon}
      </View>
      <View style={styles.tabTextContainer}>
        <Text style={[styles.tabButtonText, activeTab === tab && styles.activeTabButtonText]}>
          {title}
        </Text>
        <Text style={[styles.tabSubtitle, activeTab === tab && styles.activeTabSubtitle]}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const ModelCard = ({ model }: { model: any }) => (
    <AnimatedCard
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedModel(model.id);
      }}
      selected={selectedModel === model.id}
      hapticFeedback={false} // We handle haptics manually
      glowOnSelect={true}
      style={styles.modelCard}
    >
      <View style={styles.modelHeader}>
        <Text style={styles.modelName}>{model.name}</Text>
        <View style={[
          styles.speedBadge,
          model.speed === 'Fast' && styles.fastBadge,
          model.speed === 'Medium' && styles.mediumBadge,
          model.speed === 'Slow' && styles.slowBadge
        ]}>
          <Text style={styles.speedText}>{model.speed}</Text>
        </View>
      </View>
      <Text style={styles.modelDescription}>{model.description}</Text>
    </AnimatedCard>
  );

  const SizeCard = ({ size }: { size: any }) => (
    <AnimatedCard
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedSize(size.value);
      }}
      selected={selectedSize === size.value}
      hapticFeedback={false} // We handle haptics manually
      glowOnSelect={true}
      style={styles.sizeCard}
    >
      <Text style={styles.sizeLabel}>{size.label}</Text>
      <Text style={styles.sizeAspect}>{size.aspect}</Text>
    </AnimatedCard>
  );

  const QualityCard = ({ quality }: { quality: any }) => (
    <AnimatedCard
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedQuality(quality.id);
      }}
      selected={selectedQuality === quality.id}
      hapticFeedback={false} // We handle haptics manually
      glowOnSelect={true}
      style={styles.qualityCard}
    >
      <Text style={styles.qualityName}>{quality.name}</Text>
      <Text style={styles.qualityDescription}>{quality.description}</Text>
      <View style={styles.creditsContainer}>
        <Text style={styles.creditsText}>{quality.credits} credits</Text>
      </View>
    </AnimatedCard>
  );

  const StyleButton = ({ style }: { style: any }) => (
    <AnimatedCard
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedStyle(style.name);
      }}
      selected={selectedStyle === style.name}
      hapticFeedback={false} // We handle haptics manually
      glowOnSelect={true}
      style={styles.styleButton}
      padding={12}
      margin={4}
    >
      <Text style={styles.styleEmoji}>{style.emoji}</Text>
      <Text style={[
        styles.styleButtonText,
        selectedStyle === style.name && styles.selectedStyleButtonText
      ]}>
        {style.name}
      </Text>
    </AnimatedCard>
  );

  const PromptSuggestion = ({ suggestion }: { suggestion: string }) => (
    <AnimatedCard
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPrompt(suggestion);
      }}
      style={styles.suggestionChip}
      padding={8}
      margin={4}
      hapticFeedback={false} // We handle haptics manually
    >
      <Text style={styles.suggestionText}>{suggestion}</Text>
    </AnimatedCard>
  );

  const renderGenerateTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.generationTypeSection}>
        <Text style={styles.sectionTitle}>Generation Type</Text>
        <View style={styles.generationTypeContainer}>
          <TouchableOpacity
            style={[
              styles.generationTypeButton,
              generationType === 'text-to-image' && styles.selectedGenerationType
            ]}
            onPress={() => setGenerationType('text-to-image')}
          >
            <Sparkles size={20} color={generationType === 'text-to-image' ? '#FFFFFF' : '#94A3B8'} />
            <Text style={[
              styles.generationTypeText,
              generationType === 'text-to-image' && styles.selectedGenerationTypeText
            ]}>
              Text to Image
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.generationTypeButton,
              generationType === 'image-to-image' && styles.selectedGenerationType
            ]}
            onPress={() => setGenerationType('image-to-image')}
          >
            <ImageIcon size={20} color={generationType === 'image-to-image' ? '#FFFFFF' : '#94A3B8'} />
            <Text style={[
              styles.generationTypeText,
              generationType === 'image-to-image' && styles.selectedGenerationTypeText
            ]}>
              Image to Image
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {generationType === 'image-to-image' && (
        <View style={styles.sourceImageSection}>
          <Text style={styles.inputLabel}>Source Image</Text>
          <TouchableOpacity style={styles.sourceImageButton} onPress={selectSourceImage}>
            {sourceImage ? (
              <View style={styles.sourceImageSelected}>
                <Image source={{ uri: sourceImage.uri }} style={styles.sourceImagePreview} />
                <Text style={styles.sourceImageSelectedText}>Image Selected</Text>
              </View>
            ) : (
              <View style={styles.sourceImagePlaceholder}>
                <Upload size={24} color="#6B7280" />
                <Text style={styles.sourceImagePlaceholderText}>Select source image</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.promptSection}>
        <Text style={styles.inputLabel}>
          {generationType === 'text-to-image' ? 'Describe your image' : 'Describe the changes'}
        </Text>
        <View style={styles.promptContainer}>
          <TextInput
            style={styles.textInput}
            value={prompt}
            onChangeText={setPrompt}
            placeholder={
              generationType === 'text-to-image'
                ? "A beautiful landscape with mountains and lakes at sunset..."
                : "Change the sky to sunset colors, add more trees..."
            }
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity
            style={[styles.enhanceButton, isEnhancing && styles.enhanceButtonLoading]}
            onPress={() => enhancePromptText(prompt).then(setPrompt)}
            disabled={isEnhancing}
          >
            <Wand2 size={16} color={isEnhancing ? "#6B7280" : "#8B5CF6"} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.suggestionsScroll}
        >
          {promptSuggestions.map((suggestion, index) => (
            <PromptSuggestion key={index} suggestion={suggestion} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.negativePromptSection}>
        <Text style={styles.inputLabel}>Negative prompt (optional)</Text>
        <TextInput
          style={styles.negativeInput}
          value={negativePrompt}
          onChangeText={setNegativePrompt}
          placeholder="blurry, low quality, distorted..."
          placeholderTextColor="#6B7280"
          multiline
          numberOfLines={2}
        />
      </View>

      <View style={styles.modelSection}>
        <Text style={styles.sectionTitle}>AI Model</Text>
        <View style={styles.modelsGrid}>
          {modelsLoading ? (
            <LoadingSkeleton type="card" count={4} height={120} />
          ) : (
            models.map((model) => (
              <ModelCard key={model.name} model={model} />
            ))
          )}
        </View>
      </View>

      <View style={styles.sizeSection}>
        <Text style={styles.sectionTitle}>Image Size</Text>
        <View style={styles.sizesGrid}>
          {sizes.map((size) => (
            <SizeCard key={size.value} size={size} />
          ))}
        </View>
      </View>

      <View style={styles.qualitySection}>
        <Text style={styles.sectionTitle}>Quality & Speed</Text>
        <View style={styles.qualitiesGrid}>
          {qualities.map((quality) => (
            <QualityCard key={quality.name} quality={quality} />
          ))}
        </View>
      </View>

      <View style={styles.styleSection}>
        <Text style={styles.sectionTitle}>Visual Style</Text>
        <View style={styles.styleGrid}>
          {visualStyles.map((style) => (
            <StyleButton key={style.name} style={style} />
          ))}
        </View>
      </View>

      <View style={styles.advancedSection}>
        <TouchableOpacity style={styles.advancedHeader}>
          <Settings size={20} color="#8B5CF6" />
          <Text style={styles.advancedTitle}>Advanced Settings</Text>
          <ChevronDown size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <View style={styles.advancedContent}>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Guidance Scale: {guidanceScale}</Text>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${(guidanceScale / 20) * 100}%` }]} />
            </View>
          </View>

          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Steps: {steps}</Text>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${(steps / 50) * 100}%` }]} />
            </View>
          </View>

          <View style={styles.seedContainer}>
            <Text style={styles.seedLabel}>Seed (optional)</Text>
            <TextInput
              style={styles.seedInput}
              value={seed}
              onChangeText={setSeed}
              placeholder="Random"
              placeholderTextColor="#6B7280"
            />
          </View>
        </View>
      </View>

      <View style={styles.enhancementSection}>
        <View style={styles.switchContainer}>
          <View style={styles.switchContent}>
            <Text style={styles.switchLabel}>Prompt Enhancement</Text>
            <Text style={styles.switchDescription}>
              AI will improve your prompt for better results
            </Text>
          </View>
          <Switch
            value={promptEnhancement}
            onValueChange={setPromptEnhancement}
            trackColor={{ false: '#374151', true: '#8B5CF6' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <CreditCostDisplay
        generationType="image"
        options={{
          quality: selectedQuality,
          model: selectedModel,
        }}
        style={{ marginBottom: 24 }}
      />

      <GenerationProgress
        progress={generationProgress}
        type="image"
        isActive={isGenerating}
        onCancel={cancelGeneration}
        estimatedTime={120} // 2 minutes in seconds
        showSteps={true}
      />

      <TouchableOpacity
        style={[styles.generateButton, isGenerating && styles.generatingButton]}
        onPress={handleGenerateImage}
        disabled={isGenerating}
      >
        <LinearGradient
          colors={isGenerating ? ['#6B7280', '#6B7280'] : ['#8B5CF6', '#3B82F6']}
          style={styles.generateGradient}
        >
          {isGenerating ? (
            <Wand2 size={24} color="#FFFFFF" />
          ) : (
            <Sparkles size={24} color="#FFFFFF" />
          )}
          <Text style={styles.generateButtonText}>
            {isGenerating ? 'Generating...' : 'Generate Image'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderEditTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.uploadSection}>
        <TouchableOpacity style={styles.uploadButton} onPress={selectEditImage}>
          {editImageData ? (
            <View style={styles.uploadedImageContainer}>
              <Image source={{ uri: editImageData.uri }} style={styles.uploadedImage} />
              <Text style={styles.uploadedImageText}>Image Ready for Editing</Text>
            </View>
          ) : (
            <>
              <LinearGradient
                colors={['#8B5CF6', '#EC4899']}
                style={styles.uploadGradient}
              >
                <Upload size={32} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.uploadTitle}>Upload Image to Edit</Text>
              <Text style={styles.uploadSubtitle}>
                Select from gallery or use a generated image
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.editPromptSection}>
        <Text style={styles.inputLabel}>Describe your edit</Text>
        <TextInput
          style={styles.editPromptInput}
          value={editPrompt}
          onChangeText={setEditPrompt}
          placeholder="Change the hair color to blonde, add sunglasses..."
          placeholderTextColor="#6B7280"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.editToolsSection}>
        <Text style={styles.sectionTitle}>Editing Tools</Text>

        <TouchableOpacity
          style={[
            styles.editTool,
            selectedEditTool === 'restyle' && styles.selectedEditTool
          ]}
          onPress={() => setSelectedEditTool('restyle')}
        >
          <LinearGradient
            colors={['#F59E0B', '#EF4444']}
            style={styles.editToolIcon}
          >
            <Palette size={24} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.editToolContent}>
            <Text style={styles.editToolTitle}>Restyle</Text>
            <Text style={styles.editToolDescription}>
              Transform style and appearance with AI precision
            </Text>
          </View>
          <View style={styles.editToolBadge}>
            <Text style={styles.editToolBadgeText}>PRO</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.editTool,
            selectedEditTool === 'inpaint' && styles.selectedEditTool
          ]}
          onPress={() => setSelectedEditTool('inpaint')}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.editToolIcon}
          >
            <Edit3 size={24} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.editToolContent}>
            <Text style={styles.editToolTitle}>Inpaint</Text>
            <Text style={styles.editToolDescription}>
              Fill in or modify specific areas of the image
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.editTool,
            selectedEditTool === 'outpaint' && styles.selectedEditTool
          ]}
          onPress={() => setSelectedEditTool('outpaint')}
        >
          <LinearGradient
            colors={['#8B5CF6', '#3B82F6']}
            style={styles.editToolIcon}
          >
            <Wand2 size={24} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.editToolContent}>
            <Text style={styles.editToolTitle}>Outpaint</Text>
            <Text style={styles.editToolDescription}>
              Extend the image beyond its original boundaries
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.editTool,
            selectedEditTool === 'background_replace' && styles.selectedEditTool
          ]}
          onPress={() => setSelectedEditTool('background_replace')}
        >
          <LinearGradient
            colors={['#EC4899', '#BE185D']}
            style={styles.editToolIcon}
          >
            <ImageIcon size={24} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.editToolContent}>
            <Text style={styles.editToolTitle}>Background Replace</Text>
            <Text style={styles.editToolDescription}>
              Change backgrounds while preserving the subject
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <CreditCostDisplay
        generationType="editing"
        options={{
          editType: selectedEditTool === 'background_replace' || selectedEditTool === 'restyle' ? 'advanced' : 'basic',
        }}
        style={{ marginBottom: 24 }}
      />

      <GenerationProgress
        progress={editProgress}
        type="edit"
        isActive={isEditing}
        onCancel={cancelGeneration}
        estimatedTime={90} // 1.5 minutes in seconds
        showSteps={true}
      />

      <TouchableOpacity
        style={[styles.generateButton, isEditing && styles.generatingButton]}
        onPress={handleEditImage}
        disabled={isEditing}
      >
        <LinearGradient
          colors={isEditing ? ['#6B7280', '#6B7280'] : ['#8B5CF6', '#3B82F6']}
          style={styles.generateGradient}
        >
          {isEditing ? (
            <Wand2 size={24} color="#FFFFFF" />
          ) : (
            <Edit3 size={24} color="#FFFFFF" />
          )}
          <Text style={styles.generateButtonText}>
            {isEditing ? 'Editing...' : 'Apply Edit'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {generatedImages.length > 0 && (
        <View style={styles.recentEditsSection}>
          <Text style={styles.sectionTitle}>Generated Images</Text>
          <View style={styles.recentEditsGrid}>
            {generatedImages.slice(0, 4).map((imageUrl, index) => (
              <TouchableOpacity key={index} style={styles.recentEditCard}>
                <Image source={{ uri: imageUrl }} style={styles.generatedImagePreview} />
                <View style={styles.recentEditActions}>
                  <TouchableOpacity style={styles.recentEditAction}>
                    <Heart size={16} color="#EF4444" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.recentEditAction}>
                    <Download size={16} color="#8B5CF6" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.recentEditAction}>
                    <Share size={16} color="#10B981" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <PaperProvider theme={theme}>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#EC4899', '#8B5CF6', '#3B82F6']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>AI Image Studio</Text>
            <Text style={styles.headerSubtitle}>
              Create and edit stunning images with advanced AI
            </Text>
            <CreditDisplay size="medium" />
          </View>
        </LinearGradient>

        <View style={styles.tabContainer}>
          <SegmentedButtons
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'generate' | 'edit')}
            buttons={[
              {
                value: 'generate',
                label: 'Generate',
                icon: ({ size, color }) => <Sparkles size={size} color={color} />,
              },
              {
                value: 'edit',
                label: 'Edit',
                icon: ({ size, color }) => <Edit3 size={size} color={color} />,
              },
            ]}
            style={styles.segmentedButtons}
          />
        </View>

        <StateTransition 
          state={activeTab} 
          type="slide" 
          direction="up"
          duration={300}
        >
          {activeTab === 'generate' ? renderGenerateTab() : renderEditTab()}
        </StateTransition>
        </ScrollView>
      </SafeAreaView>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 30,
    paddingTop: 60,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#E5E7EB',
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 16,
  },
  creditsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  creditsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    margin: 20,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 6,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  activeTabButton: {
    backgroundColor: '#334155',
  },
  tabIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabTextContainer: {
    flex: 1,
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94A3B8',
  },
  activeTabButtonText: {
    color: '#FFFFFF',
  },
  tabSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  activeTabSubtitle: {
    color: '#CBD5E1',
  },
  tabContent: {
    padding: 20,
  },
  promptSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  promptContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    paddingRight: 50,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#334155',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  enhanceButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsScroll: {
    marginTop: 8,
  },
  suggestionChip: {
    backgroundColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  suggestionText: {
    fontSize: 14,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  negativePromptSection: {
    marginBottom: 24,
  },
  negativeInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  modelSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  modelsGrid: {
    gap: 12,
  },
  modelCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedModelCard: {
    borderColor: '#8B5CF6',
    backgroundColor: '#312E81',
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  speedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fastBadge: {
    backgroundColor: '#10B981',
  },
  mediumBadge: {
    backgroundColor: '#F59E0B',
  },
  slowBadge: {
    backgroundColor: '#EF4444',
  },
  speedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modelDescription: {
    fontSize: 14,
    color: '#94A3B8',
  },
  sizeSection: {
    marginBottom: 24,
  },
  sizesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedSizeCard: {
    borderColor: '#8B5CF6',
    backgroundColor: '#312E81',
  },
  sizeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sizeAspect: {
    fontSize: 12,
    color: '#94A3B8',
  },
  qualitySection: {
    marginBottom: 24,
  },
  qualitiesGrid: {
    gap: 12,
  },
  qualityCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedQualityCard: {
    borderColor: '#8B5CF6',
    backgroundColor: '#312E81',
  },
  qualityName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  qualityDescription: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  headerCreditsContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerCreditsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FCD34D',
  },
  styleSection: {
    marginBottom: 24,
  },
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedStyleButton: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  styleEmoji: {
    fontSize: 16,
  },
  styleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  selectedStyleButtonText: {
    color: '#FFFFFF',
  },
  advancedSection: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  advancedTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  advancedContent: {
    padding: 16,
    paddingTop: 0,
    gap: 16,
  },
  sliderContainer: {
    gap: 8,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sliderTrack: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 3,
  },
  seedContainer: {
    gap: 8,
  },
  seedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  seedInput: {
    backgroundColor: '#334155',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#FFFFFF',
  },
  enhancementSection: {
    marginBottom: 24,
  },
  switchContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  switchContent: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 14,
    color: '#94A3B8',
  },
  progressSection: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  generateButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  generatingButton: {
    opacity: 0.7,
  },
  generateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  uploadSection: {
    marginBottom: 32,
  },
  uploadButton: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 32,
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 16,
  },
  uploadGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  uploadSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  editToolsSection: {
    marginBottom: 32,
  },
  editTool: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
    position: 'relative',
  },
  editToolIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editToolContent: {
    flex: 1,
  },
  editToolTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  editToolDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 18,
  },
  editToolBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editToolBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recentEditsSection: {
    marginBottom: 32,
  },
  recentEditsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recentEditCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
  },
  recentEditPlaceholder: {
    aspectRatio: 1,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentEditActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
  },
  recentEditAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  generationTypeSection: {
    marginBottom: 24,
  },
  generationTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  generationTypeButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedGenerationType: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  generationTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  selectedGenerationTypeText: {
    color: '#FFFFFF',
  },
  sourceImageSection: {
    marginBottom: 24,
  },
  sourceImageButton: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  sourceImagePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sourceImagePlaceholderText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  sourceImageSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sourceImageSelectedText: {
    fontSize: 16,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  editPromptSection: {
    marginBottom: 24,
  },
  editPromptInput: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#334155',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  selectedEditTool: {
    borderColor: '#8B5CF6',
    backgroundColor: '#312E81',
  },
  sourceImagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 8,
  },
  enhanceButtonLoading: {
    opacity: 0.5,
  },
  uploadedImageContainer: {
    alignItems: 'center',
    gap: 12,
  },
  uploadedImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  uploadedImageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  generatedImagePreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  segmentedButtons: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
  },
});

