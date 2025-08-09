const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(
    {
      ...env,
      babel: {
        dangerouslyAddModulePathsToTranspile: [
          // Add any modules that need to be transpiled
          '@react-native-async-storage/async-storage',
          'react-native-reanimated',
          'expo-video',
        ],
      },
    },
    argv
  );

  // Bundle optimization for production
  if (env.mode === 'production') {
    // Enable tree shaking
    config.optimization = {
      ...config.optimization,
      usedExports: true,
      sideEffects: false,
      
      // Split chunks for better caching
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          // Vendor chunk for third-party libraries
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          
          // Common chunk for shared code
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
          },
          
          // UI components chunk
          ui: {
            test: /[\\/]components[\\/]ui[\\/]/,
            name: 'ui-components',
            chunks: 'all',
            priority: 8,
          },
          
          // Services chunk
          services: {
            test: /[\\/]services[\\/]/,
            name: 'services',
            chunks: 'all',
            priority: 7,
          },
        },
      },
      
      // Minimize bundle size
      minimize: true,
      minimizer: [
        ...config.optimization.minimizer,
      ],
    };

    // Add bundle analyzer in development
    if (process.env.ANALYZE_BUNDLE) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: 'bundle-report.html',
        })
      );
    }
  }

  // Performance optimizations
  config.performance = {
    maxAssetSize: 1024 * 1024, // 1MB
    maxEntrypointSize: 2 * 1024 * 1024, // 2MB
    hints: env.mode === 'production' ? 'warning' : false,
  };

  // Resolve optimizations
  config.resolve = {
    ...config.resolve,
    alias: {
      ...config.resolve.alias,
      // Add specific aliases for better tree shaking
      'lodash': 'lodash-es',
      'react-native-vector-icons': '@expo/vector-icons',
    },
    
    // Optimize module resolution
    modules: [
      path.resolve(__dirname, 'node_modules'),
      'node_modules',
    ],
    
    // Prefer ES modules for better tree shaking
    mainFields: ['browser', 'module', 'main'],
  };

  // Module rules optimization
  config.module.rules = config.module.rules.map(rule => {
    // Optimize JavaScript/TypeScript processing
    if (rule.test && rule.test.toString().includes('tsx?')) {
      return {
        ...rule,
        include: [
          path.resolve(__dirname, 'app'),
          path.resolve(__dirname, 'components'),
          path.resolve(__dirname, 'services'),
          path.resolve(__dirname, 'hooks'),
          path.resolve(__dirname, 'utils'),
        ],
        exclude: /node_modules/,
      };
    }
    
    return rule;
  });

  // Add compression plugin for production
  if (env.mode === 'production') {
    const CompressionPlugin = require('compression-webpack-plugin');
    config.plugins.push(
      new CompressionPlugin({
        algorithm: 'gzip',
        test: /\.(js|css|html|svg)$/,
        threshold: 8192,
        minRatio: 0.8,
      })
    );
  }

  // Cache optimization
  config.cache = {
    type: 'filesystem',
    cacheDirectory: path.resolve(__dirname, 'node_modules/.cache/webpack'),
    buildDependencies: {
      config: [__filename],
    },
  };

  // Experiments for better performance
  config.experiments = {
    ...config.experiments,
    topLevelAwait: true,
    asyncWebAssembly: true,
  };

  // Add source map optimization
  if (env.mode === 'production') {
    config.devtool = 'source-map';
  } else {
    config.devtool = 'eval-cheap-module-source-map';
  }

  // Optimize asset handling
  config.module.rules.push({
    test: /\.(png|jpe?g|gif|svg|webp)$/i,
    type: 'asset',
    parser: {
      dataUrlCondition: {
        maxSize: 8 * 1024, // 8KB
      },
    },
    generator: {
      filename: 'assets/images/[name].[hash:8][ext]',
    },
  });

  config.module.rules.push({
    test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)$/i,
    type: 'asset/resource',
    generator: {
      filename: 'assets/media/[name].[hash:8][ext]',
    },
  });

  // Add PWA optimizations
  if (env.mode === 'production') {
    const { GenerateSW } = require('workbox-webpack-plugin');
    config.plugins.push(
      new GenerateSW({
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.(?:mp4|webm|ogg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'videos',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
            },
          },
        ],
      })
    );
  }

  return config;
};