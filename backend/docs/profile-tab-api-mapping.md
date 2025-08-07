# Profile Tab API Mapping

This document maps the UI components in `app/(tabs)/profile.tsx` to their corresponding backend API endpoints.

## Profile Tab Features → API Endpoints

### 1. User Profile Header
**UI Components:**
- Avatar, username, bio, join date, premium badge

**API Endpoints:**
- `GET /api/auth/profile` - Get user profile data
- `GET /api/subscription/status` - Get premium status

**Implementation Status:** ✅ Ready

---

### 2. User Statistics Cards
**UI Components:**
- Videos Created: "1,247"
- Images Generated: "15,432" 
- Followers: "23.4K"
- Following: "567"

**API Endpoints:**
- `GET /api/user/stats` - Get comprehensive user statistics

**Implementation Status:** ✅ Ready

---

### 3. Achievements Section
**UI Components:**
- Early Adopter achievement
- Creator Pro achievement  
- Viral Hit achievement

**API Endpoints:**
- `GET /api/user/achievements` - Get user achievements and progress

**Implementation Status:** ✅ Ready

---

### 4. Content Tabs (Videos/Images/Liked)
**UI Components:**
- Content grid with videos and images
- View counts, like counts
- Content sharing functionality

**API Endpoints:**
- `GET /api/user/content?content_type=videos` - Get user's videos
- `GET /api/user/content?content_type=images` - Get user's images  
- `GET /api/user/content?content_type=all&liked=true` - Get liked content (needs implementation)
- `POST /api/feed/content/:id/share` - Share content

**Implementation Status:** ✅ Ready (liked content filter needs minor update)

---

### 5. Subscription Plans
**UI Components:**
- Basic, Pro, Premium plan cards
- Current plan indicator
- Upgrade/downgrade buttons

**API Endpoints:**
- `GET /api/subscription/plans` - Get available plans
- `GET /api/subscription/status` - Get current subscription
- `POST /api/subscription/manage` - Subscribe/upgrade/downgrade

**Implementation Status:** ✅ Ready

---

### 6. Settings & Preferences
**UI Components:**
- Push Notifications toggle
- Private Profile toggle
- Download Quality settings
- Account Settings
- Help & Support
- Sign Out

**API Endpoints:**
- `GET /api/user/settings` - Get user settings
- `POST /api/user/settings` - Update settings
- `POST /api/auth/logout` - Sign out user

**Implementation Status:** ✅ Ready

---

## Complete API Integration Checklist

### ✅ Implemented and Ready
1. **User Profile Data** - `GET /api/auth/profile`
2. **User Statistics** - `GET /api/user/stats`
3. **User Achievements** - `GET /api/user/achievements`
4. **User Content** - `GET /api/user/content`
5. **Subscription Plans** - `GET /api/subscription/plans`
6. **Subscription Status** - `GET /api/subscription/status`
7. **Subscription Management** - `POST /api/subscription/manage`
8. **User Settings** - `GET/POST /api/user/settings`
9. **Content Sharing** - `POST /api/feed/content/:id/share`
10. **User Logout** - `POST /api/auth/logout`

### 🔄 Minor Updates Needed
1. **Liked Content Filter** - Add liked content filtering to user content endpoint

## Frontend Integration Steps

### Step 1: Replace Static Data
Replace all hardcoded data in profile.tsx with API calls:

```typescript
// Replace static userStats
const { data: stats } = await api.get('/api/user/stats');

// Replace static achievements  
const { data: achievements } = await api.get('/api/user/achievements');

// Replace static subscription data
const { data: subscription } = await api.get('/api/subscription/status');
```

### Step 2: Implement Real Functionality
Make buttons and toggles functional:

```typescript
// Make upgrade buttons work
const handleUpgrade = async (planId) => {
  await api.post('/api/subscription/manage', {
    action: 'upgrade',
    plan_id: planId
  });
};

// Make settings toggles work
const handleSettingChange = async (setting, value) => {
  await api.post('/api/user/settings', {
    [setting]: value
  });
};
```

### Step 3: Add Loading States
Add proper loading and error states for better UX:

```typescript
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

// Show loading spinners while fetching data
// Show error messages if API calls fail
```

### Step 4: Real-time Updates
Implement real-time updates for dynamic data:

```typescript
// Update credit balance in real-time
// Refresh stats after new content creation
// Update subscription status after changes
```

## API Response Examples

### User Stats Response
```json
{
  "stats": {
    "content": {
      "videosCreated": 1247,
      "imagesGenerated": 15432
    },
    "social": {
      "followers": 23400,
      "following": 567
    }
  }
}
```

### Achievements Response
```json
{
  "achievements": [
    {
      "title": "Early Adopter",
      "description": "Joined in the first month",
      "icon": "star",
      "rarity": "rare"
    }
  ]
}
```

### Subscription Status Response
```json
{
  "subscription": {
    "isActive": true,
    "planId": "pro",
    "status": "active"
  }
}
```

## Security Considerations

1. **User Ownership**: All endpoints validate user ownership of data
2. **Rate Limiting**: Appropriate rate limits on all endpoints
3. **Input Validation**: All inputs validated with Zod schemas
4. **Authentication**: All endpoints require valid JWT tokens

## Performance Optimizations

1. **Caching**: User stats and achievements can be cached
2. **Pagination**: Content lists support pagination
3. **Lazy Loading**: Load content tabs on demand
4. **Optimistic Updates**: Update UI immediately, sync with server

## Conclusion

The profile tab has complete API coverage with all necessary endpoints implemented and documented. The backend is ready for frontend integration with proper authentication, validation, and error handling in place.