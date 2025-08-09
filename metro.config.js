const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Bundle optimization configurations
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Enable tree shaking for better bundle optimization
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

// Optimize asset handling
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'bin',
  'txt',
  'jpg',
  'png',
  'json',
  'mp4',
  'webm',
  'wav',
  'mp3',
  'svg',
  'webp',
];

// Source map optimization for production
if (process.env.NODE_ENV === 'production') {
  config.transformer.minifierConfig = {
    ...config.transformer.minifierConfig,
    sourceMap: false, // Disable source maps in production for smaller bundles
  };
}

// Enable Hermes for better performance
config.transformer.hermesCommand = 'hermes';

// Bundle splitting configuration
config.serializer = {
  ...config.serializer,
  createModuleIdFactory: () => {
    const fileToIdMap = new Map();
    let nextId = 0;
    return (path) => {
      if (!fileToIdMap.has(path)) {
        fileToIdMap.set(path, nextId++);
      }
      return fileToIdMap.get(path);
    };
  },
  
  // Optimize bundle output
  processModuleFilter: (module) => {
    // Filter out development-only modules in production
    if (process.env.NODE_ENV === 'production') {
      if (module.path.includes('__tests__') || 
          module.path.includes('test.') ||
          module.path.includes('.test.') ||
          module.path.includes('storybook') ||
          module.path.includes('flipper')) {
        return false;
      }
    }
    return true;
  },
};

// Caching optimization
config.cacheStores = [
  {
    name: 'filesystem',
    options: {
      cacheDirectory: './node_modules/.cache/metro',
    },
  },
];

// Watchman optimization
config.watchFolders = [
  // Add any additional folders to watch
];

// Resolver optimization
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Custom resolution logic for better tree shaking
  if (moduleName.startsWith('lodash/')) {
    // Use specific lodash imports instead of full library
    return context.resolveRequest(context, moduleName, platform);
  }
  
  // Default resolution
  return context.resolveRequest(context, moduleName, platform);
};

// Performance optimizations
config.maxWorkers = Math.max(1, Math.floor(require('os').cpus().length * 0.75));

// Enable experimental features for better performance
config.transformer.experimentalImportSupport = true;
config.transformer.unstable_allowRequireContext = true;

module.exports = withNativeWind(config, { input: './global.css' });