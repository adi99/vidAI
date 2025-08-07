export const COLORS = {
  primary: '#8B5CF6',
  secondary: '#3B82F6',
  accent: '#EC4899',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  background: {
    dark: '#111827',
    medium: '#1F2937',
    light: '#374151',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#E5E7EB',
    muted: '#9CA3AF',
  },
  border: '#374151',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
};

export const TRAINING_TIERS = {
  quick: {
    steps: 600,
    duration: '15-20 min',
    price: 5,
  },
  standard: {
    steps: 1200,
    duration: '30-45 min',
    price: 10,
  },
  professional: {
    steps: 2000,
    duration: '60-90 min',
    price: 20,
  },
};

export const OUTPUT_SIZES = {
  square: [
    { width: 512, height: 512 },
    { width: 1024, height: 1024 },
  ],
  portrait: [
    { width: 512, height: 768 },
    { width: 1024, height: 1536 },
  ],
  landscape: [
    { width: 768, height: 512 },
    { width: 1536, height: 1024 },
  ],
};

export const AI_MODELS = {
  sdxl: {
    name: 'SDXL',
    description: 'Stable Diffusion XL - High quality, versatile',
    maxSize: 1024,
  },
  flux: {
    name: 'FLUX',
    description: 'Latest model - Best quality, photorealistic',
    maxSize: 1536,
  },
  turbo: {
    name: 'Turbo',
    description: 'Fast generation - Good for previews',
    maxSize: 512,
  },
};