# Database Setup for AI Video Generation App

This directory contains the database migrations and schema for the AI Video Generation App.

## Prerequisites

1. **Supabase CLI**: Install the Supabase CLI if you haven't already:
   ```bash
   npm install -g supabase
   ```

2. **Supabase Project**: You need an active Supabase project with the connection details in your `.env` file.

## Migration Files

- `001_initial_schema.sql` - Creates all tables, types, and indexes
- `002_rls_policies.sql` - Sets up Row Level Security policies
- `003_functions_triggers.sql` - Creates database functions and triggers

## Applying Migrations

### Option 1: Using Supabase CLI (Recommended)

1. Initialize Supabase in your project (if not already done):
   ```bash
   supabase init
   ```

2. Link to your remote Supabase project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Apply the migrations:
   ```bash
   supabase db push
   ```

### Option 2: Manual Application via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste each migration file in order:
   - First: `001_initial_schema.sql`
   - Second: `002_rls_policies.sql`
   - Third: `003_functions_triggers.sql`
4. Execute each migration

### Option 3: Using the MCP Supabase Tool

If you have the MCP Supabase tool configured, you can apply migrations programmatically:

```typescript
// Apply each migration using the MCP tool
await mcp_supabase_apply_migration({
  name: "initial_schema",
  query: "-- Content of 001_initial_schema.sql"
});
```

## Database Schema Overview

### Core Tables

- **profiles** - Extended user profiles with credits and subscription info
- **videos** - Generated video content and metadata
- **images** - Generated image content and metadata
- **training_jobs** - LoRA model training jobs
- **likes** - Social interactions (likes)
- **comments** - Social interactions (comments)
- **credit_transactions** - Credit usage and purchase history
- **iap_receipts** - In-app purchase receipts
- **push_tokens** - Push notification tokens

### Key Features

- **Row Level Security (RLS)** - All tables have appropriate RLS policies
- **Automatic Triggers** - Profile creation, stats updates, like/comment counts
- **Database Functions** - Credit management, feed generation
- **Performance Indexes** - Optimized for common query patterns

## Environment Variables

Make sure your `.env` file contains:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## TypeScript Types

The database types are automatically generated in `types/database.ts`. These provide full type safety for all database operations.

## Testing the Setup

After applying migrations, you can test the setup by:

1. Creating a test user account
2. Checking that a profile is automatically created
3. Verifying RLS policies work correctly
4. Testing the database functions

## Troubleshooting

### Common Issues

1. **Permission Errors**: Make sure you're using the service role key for migrations
2. **RLS Blocking Queries**: Ensure you're authenticated when testing from the client
3. **Function Errors**: Check that all required extensions are enabled

### Verification Queries

```sql
-- Check if all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';

-- Test profile creation trigger
SELECT * FROM auth.users LIMIT 1;
SELECT * FROM public.profiles LIMIT 1;
```

## Next Steps

After setting up the database:

1. Update your Supabase client configuration
2. Test the database service functions
3. Implement the backend API endpoints
4. Set up the queue system for AI generation jobs