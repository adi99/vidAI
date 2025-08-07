import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Switch,
  Alert,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, CreditCard as Edit3, ChevronDown, Wand as Wand2, Upload, Palette, Image as ImageIcon, Zap, Crown, Settings, Copy, Download, Share, Heart, Eye, Clock } from 'lucide-react-native';

export default function ImageScreen() {
  const [activeTab, setActiveTab] = useState<'generate' | 'edit'>('generate');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('SDXL');
  const [selectedSize, setSelectedSize] = useState('1024x1024');
  const [selectedQuality, setSelectedQuality] = useState('Standard');
  const [promptEnhancement, setPromptEnhancement] = useState(true);
  const [selectedStyle, setSelectedStyle] = useState('Realistic');
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const [steps, setSteps] = useState(30);
  const [seed, setSeed] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  const models = [
    { name: 'SDXL', description: 'High quality, versatile', speed: 'Fast' },
    { name: 'FLUX', description: 'Ultra realistic results', speed: 'Medium' },
    { name: 'Midjourney', description: 'Artistic and creative', speed: 'Slow' },
    { name: 'DALL-E 3', description: 'Best text understanding', speed: 'Fast' }
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
    { name: 'Basic', description: 'Fast generation', credits: 1 },
    { name: 'Standard', description: 'Balanced quality', credits: 2 },
    { name: 'High', description: 'Best quality', credits: 4 }
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

  const generateImage = async () => {
    if (!prompt.trim()) {
      Alert.alert('Error', 'Please enter a prompt');
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
          Alert.alert('Success', 'Your image has been generated!');
          return 100;
        }
        return prev + 10;
      });
    }, 300);
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
    </TouchableOpacity>
  );

  const SizeCard = ({ size }: { size: any }) => (
    <TouchableOpacity
      style={[
        styles.sizeCard,
        selectedSize === size.value && styles.selectedSizeCard
      ]}
      onPress={() => setSelectedSize(size.value)}
    >
      <Text style={styles.sizeLabel}>{size.label}</Text>
      <Text style={styles.sizeAspect}>{size.aspect}</Text>
    </TouchableOpacity>
  );

  const QualityCard = ({ quality }: { quality: any }) => (
    <TouchableOpacity
      style={[
        styles.qualityCard,
        selectedQuality === quality.name && styles.selectedQualityCard
      ]}
      onPress={() => setSelectedQuality(quality.name)}
    >
      <Text style={styles.qualityName}>{quality.name}</Text>
      <Text style={styles.qualityDescription}>{quality.description}</Text>
      <View style={styles.qualityCreditsContainer}>
        <Text style={styles.qualityCreditsText}>{quality.credits} credits</Text>
      </View>
    </TouchableOpacity>
  );

  const StyleButton = ({ style }: { style: any }) => (
    <TouchableOpacity
      style={[
        styles.styleButton,
        selectedStyle === style.name && styles.selectedStyleButton
      ]}
      onPress={() => setSelectedStyle(style.name)}
    >
      <Text style={styles.styleEmoji}>{style.emoji}</Text>
      <Text style={[
        styles.styleButtonText,
        selectedStyle === style.name && styles.selectedStyleButtonText
      ]}>
        {style.name}
      </Text>
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

  const renderGenerateTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.promptSection}>
        <Text style={styles.inputLabel}>Describe your image</Text>
        <View style={styles.promptContainer}>
          <TextInput
            style={styles.textInput}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="A beautiful landscape with mountains and lakes at sunset..."
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={3}
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
          {models.map((model) => (
            <ModelCard key={model.name} model={model} />
          ))}
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

      {isGenerating && (
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Clock size={20} color="#8B5CF6" />
            <Text style={styles.progressTitle}>Generating your image...</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${generationProgress}%` }]} />
          </View>
          <Text style={styles.progressText}>{generationProgress}% complete</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.generateButton, isGenerating && styles.generatingButton]}
        onPress={generateImage}
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
        <TouchableOpacity style={styles.uploadButton}>
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
        </TouchableOpacity>
      </View>

      <View style={styles.editToolsSection}>
        <Text style={styles.sectionTitle}>Editing Tools</Text>
        
        <TouchableOpacity style={styles.editTool}>
          <LinearGradient
            colors={['#F59E0B', '#EF4444']}
            style={styles.editToolIcon}
          >
            <Palette size={24} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.editToolContent}>
            <Text style={styles.editToolTitle}>Change Outfit</Text>
            <Text style={styles.editToolDescription}>
              Modify clothing and accessories with AI precision
            </Text>
          </View>
          <View style={styles.editToolBadge}>
            <Text style={styles.editToolBadgeText}>PRO</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.editTool}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.editToolIcon}
          >
            <Edit3 size={24} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.editToolContent}>
            <Text style={styles.editToolTitle}>Edit Details</Text>
            <Text style={styles.editToolDescription}>
              Fine-tune facial features, hair, and expressions
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.editTool}>
          <LinearGradient
            colors={['#8B5CF6', '#3B82F6']}
            style={styles.editToolIcon}
          >
            <Wand2 size={24} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.editToolContent}>
            <Text style={styles.editToolTitle}>Restyle Region</Text>
            <Text style={styles.editToolDescription}>
              Mask and transform specific areas with prompts
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.editTool}>
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

      <View style={styles.recentEditsSection}>
        <Text style={styles.sectionTitle}>Recent Edits</Text>
        <View style={styles.recentEditsGrid}>
          {[1, 2, 3, 4].map((item) => (
            <TouchableOpacity key={item} style={styles.recentEditCard}>
              <View style={styles.recentEditPlaceholder}>
                <ImageIcon size={24} color="#6B7280" />
              </View>
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
    </View>
  );

  return (
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
            <View style={styles.creditsContainer}>
              <Zap size={16} color="#FCD34D" />
              <Text style={styles.creditsText}>247 credits remaining</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.tabContainer}>
          <TabButton
            tab="generate"
            icon={<Sparkles size={24} color={activeTab === 'generate' ? '#8B5CF6' : '#6B7280'} />}
            title="Generate"
            subtitle="Create from text"
          />
          <TabButton
            tab="edit"
            icon={<Edit3 size={24} color={activeTab === 'edit' ? '#8B5CF6' : '#6B7280'} />}
            title="Edit"
            subtitle="Modify images"
          />
        </View>

        {activeTab === 'generate' ? renderGenerateTab() : renderEditTab()}
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
  qualityCreditsContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qualityCreditsText: {
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
});