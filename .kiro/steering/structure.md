# Project Structure

## Root Directory Organization

### Configuration Files
- `.env` - Environment variables (Supabase keys)
- `app.json` - Expo configuration
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration with path aliases
- `.prettierrc` - Code formatting rules
- `.gitignore` - Git ignore patterns
- `.npmrc` - npm configuration

### Core Application Structure

#### `app/` - Expo Router Navigation
File-based routing with nested layouts:
```
app/
├── _layout.tsx          # Root layout with AuthProvider
├── index.tsx            # Auth redirect logic
├── +not-found.tsx       # 404 page
├── (auth)/              # Authentication group
│   ├── _layout.tsx      # Auth layout
│   ├── login.tsx        # Login screen
│   └── signup.tsx       # Signup screen
└── (tabs)/              # Main app tabs group
    ├── _layout.tsx      # Tab navigation layout
    ├── feed.tsx         # Social feed
    ├── video.tsx        # Video generation
    ├── image.tsx        # Image generation
    ├── training.tsx     # Model training
    └── profile.tsx      # User profile
```

#### `components/` - Reusable UI Components
- `VideoPlayer.tsx` - Native video player component
- `VideoPlayer.web.tsx` - Web-specific video player
- `ui/` - Common UI components (Button, etc.)

#### `contexts/` - React Context Providers
- `AuthContext.tsx` - Authentication state management

#### `services/` - Business Logic Layer
- `authService.ts` - Authentication operations
- `databaseService.ts` - Database queries and mutations

#### `lib/` - External Service Configuration
- `supabase.ts` - Supabase client configuration with AsyncStorage

#### `types/` - TypeScript Type Definitions
- `database.ts` - Generated Supabase database types

#### `hooks/` - Custom React Hooks
- `useFrameworkReady.ts` - Framework initialization hook

#### `utils/` - Utility Functions
- `constants.ts` - App-wide constants
- `imageUtils.ts` - Image processing utilities

### Backend Infrastructure

#### `supabase/` - Database Schema and Migrations
- `README.md` - Supabase setup instructions
- `migrations/` - SQL migration files for database schema

### Development Configuration

#### `.kiro/` - Kiro IDE Configuration
- `specs/` - Feature specifications and requirements
- `steering/` - AI assistant guidance documents

#### `.expo/` - Expo Development Files
- Auto-generated Expo development configuration
- Device registry and type definitions

#### `.vscode/` - VS Code Configuration
- Editor settings and extensions

## Naming Conventions

### Files and Directories
- **Components**: PascalCase (e.g., `VideoPlayer.tsx`)
- **Screens**: PascalCase (e.g., `login.tsx`, `feed.tsx`)
- **Services**: camelCase (e.g., `authService.ts`)
- **Utilities**: camelCase (e.g., `imageUtils.ts`)
- **Types**: camelCase (e.g., `database.ts`)

### Code Conventions
- **React Components**: PascalCase
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Interfaces**: PascalCase with descriptive names
- **Enums**: PascalCase

## Import Patterns

### Path Aliases
Use `@/` prefix for imports from project root:
```typescript
import { supabase } from '@/lib/supabase';
import { AuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
```

### Import Order
1. React and React Native imports
2. Third-party library imports
3. Local imports using path aliases
4. Relative imports

## Architecture Patterns

### Component Organization
- Keep components focused and single-purpose
- Separate platform-specific implementations (`.web.tsx`, `.native.tsx`)
- Use composition over inheritance
- Implement proper TypeScript interfaces

### State Management
- Use React Context for global state (auth, user data)
- Local component state for UI-specific data
- Supabase real-time subscriptions for live data

### Error Handling
- Implement error boundaries for component crashes
- Use try-catch blocks for async operations
- Provide user-friendly error messages
- Log errors for debugging

### Performance Considerations
- Lazy load heavy components
- Optimize images and videos
- Use React.memo for expensive renders
- Implement proper loading states