# Technology Stack

## Frontend (Mobile App)
- **Framework**: Expo SDK 53+ with React Native 0.79+
- **Navigation**: Expo Router with typed routes
- **State Management**: React Context (AuthContext)
- **Database Client**: Supabase JS client with AsyncStorage persistence
- **UI Components**: Custom components with Lucide React Native icons
- **Media**: Expo AV for video playback, Expo Camera for image capture
- **Payments**: Expo IAP for in-app purchases
- **Analytics**: PostHog integration

## Backend Infrastructure
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: Supabase Auth with OAuth providers
- **Storage**: Supabase Storage for media files
- **Queue System**: Redis (BullMQ) for job processing
- **AI Processing**: Modal.com and Runpod.io for GPU workers
- **Push Notifications**: Expo Push Notifications service

## Development Tools
- **Language**: TypeScript with strict mode enabled
- **Package Manager**: npm
- **Code Style**: Prettier configuration included
- **Path Aliases**: `@/*` maps to project root

## Common Commands

### Development
```bash
# Start development server
npm run dev

# Start with cache reset
npm run start

# Clean cache and restart
npm run clean
```

### Building
```bash
# Type checking
npm run type-check

# Web build
npm run build:web

# Native builds
npm run build:android
npm run build:ios

# Prebuild (generate native code)
npm run prebuild
```

### Platform-specific
```bash
# Run on Android
npm run android

# Run on iOS
npm run ios
```

### Deployment
```bash
# Deploy web version
npm run deploy

# Lint code
npm run lint
```

## Environment Variables
Required environment variables in `.env`:
- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key

## Key Dependencies
- `@supabase/supabase-js`: Database and auth client
- `expo-router`: File-based navigation
- `expo-av`: Video playback
- `expo-camera`: Camera functionality
- `lucide-react-native`: Icon library
- `react-native-reanimated`: Animations
- `@react-native-async-storage/async-storage`: Local storage