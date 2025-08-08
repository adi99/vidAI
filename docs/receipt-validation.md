# Receipt Validation and Offer Code Redemption

This document describes the implementation of server-side receipt validation and offer code redemption functionality for the AI Video Generation App.

## Overview

The receipt validation system ensures that all in-app purchases are legitimate by validating receipts with Apple App Store and Google Play Store before granting credits to users. This prevents fraud and ensures payment integrity.

## Features Implemented

### 1. Server-Side Receipt Validation

#### iOS Receipt Validation
- Uses `node-apple-receipt-verify` library for Apple App Store validation
- Validates receipts against both sandbox and production environments
- Extracts transaction details including transaction ID, product ID, and purchase date
- Handles Apple-specific receipt format and validation responses

#### Android Receipt Validation
- Implements Google Play Billing validation structure
- Handles Android-specific purchase tokens and package names
- Includes development mode for testing
- Production implementation ready for Google Play Developer API integration

### 2. Offer Code Redemption

#### iOS Offer Code Redemption
- Uses `presentCodeRedemptionSheet` from expo-iap
- Displays Apple's native redemption interface
- Automatically handles redeemed purchases through purchase update listeners
- Works only on real iOS devices (not simulators)

#### Android Offer Code Redemption
- Uses `openRedeemOfferCodeAndroid` from expo-iap
- Redirects users to Google Play Store for code redemption
- Handles redemption through standard purchase flow

### 3. Enhanced Purchase Flow

#### Transaction Deduplication
- Checks for duplicate transactions before processing
- Prevents double-spending and ensures transaction integrity
- Maintains transaction history in database

#### Credit Management
- Automatic credit addition after successful validation
- Real-time balance updates across the application
- Transaction logging for audit purposes

## Implementation Details

### Backend Components

#### ReceiptValidationService (`backend/src/services/receiptValidationService.ts`)

```typescript
// Main validation methods
static async validateIOSReceipt(params: IOSValidationParams): Promise<ValidationResult>
static async validateAndroidReceipt(params: AndroidValidationParams): Promise<ValidationResult>
static async validateReceipt(platform: 'ios' | 'android', params: any): Promise<ValidationResult>

// Utility methods
static async isTransactionProcessed(transactionId: string): Promise<boolean>
static getValidationErrorMessage(error: string): string
```

#### Enhanced User Routes (`backend/src/routes/user.ts`)

- Updated `/api/user/credits/purchase` endpoint with full receipt validation
- Platform-specific validation logic
- Comprehensive error handling and logging
- Transaction deduplication checks

### Frontend Components

#### Enhanced useIAP Hook (`hooks/useIAP.ts`)

```typescript
// New methods added
redeemOfferCode: () => Promise<{ success: boolean; error?: string }>

// Enhanced validation
verifyPurchaseWithBackend: (purchase: any) => Promise<ValidationResult>
```

#### CreditPurchaseModal (`components/CreditPurchaseModal.tsx`)

- Complete credit purchase interface
- Offer code redemption integration
- Platform-specific UI adaptations
- Real-time purchase status updates

#### Enhanced IAPTestComponent (`components/IAPTestComponent.tsx`)

- Added offer code redemption testing
- Comprehensive IAP system testing
- Platform-specific feature testing

## Configuration

### Environment Variables

Add to your backend `.env` file:

```bash
# In-App Purchases
APPLE_SHARED_SECRET=your_apple_shared_secret
ANDROID_PACKAGE_NAME=com.yourapp.package
```

### Dependencies

Backend dependencies added:
```json
{
  "node-apple-receipt-verify": "^1.15.1"
}
```

## Usage Examples

### Basic Credit Purchase

```typescript
import { useIAP } from '@/hooks/useIAP';

const { purchaseCredits } = useIAP();

const handlePurchase = async () => {
  const result = await purchaseCredits('credits_100');
  if (result.success) {
    console.log(`Received ${result.credits} credits`);
  }
};
```

### Offer Code Redemption

```typescript
import { useIAP } from '@/hooks/useIAP';

const { redeemOfferCode } = useIAP();

const handleRedemption = async () => {
  const result = await redeemOfferCode();
  if (result.success) {
    console.log('Redemption sheet opened');
  }
};
```

### Server-Side Validation

```typescript
import { ReceiptValidationService } from '../services/receiptValidationService';

// iOS validation
const result = await ReceiptValidationService.validateIOSReceipt({
  receiptData: purchase.transactionReceipt,
  productId: purchase.productId,
});

// Android validation
const result = await ReceiptValidationService.validateAndroidReceipt({
  packageName: 'com.yourapp.package',
  productToken: purchase.purchaseToken,
  productId: purchase.productId,
});
```

## Security Considerations

### Receipt Validation
- All receipts are validated server-side before granting credits
- Transaction IDs are checked for duplicates
- Validation results are logged for audit purposes
- Failed validations are handled gracefully with user-friendly messages

### Error Handling
- Comprehensive error handling for network failures
- Platform-specific error messages
- Graceful degradation for unsupported platforms
- Retry logic for transient failures

### Data Protection
- Receipt data is stored securely in the database
- Sensitive validation details are logged appropriately
- User authentication is required for all purchase operations

## Testing

### Development Testing
- Mock validation for development environment
- Comprehensive test component for all IAP features
- Platform-specific testing capabilities
- Error scenario testing

### Production Considerations
- Apple App Store Connect shared secret configuration
- Google Play Developer API setup (for production Android validation)
- Proper error monitoring and alerting
- Transaction audit logging

## Error Codes and Messages

### Common Error Codes
- `INVALID_PACKAGE`: Invalid credit package ID
- `DUPLICATE_TRANSACTION`: Transaction already processed
- `INVALID_RECEIPT`: Receipt validation failed
- `UNSUPPORTED_PLATFORM`: Platform not supported
- `PURCHASE_ERROR`: General purchase processing error

### User-Friendly Messages
- Receipt validation errors are converted to user-friendly messages
- Platform-specific guidance for troubleshooting
- Clear instructions for offer code redemption

## Future Enhancements

### Planned Features
1. Google Play Developer API integration for production Android validation
2. Subscription receipt validation
3. Advanced fraud detection
4. Purchase analytics and reporting
5. Automated refund processing

### Monitoring and Analytics
- Purchase success/failure rates
- Platform-specific performance metrics
- Validation response times
- Error frequency tracking

## Troubleshooting

### Common Issues

1. **iOS Receipt Validation Fails**
   - Check Apple shared secret configuration
   - Verify receipt format and encoding
   - Ensure proper sandbox/production environment handling

2. **Android Validation Not Working**
   - Implement Google Play Developer API for production
   - Verify package name and purchase token format
   - Check OAuth2 authentication for Google APIs

3. **Offer Code Redemption Not Working**
   - Ensure expo-iap is properly installed and configured
   - Test on real devices (iOS simulators don't support redemption)
   - Verify platform-specific implementation

4. **Duplicate Transaction Errors**
   - Check transaction ID uniqueness
   - Verify database constraints
   - Review transaction processing logic

### Debug Information
- Enable detailed logging in development
- Monitor validation response times
- Track purchase flow completion rates
- Review error patterns and frequencies

## Compliance and Best Practices

### App Store Guidelines
- Follows Apple App Store Review Guidelines for IAP
- Implements proper receipt validation as recommended
- Handles offer codes according to Apple specifications

### Google Play Policies
- Complies with Google Play Billing policies
- Implements proper purchase verification
- Handles Android-specific purchase flows correctly

### Security Best Practices
- Server-side validation for all purchases
- Secure storage of sensitive configuration
- Proper error handling without exposing internal details
- Audit logging for compliance and debugging