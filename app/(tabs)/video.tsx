import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Platform,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Type, Image, SkipForward, Play, Clock, Film, Wand as Wand2, Check } from 'lucide-react-native';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import CreditDisplay from '@/components/CreditDisplay';
import CreditCostDisplay from '@/components/CreditCostDisplay';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';

// Import our new interactive components
import InteractiveSlider from '@/components/ui/InteractiveSlider';
import ImageUploadButton from '@/components/ui/ImageUploadButton';
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

export default function VideoScreen() {
  const { session } = useAuth();
  const [selectedMode, setSelectedMode] = useState<'text' | 'image' | 'frame'>('text');
  const [prompt, setPrompt] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('5s');
  const [selectedQuality, setSelectedQuality] = useState('Standard');
  const [selectedModel, setSelectedModel] = useState('runwayml-gen3');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [motionStrength, setMotionStrength] = useState(5);
  const [promptEnhancement, setPromptEnhancement] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [firstFrame, setFirstFrame] = useState<string | null>(null);
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const {
    isGenerating,
    progress,
    error,
    generateTextToVideo,
    generateImageToVideo,
    generateFrameInterpolation,
    cancelGeneration,
    enhancePrompt,
    calculateCost,
  } = useVideoGeneration({
    onProgress: (progress, status) => {
      console.log(`Generation progress: ${progress}% (${status})`);
      // Haptic feedback on progress milestones
      if (progress > 0 && progress % 25 === 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    onComplete: async (result) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Video Generated!',
        'Your AI video has been successfully created.',
        [
          { text: 'View in Feed', onPress: () => {/* Navigate to feed */ } },
          { text: 'OK' }
        ]
      );
    },
    onError: async (error) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Generation Failed', error);
    },
  });

  const videoModels = [
    {
      id: 'runwayml-gen3',
      name: 'RunwayML Gen-3',
      description: 'Latest generation model with superior quality',
      speed: 'Fast',
      credits: 10
    },
    {
      id: 'pika-labs',
      name: 'Pika Labs',
      description: 'Great for creative and artistic videos',
      speed: 'Medium',
      credits: 8
    },
    {
      id: 'stable-video-diffusion',
      name: 'Stable Video Diffusion',
      description: 'Open source model with good results',
      speed: 'Slow',
      credits: 6
    },
    {
      id: 'zeroscope',
      name: 'Zeroscope',
      description: 'Optimized for text-to-video generation',
      speed: 'Fast',
      credits: 7
    }
  ];

  const durations = [
    { value: '3s', label: '3 seconds', credits: 5 },
    { value: '5s', label: '5 seconds', credits: 8 },
    { value: '10s', label: '10 seconds', credits: 15 },
    { value: '15s', label: '15 seconds', credits: 25 }
  ];

  const qualities = [
    { name: 'Basic', description: 'Fast generation, good quality', credits: 1, resolution: '512p' },
    { name: 'Standard', description: 'Balanced quality and speed', credits: 2, resolution: '720p' },
    { name: 'High', description: 'Best quality, slower generation', credits: 4, resolution: '1080p' }
  ];

  const aspectRatios = [
    { value: '16:9', label: 'Landscape', icon: '📺' },
    { value: '9:16', label: 'Portrait', icon: '📱' },
    { value: '1:1', label: 'Square', icon: '⬜' },
    { value: '4:3', label: 'Classic', icon: '📷' }
  ];

  const defaultPromptSuggestions = [
    'A majestic dragon flying through storm clouds',
    'Futuristic city with flying cars at sunset',
    'Ocean waves crashing against rocky cliffs',
    'Magical forest with glowing fireflies',
    'Space station orbiting a distant planet',
    'Vintage car driving through neon-lit streets'
  ];

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;

    try {
      const result = await enhancePrompt(prompt);
      setEnhancedPrompt(result.enhanced);
      setPromptSuggestions(result.suggestions);

      // Haptic feedback for successful enhancement
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Prompt Enhanced',
        'Your prompt has been enhanced with AI suggestions.',
        [
          { text: 'Use Enhanced', onPress: () => setPrompt(result.enhanced) },
          { text: 'Keep Original', style: 'cancel' }
        ]
      );
    } catch (error) {
      // Haptic feedback for error
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to enhance prompt. Please try again.');
    }
  };



  const generateVideo = async () => {
    if (!session?.user) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Login Required', 'Please log in to generate videos');
      return;
    }

    // Validation based on mode
    if (selectedMode === 'text' && !prompt.trim()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Error', 'Please enter a prompt');
      return;
    }

    if (selectedMode === 'image' && !selectedImage) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Error', 'Please select an image to animate');
      return;
    }

    if (selectedMode === 'frame' && (!firstFrame || !lastFrame)) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Error', 'Please select both first and last frames');
      return;
    }

    // Haptic feedback for starting generation
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      switch (selectedMode) {
        case 'text':
          await generateTextToVideo({
            prompt,
            model: selectedModel,
            duration: selectedDuration,
            quality: selectedQuality,
            aspectRatio,
            motionStrength,
            enhancePrompt: promptEnhancement,
          });
          break;

        case 'image':
          await generateImageToVideo({
            imageUri: selectedImage!,
            prompt: prompt || 'Animate this image with natural movement',
            model: selectedModel,
            duration: selectedDuration,
            quality: selectedQuality,
            aspectRatio,
            motionStrength,
          });
          break;

        case 'frame':
          await generateFrameInterpolation({
            firstFrameUri: firstFrame!,
            lastFrameUri: lastFrame!,
            duration: selectedDuration,
            quality: selectedQuality,
          });
          break;
      }
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Generation error:', error);
    }
  };

  const VideoModeCard = ({
    mode,
    icon,
    title,
    description,
    badge
  }: {
    mode: 'text' | 'image' | 'frame';
    icon: React.ReactNode;
    title: string;
    description: string;
    badge?: string;
  }) => (
    <AnimatedCard
      onPress={() => setSelectedMode(mode)}
      selected={selectedMode === mode}
      hapticFeedback={true}
      glowOnSelect={true}
      gradient={selectedMode === mode}
      gradientColors={selectedMode === mode ? ['#8B5CF6', '#3B82F6'] : undefined}
      style={styles.modeCard}
    >
      {badge && (
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText}>{badge}</Text>
        </View>
      )}
      <LinearGradient
        colors={selectedMode === mode ? ['#8B5CF6', '#3B82F6'] : ['#374151', '#374151']}
        style={styles.modeIconContainer}
      >
        {icon}
      </LinearGradient>
      <Text style={[styles.modeTitle, selectedMode === mode && styles.selectedModeTitle]}>
        {title}
      </Text>
      <Text style={[styles.modeDescription, selectedMode === mode && styles.selectedModeDescription]}>
        {description}
      </Text>
    </AnimatedCard>
  );

  const ModelCard = ({ model }: { model: any }) => (
    <AnimatedCard
      onPress={() => setSelectedModel(model.id)}
      selected={selectedModel === model.id}
      hapticFeedback={true}
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
      <View style={styles.modelFooter}>
        <Text style={styles.modelCredits}>{model.credits} credits</Text>
      </View>
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

  const renderTextToVideo = () => (
    <View style={styles.inputSection}>
      <AnimatedTextInput
        label="Describe your video"
        value={prompt}
        onChangeText={setPrompt}
        placeholder="A majestic dragon soaring through storm clouds with lightning..."
        multiline
        numberOfLines={4}
        maxLength={500}
        showCharacterCount
        right={
          <HapticButton
            mode="text"
            onPress={handleEnhancePrompt}
            icon={({ size, color }) => <Wand2 size={size} color={color} />}
            compact
            hapticType="light"
          >
            Enhance
          </HapticButton>
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.suggestionsScroll}
      >
        {(promptSuggestions.length > 0 ? promptSuggestions : defaultPromptSuggestions).map((suggestion, index) => (
          <PromptSuggestion key={index} suggestion={suggestion} />
        ))}
      </ScrollView>

      {enhancedPrompt && (
        <View style={styles.enhancedPromptContainer}>
          <Text style={styles.enhancedPromptLabel}>Enhanced Prompt:</Text>
          <Text style={styles.enhancedPromptText}>{enhancedPrompt}</Text>
          <AnimatedCard
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setPrompt(enhancedPrompt);
            }}
            style={styles.useEnhancedButton}
            padding={8}
            margin={0}
            hapticFeedback={false} // We handle haptics manually
          >
            <Check size={16} color="#10B981" />
            <Text style={styles.useEnhancedText}>Use Enhanced</Text>
          </AnimatedCard>
        </View>
      )}
    </View>
  );

  const renderImageToVideo = () => (
    <View style={styles.inputSection}>
      <ImageUploadButton
        onImageSelected={setSelectedImage}
        onImageRemoved={() => setSelectedImage(null)}
        selectedImage={selectedImage}
        placeholder="Tap to upload an image to animate"
        aspectRatio={[16, 9]}
        title="Select Image to Animate"
        quality={0.8}
      />

      {selectedImage && (
        <AnimatedTextInput
          label="Animation Description (Optional)"
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Describe how you want the image to move..."
          multiline
          numberOfLines={3}
          maxLength={200}
          showCharacterCount
        />
      )}

      <InteractiveSlider
        label="Motion Strength"
        value={motionStrength}
        onValueChange={setMotionStrength}
        minimumValue={1}
        maximumValue={10}
        step={1}
        unit=""
        showValue
      />
    </View>
  );

  const renderFrameInterpolation = () => (
    <View style={styles.inputSection}>
      <Text style={styles.inputLabel}>Upload first and last frames</Text>
      <View style={styles.frameUploadContainer}>
        <ImageUploadButton
          onImageSelected={setFirstFrame}
          onImageRemoved={() => setFirstFrame(null)}
          selectedImage={firstFrame}
          placeholder="First Frame"
          aspectRatio={[16, 9]}
          maxWidth={150}
          maxHeight={100}
          title="Select First Frame"
        />

        <View style={styles.frameArrow}>
          <SkipForward size={20} color="#8B5CF6" />
        </View>

        <ImageUploadButton
          onImageSelected={setLastFrame}
          onImageRemoved={() => setLastFrame(null)}
          selectedImage={lastFrame}
          placeholder="Last Frame"
          aspectRatio={[16, 9]}
          maxWidth={150}
          maxHeight={100}
          title="Select Last Frame"
        />
      </View>
    </View>
  );

  return (
    <PaperProvider theme={theme}>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={['#8B5CF6', '#3B82F6']}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>AI Video Studio</Text>
              <Text style={styles.headerSubtitle}>
                Transform your imagination into stunning videos
              </Text>
              <CreditDisplay size="medium" />
            </View>
          </LinearGradient>

          <View style={styles.content}>
            <View style={styles.modesSection}>
              <Text style={styles.sectionTitle}>Creation Mode</Text>
              <View style={styles.modesContainer}>
                <VideoModeCard
                  mode="text"
                  icon={<Type size={28} color="#FFFFFF" />}
                  title="Text to Video"
                  description="Generate videos from text descriptions"
                  badge="POPULAR"
                />
                <VideoModeCard
                  mode="image"
                  icon={<Image size={28} color="#FFFFFF" />}
                  title="Image to Video"
                  description="Animate static images into videos"
                />
                <VideoModeCard
                  mode="frame"
                  icon={<SkipForward size={28} color="#FFFFFF" />}
                  title="Frame Interpolation"
                  description="Create smooth transitions between frames"
                  badge="PRO"
                />
              </View>
            </View>

            <StateTransition 
              state={selectedMode} 
              type="slide" 
              direction="up"
              duration={300}
            >
              {selectedMode === 'text' && renderTextToVideo()}
              {selectedMode === 'image' && renderImageToVideo()}
              {selectedMode === 'frame' && renderFrameInterpolation()}
            </StateTransition>

            <View style={styles.modelSection}>
              <Text style={styles.sectionTitle}>AI Model</Text>
              <View style={styles.modelsGrid}>
                {modelsLoading ? (
                  <LoadingSkeleton type="card" count={4} height={120} />
                ) : (
                  videoModels.map((model) => (
                    <ModelCard key={model.name} model={model} />
                  ))
                )}
              </View>
            </View>

            <View style={styles.settingsGrid}>
              <View style={styles.settingColumn}>
                <Text style={styles.settingTitle}>Duration</Text>
                <View style={styles.optionsContainer}>
                  {durations.map((duration) => (
                    <AnimatedCard
                      key={duration.value}
                      onPress={() => setSelectedDuration(duration.value)}
                      selected={selectedDuration === duration.value}
                      hapticFeedback={true}
                      style={styles.optionButton}
                      padding={12}
                      margin={4}
                    >
                      <Text style={[
                        styles.optionText,
                        selectedDuration === duration.value && styles.selectedOptionText
                      ]}>
                        {duration.label}
                      </Text>
                      <Text style={styles.optionCredits}>{duration.credits}c</Text>
                    </AnimatedCard>
                  ))}
                </View>
              </View>

              <View style={styles.settingColumn}>
                <Text style={styles.settingTitle}>Quality</Text>
                <View style={styles.optionsContainer}>
                  {qualities.map((quality) => (
                    <AnimatedCard
                      key={quality.name}
                      onPress={() => setSelectedQuality(quality.name)}
                      selected={selectedQuality === quality.name}
                      hapticFeedback={true}
                      style={styles.optionButton}
                      padding={12}
                      margin={4}
                    >
                      <Text style={[
                        styles.optionText,
                        selectedQuality === quality.name && styles.selectedOptionText
                      ]}>
                        {quality.name}
                      </Text>
                      <Text style={styles.optionSubtext}>{quality.resolution}</Text>
                    </AnimatedCard>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.aspectRatioSection}>
              <Text style={styles.sectionTitle}>Aspect Ratio</Text>
              <View style={styles.aspectRatioGrid}>
                {aspectRatios.map((ratio) => (
                  <AnimatedCard
                    key={ratio.value}
                    onPress={() => setAspectRatio(ratio.value)}
                    selected={aspectRatio === ratio.value}
                    hapticFeedback={true}
                    style={styles.aspectRatioButton}
                    padding={16}
                    margin={4}
                  >
                    <Text style={styles.aspectRatioEmoji}>{ratio.icon}</Text>
                    <Text style={[
                      styles.aspectRatioText,
                      aspectRatio === ratio.value && styles.selectedAspectRatioText
                    ]}>
                      {ratio.label}
                    </Text>
                    <Text style={styles.aspectRatioValue}>{ratio.value}</Text>
                  </AnimatedCard>
                ))}
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

            <AdvancedSettingsPanel
              title="Advanced Settings"
              settings={[
                {
                  id: 'motion-strength',
                  type: 'slider',
                  label: 'Motion Strength',
                  value: motionStrength,
                  onValueChange: (value) => setMotionStrength(value as number),
                  minimumValue: 1,
                  maximumValue: 10,
                  step: 1,
                  unit: '',
                },
                {
                  id: 'prompt-enhancement',
                  type: 'switch',
                  label: 'Prompt Enhancement',
                  value: promptEnhancement,
                  onValueChange: (value) => setPromptEnhancement(value as boolean),
                },
                {
                  id: 'enhance-prompt-btn',
                  type: 'button',
                  label: 'Enhance Current Prompt',
                  value: false,
                  onValueChange: () => { },
                  onPress: handleEnhancePrompt,
                  buttonText: 'Enhance with AI',
                  buttonMode: 'outlined',
                },
              ]}
              expanded={false}
            />

            <View style={styles.costSection}>
              <Text style={styles.costLabel}>Estimated Cost:</Text>
              <Text style={styles.costValue}>
                {calculateCost({
                  type: selectedMode === 'text' ? 'text_to_video' :
                    selectedMode === 'image' ? 'image_to_video' : 'frame_interpolation',
                  duration: selectedDuration,
                  quality: selectedQuality.toLowerCase(),
                })} credits
              </Text>
            </View>

            <GenerationProgress
              progress={progress}
              type="video"
              isActive={isGenerating}
              onCancel={cancelGeneration}
              estimatedTime={300} // 5 minutes in seconds
              showSteps={true}
            />

            {error && (
              <View style={styles.errorSection}>
                <Text style={styles.errorText}>Generation Failed</Text>
                <Text style={styles.errorMessage}>{error}</Text>
              </View>
            )}

            <HapticButton
              mode="contained"
              onPress={generateVideo}
              disabled={isGenerating}
              loading={isGenerating}
              icon={({ size, color }) =>
                isGenerating ? (
                  <Clock size={size} color={color} />
                ) : (
                  <Play size={size} color={color} />
                )
              }
              buttonColor={isGenerating ? '#6B7280' : '#8B5CF6'}
              hapticType={isGenerating ? 'light' : 'medium'}
              style={styles.generateButton}
              contentStyle={styles.generateButtonContent}
            >
              {isGenerating ? 'Generating Video...' : 'Generate Video'}
            </HapticButton>
          </View>
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
  content: {
    padding: 20,
  },
  modesSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  modesContainer: {
    gap: 12,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    gap: 16,
  },
  modeBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  selectedModeTitle: {
    color: '#FFFFFF',
  },
  modeDescription: {
    fontSize: 13,
    color: '#94A3B8',
    flex: 2,
    lineHeight: 18,
  },
  selectedModeDescription: {
    color: '#CBD5E1',
  },
  inputSection: {
    marginBottom: 32,
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
    minHeight: 120,
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
    marginRight: 8,
  },
  suggestionText: {
    fontSize: 14,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  uploadArea: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 32,
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 16,
  },
  uploadIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  uploadSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  motionSection: {
    marginTop: 20,
  },
  motionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  frameUploadContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  frameUpload: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8,
  },
  frameUploadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  frameArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelSection: {
    marginBottom: 32,
  },
  modelsGrid: {
    gap: 12,
  },
  modelCard: {
    // AnimatedCard handles styling
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
    marginBottom: 8,
  },
  modelFooter: {
    alignItems: 'flex-start',
  },
  modelCredits: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FCD34D',
  },
  settingsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  settingColumn: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    alignItems: 'center',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 2,
  },
  selectedOptionText: {
    color: '#FFFFFF',
  },
  optionCredits: {
    fontSize: 12,
    color: '#FCD34D',
    fontWeight: '600',
  },
  optionSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  aspectRatioSection: {
    marginBottom: 32,
  },
  aspectRatioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  aspectRatioButton: {
    alignItems: 'center',
    minWidth: 80,
  },
  aspectRatioEmoji: {
    fontSize: 20,
    marginBottom: 8,
  },
  aspectRatioText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
  },
  selectedAspectRatioText: {
    color: '#FFFFFF',
  },
  aspectRatioValue: {
    fontSize: 10,
    color: '#6B7280',
  },
  enhancementSection: {
    marginBottom: 32,
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
  advancedSection: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginBottom: 32,
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
  },
  sliderSection: {
    gap: 8,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sliderContainer: {
    marginVertical: 8,
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
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabelText: {
    fontSize: 12,
    color: '#6B7280',
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
    gap: 8,
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
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  progressSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
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
  selectedImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#1E293B',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeImageButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeImageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  frameUploadSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#312E81',
  },
  frameImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  removeFrameButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enhancedPromptContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  enhancedPromptLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 8,
  },
  enhancedPromptText: {
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 20,
    marginBottom: 12,
  },
  useEnhancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  useEnhancedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  costSection: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  costValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FCD34D',
  },
  cancelButton: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorSection: {
    backgroundColor: '#7F1D1D',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FCA5A5',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#FED7D7',
    lineHeight: 20,
  },
  generateButtonContent: {
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
});

