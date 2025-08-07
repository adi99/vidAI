# Subscription Management API Documentation

This document describes the subscription management endpoints for plans, status, and billing.

## Base URL
```
/api/subscription
```

## Authentication
All endpoints except `/plans` require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### Get Subscription Plans
Retrieve available subscription plans.

**Endpoint:** `GET /api/subscription/plans`

**Authentication:** Not required

**Response:**
```json
{
  "status": "ok",
  "plans": [
    {
      "id": "basic",
      "name": "Basic",
      "price_monthly": 0,
      "price_yearly": 0,
      "currency": "USD",
      "credits_per_month": 50,
      "features": [
        "50 credits per month",
        "Basic AI models",
        "Standard quality",
        "Community support"
      ],
      "limits": {
        "videos_per_month": 10,
        "images_per_month": 50,
        "max_video_duration": 5,
        "training_models": 0
      },
      "popular": false
    },
    {
      "id": "pro",
      "name": "Pro",
      "price_monthly": 9.99,
      "price_yearly": 99.99,
      "currency": "USD",
      "credits_per_month": 500,
      "features": [
        "500 credits per month",
        "All AI models",
        "High quality generation",
        "Priority support",
        "Commercial license"
      ],
      "limits": {
        "videos_per_month": 100,
        "images_per_month": 500,
        "max_video_duration": 15,
        "training_models": 3
      },
      "popular": true
    },
    {
      "id": "premium",
      "name": "Premium",
      "price_monthly": 19.99,
      "price_yearly": 199.99,
      "currency": "USD",
      "credits_per_month": 1200,
      "features": [
        "1200 credits per month",
        "All AI models",
        "Premium quality",
        "Priority support",
        "Commercial license",
        "API access",
        "White-label options"
      ],
      "limits": {
        "videos_per_month": -1,
        "images_per_month": -1,
        "max_video_duration": 30,
        "training_models": 10
      },
      "popular": false
    }
  ],
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Get Subscription Status
Retrieve user's current subscription status.

**Endpoint:** `GET /api/subscription/status`

**Response:**
```json
{
  "status": "ok",
  "subscription": {
    "isActive": true,
    "planId": "pro",
    "status": "active",
    "currentPeriodStart": "2024-01-01T00:00:00Z",
    "currentPeriodEnd": "2024-02-01T00:00:00Z",
    "cancelAtPeriodEnd": false,
    "creditsRemaining": 450,
    "totalCredits": 1250
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Manage Subscription
Subscribe, upgrade, downgrade, cancel, or reactivate a subscription.

**Endpoint:** `POST /api/subscription/manage`

**Request Body:**
```json
{
  "action": "subscribe",
  "plan_id": "pro",
  "receipt_data": "base64_encoded_receipt",
  "platform": "ios",
  "transaction_id": "1000000123456789"
}
```

**Actions:**
- `subscribe`: Subscribe to a new plan
- `upgrade`: Upgrade to a higher tier plan
- `downgrade`: Downgrade to a lower tier plan
- `cancel`: Cancel subscription (effective at period end)
- `reactivate`: Reactivate a cancelled subscription

**Response (Subscribe):**
```json
{
  "status": "success",
  "action": "subscribed",
  "subscription": {
    "id": "uuid",
    "user_id": "uuid",
    "plan_id": "pro",
    "status": "active",
    "current_period_start": "2024-01-01T00:00:00Z",
    "current_period_end": "2024-02-01T00:00:00Z",
    "cancel_at_period_end": false,
    "credits_remaining": 500,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "creditsAdded": 500,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Response (Cancel):**
```json
{
  "status": "success",
  "action": "cancelled",
  "subscription": {
    "id": "uuid",
    "user_id": "uuid",
    "plan_id": "pro",
    "status": "active",
    "current_period_start": "2024-01-01T00:00:00Z",
    "current_period_end": "2024-02-01T00:00:00Z",
    "cancel_at_period_end": true,
    "credits_remaining": 450,
    "updated_at": "2024-01-15T00:00:00Z"
  },
  "effectiveDate": "2024-02-01T00:00:00Z",
  "timestamp": "2024-01-15T00:00:00Z"
}
```

### Get Subscription Usage
Retrieve current period usage statistics.

**Endpoint:** `GET /api/subscription/usage`

**Response:**
```json
{
  "status": "ok",
  "usage": {
    "currentPeriod": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-02-01T00:00:00Z"
    },
    "videos": {
      "used": 25,
      "limit": 100,
      "unlimited": false
    },
    "images": {
      "used": 150,
      "limit": 500,
      "unlimited": false
    },
    "training": {
      "used": 1,
      "limit": 3,
      "unlimited": false
    },
    "creditsRemaining": 450
  },
  "timestamp": "2024-01-15T00:00:00Z"
}
```

## Subscription Plans

### Basic Plan (Free)
- **Price:** Free
- **Credits:** 50/month
- **Videos:** 10/month (max 5 seconds)
- **Images:** 50/month
- **Training:** Not available
- **Models:** Basic only

### Pro Plan
- **Price:** $9.99/month or $99.99/year
- **Credits:** 500/month
- **Videos:** 100/month (max 15 seconds)
- **Images:** 500/month
- **Training:** 3 models
- **Models:** All available
- **Features:** Commercial license, priority support

### Premium Plan
- **Price:** $19.99/month or $199.99/year
- **Credits:** 1200/month
- **Videos:** Unlimited (max 30 seconds)
- **Images:** Unlimited
- **Training:** 10 models
- **Models:** All available
- **Features:** Commercial license, priority support, API access, white-label

## Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "code": "INVALID_PLAN",
  "message": "Invalid subscription plan ID",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 409 Conflict
```json
{
  "status": "error",
  "code": "ALREADY_SUBSCRIBED",
  "message": "User already has an active subscription",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 404 Not Found
```json
{
  "status": "error",
  "code": "NO_SUBSCRIPTION",
  "message": "No active subscription found",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "code": "SUBSCRIPTION_MANAGE_ERROR",
  "message": "Failed to manage subscription",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Integration Notes

### App Store Integration
- Receipt validation should be implemented for production
- Handle subscription renewal notifications
- Support for promotional offers and free trials

### Google Play Integration
- Implement Google Play Billing verification
- Handle subscription state changes
- Support for promotional pricing

### Security Considerations
- Always verify receipts server-side
- Implement duplicate transaction detection
- Use secure webhook endpoints for subscription updates
- Rate limit subscription management endpoints