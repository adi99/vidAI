import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Type, Image, SkipForward, Play, Upload, Wand as Wand2, Sparkles, Clock, Zap, Crown, Settings, ChevronDown, Film, Palette, Camera } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import CreditDisplay from '@/components/CreditDisplay';
import CreditCostDisplay from '@/components/CreditCostDisplay';

export default function VideoScreen() {
  const { credits, isSubscribed, validateCredits, getCreditCost } = useAuth();
  const [selectedMode, setSelectedMode] = useState<'text' | 'image' | 'frame'>('text');
  const [prompt, setPrompt] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('5s');
  const [selectedQuality, setSelectedQuality] = useState('Standard');
  const [selectedModel, setSelectedModel] = useState('RunwayML Gen-3');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [motionStrength, setMotionStrength] = useState(5);
  const [promptEnhancement, setPromptEnhancement] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  const videoModels = [
    { 
      name: 'RunwayML Gen-3', 
      description: 'Latest generation model with superior quality',
      speed: 'Fast',
      credits: 10
    },
    { 
      name: 'Pika Labs', 
      description: 'Great for creative and artistic videos',
      speed: 'Medium',
      credits: 8
    },
    { 
      name: 'Stable Video Diffusion', 
      description: 'Open source model with good results',
      speed: 'Slow',
      credits: 6
    },
    { 
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

  const promptSuggestions = [
    'A majestic dragon flying through storm clouds',
    'Futuristic city with flying cars at sunset',
    'Ocean waves crashing against rocky cliffs',
    'Magical forest with glowing fireflies',
    'Space station orbiting a distant planet',
    'Vintage car driving through neon-lit streets'
  ];

  const generateVideo = async () => {
    if (!prompt.trim() && selectedMode === 'text') {
      Alert.alert('Error', 'Please enter a prompt');
      return;
    }

    // Validate credits before generation
    const validation = await validateCredits('video', {
      duration: selectedDuration as '3s' | '5s' | '10s' | '15s',
      quality: selectedQuality.toLowerCase() as 'basic' | 'standard' | 'high',
    });

    if (!validation.valid) {
      Alert.alert('Insufficient Credits', validation.message || 'Not enough credits for this generation');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    // Simulate generation progress
    const interval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          Alert.alert('Success', 'Your video has been generated!');
          return 100;
        }
        return prev + 5;
      });
    }, 500);
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
    <TouchableOpacity
      style={[
        styles.modeCard,
        selectedMode === mode && styles.selectedModeCard
      ]}
      onPress={() => setSelectedMode(mode)}
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
    </TouchableOpacity>
  );

  const ModelCard = ({ model }: { model: any }) => (
    <TouchableOpacity
      style={[
        styles.modelCard,
        selectedModel === model.name && styles.selectedModelCard
      ]}
      onPress={() => setSelectedModel(model.name)}
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
    </TouchableOpacity>
  );

  const PromptSuggestion = ({ suggestion }: { suggestion: string }) => (
    <TouchableOpacity
      style={styles.suggestionChip}
      onPress={() => setPrompt(suggestion)}
    >
      <Text style={styles.suggestionText}>{suggestion}</Text>
    </TouchableOpacity>
  );

  const renderTextToVideo = () => (
    <View style={styles.inputSection}>
      <Text style={styles.inputLabel}>Describe your video</Text>
      <View style={styles.promptContainer}>
        <TextInput
          style={styles.textInput}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="A majestic dragon soaring through storm clouds with lightning..."
          placeholderTextColor="#6B7280"
          multiline
          numberOfLines={4}
        />
        <TouchableOpacity style={styles.enhanceButton}>
          <Wand2 size={16} color="#8B5CF6" />
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
  );

  const renderImageToVideo = () => (
    <View style={styles.inputSection}>
      <Text style={styles.inputLabel}>Upload image to animate</Text>
      <TouchableOpacity style={styles.uploadArea}>
        <LinearGradient
          colors={['#8B5CF6', '#EC4899']}
          style={styles.uploadIcon}
        >
          <Camera size={32} color="#FFFFFF" />
        </LinearGradient>
        <Text style={styles.uploadTitle}>Select Image</Text>
        <Text style={styles.uploadSubtitle}>
          Choose from gallery or use a generated image
        </Text>
      </TouchableOpacity>
      
      <View style={styles.motionSection}>
        <Text style={styles.motionLabel}>Motion Strength: {motionStrength}</Text>
        <View style={styles.sliderContainer}>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${(motionStrength / 10) * 100}%` }]} />
          </View>
        </View>
      </View>
    </View>
  );

  const renderFrameInterpolation = () => (
    <View style={styles.inputSection}>
      <Text style={styles.inputLabel}>Upload first and last frames</Text>
      <View style={styles.frameUploadContainer}>
        <TouchableOpacity style={styles.frameUpload}>
          <Upload size={24} color="#8B5CF6" />
          <Text style={styles.frameUploadText}>First Frame</Text>
        </TouchableOpacity>
        <View style={styles.frameArrow}>
          <SkipForward size={20} color="#8B5CF6" />
        </View>
        <TouchableOpacity style={styles.frameUpload}>
          <Upload size={24} color="#8B5CF6" />
          <Text style={styles.frameUploadText}>Last Frame</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
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

          {selectedMode === 'text' && renderTextToVideo()}
          {selectedMode === 'image' && renderImageToVideo()}
          {selectedMode === 'frame' && renderFrameInterpolation()}

          <View style={styles.modelSection}>
            <Text style={styles.sectionTitle}>AI Model</Text>
            <View style={styles.modelsGrid}>
              {videoModels.map((model) => (
                <ModelCard key={model.name} model={model} />
              ))}
            </View>
          </View>

          <View style={styles.settingsGrid}>
            <View style={styles.settingColumn}>
              <Text style={styles.settingTitle}>Duration</Text>
              <View style={styles.optionsContainer}>
                {durations.map((duration) => (
                  <TouchableOpacity
                    key={duration.value}
                    style={[
                      styles.optionButton,
                      selectedDuration === duration.value && styles.selectedOption
                    ]}
                    onPress={() => setSelectedDuration(duration.value)}
                  >
                    <Text style={[
                      styles.optionText,
                      selectedDuration === duration.value && styles.selectedOptionText
                    ]}>
                      {duration.label}
                    </Text>
                    <Text style={styles.optionCredits}>{duration.credits}c</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingColumn}>
              <Text style={styles.settingTitle}>Quality</Text>
              <View style={styles.optionsContainer}>
                {qualities.map((quality) => (
                  <TouchableOpacity
                    key={quality.name}
                    style={[
                      styles.optionButton,
                      selectedQuality === quality.name && styles.selectedOption
                    ]}
                    onPress={() => setSelectedQuality(quality.name)}
                  >
                    <Text style={[
                      styles.optionText,
                      selectedQuality === quality.name && styles.selectedOptionText
                    ]}>
                      {quality.name}
                    </Text>
                    <Text style={styles.optionSubtext}>{quality.resolution}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.aspectRatioSection}>
            <Text style={styles.sectionTitle}>Aspect Ratio</Text>
            <View style={styles.aspectRatioGrid}>
              {aspectRatios.map((ratio) => (
                <TouchableOpacity
                  key={ratio.value}
                  style={[
                    styles.aspectRatioButton,
                    aspectRatio === ratio.value && styles.selectedAspectRatio
                  ]}
                  onPress={() => setAspectRatio(ratio.value)}
                >
                  <Text style={styles.aspectRatioEmoji}>{ratio.icon}</Text>
                  <Text style={[
                    styles.aspectRatioText,
                    aspectRatio === ratio.value && styles.selectedAspectRatioText
                  ]}>
                    {ratio.label}
                  </Text>
                  <Text style={styles.aspectRatioValue}>{ratio.value}</Text>
                </TouchableOpacity>
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

          <View style={styles.advancedSection}>
            <TouchableOpacity style={styles.advancedHeader}>
              <Settings size={20} color="#8B5CF6" />
              <Text style={styles.advancedTitle}>Advanced Settings</Text>
              <ChevronDown size={20} color="#9CA3AF" />
            </TouchableOpacity>
            
            <View style={styles.advancedContent}>
              <View style={styles.sliderSection}>
                <Text style={styles.sliderLabel}>Motion Strength: {motionStrength}</Text>
                <View style={styles.sliderContainer}>
                  <View style={styles.sliderTrack}>
                    <View style={[styles.sliderFill, { width: `${(motionStrength / 10) * 100}%` }]} />
                  </View>
                </View>
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabelText}>Subtle</Text>
                  <Text style={styles.sliderLabelText}>Dynamic</Text>
                </View>
              </View>
            </View>
          </View>

          <CreditCostDisplay
            generationType="video"
            options={{
              duration: selectedDuration as '3s' | '5s' | '10s' | '15s',
              quality: selectedQuality.toLowerCase() as 'basic' | 'standard' | 'high',
            }}
            style={{ marginBottom: 24 }}
          />

          {isGenerating && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Film size={20} color="#8B5CF6" />
                <Text style={styles.progressTitle}>Generating your video...</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${generationProgress}%` }]} />
              </View>
              <Text style={styles.progressText}>{generationProgress}% complete</Text>
              <Text style={styles.progressSubtext}>
                This may take 2-5 minutes depending on complexity
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.generateButton, isGenerating && styles.generatingButton]}
            onPress={generateVideo}
            disabled={isGenerating}
          >
            <LinearGradient
              colors={isGenerating ? ['#6B7280', '#6B7280'] : ['#8B5CF6', '#3B82F6']}
              style={styles.generateGradient}
            >
              {isGenerating ? (
                <Clock size={24} color="#FFFFFF" />
              ) : (
                <Play size={24} color="#FFFFFF" />
              )}
              <Text style={styles.generateButtonText}>
                {isGenerating ? 'Generating Video...' : 'Generate Video'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    gap: 16,
  },
  selectedModeCard: {
    borderColor: '#8B5CF6',
    backgroundColor: '#312E81',
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
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedOption: {
    borderColor: '#8B5CF6',
    backgroundColor: '#312E81',
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
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 80,
  },
  selectedAspectRatio: {
    borderColor: '#8B5CF6',
    backgroundColor: '#312E81',
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
});