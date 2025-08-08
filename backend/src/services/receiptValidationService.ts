import { logger } from '../config/logger';

// Apple receipt verification
const appleReceiptVerify = require('node-apple-receipt-verify');

// Configure Apple receipt verification
appleReceiptVerify.config({
  secret: process.env.APPLE_SHARED_SECRET, // Your App Store Connect shared secret
  environment: ['sandbox', 'production'], // Check both environments
  verbose: false,
  extended: true,
});

export interface IOSValidationParams {
  receiptData: string;
  productId: string;
}

export interface AndroidValidationParams {
  packageName: string;
  productToken: string;
  productId: string;
  isSub?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  transactionId?: string;
  originalTransactionId?: string;
  productId?: string;
  purchaseDate?: string;
  expirationDate?: string;
  error?: string;
  platform?: 'ios' | 'android';
  receipt?: any;
}

export class ReceiptValidationService {
  /**
   * Validate iOS receipt with Apple App Store
   */
  static async validateIOSReceipt(params: IOSValidationParams): Promise<ValidationResult> {
    try {
      logger.info('Validating iOS receipt', { productId: params.productId });

      if (!params.receiptData) {
        return {
          isValid: false,
          error: 'iOS validation requires receiptData',
          platform: 'ios',
        };
      }

      // Verify receipt with Apple
      const result = await appleReceiptVerify.validate({
        receipt: params.receiptData,
        device: false,
      });

      if (result && result.status === 0) {
        // Receipt is valid
        const receipt = result.receipt;
        const inAppPurchases = receipt.in_app || [];
        
        // Find the specific purchase
        const purchase = inAppPurchases.find((p: any) => p.product_id === params.productId);
        
        if (purchase) {
          logger.info('iOS receipt validation successful', {
            productId: params.productId,
            transactionId: purchase.transaction_id,
          });

          return {
            isValid: true,
            transactionId: purchase.transaction_id,
            originalTransactionId: purchase.original_transaction_id,
            productId: purchase.product_id,
            purchaseDate: purchase.purchase_date,
            platform: 'ios',
            receipt: result,
          };
        } else {
          logger.warn('Product not found in iOS receipt', {
            productId: params.productId,
            availableProducts: inAppPurchases.map((p: any) => p.product_id),
          });

          return {
            isValid: false,
            error: 'Product not found in receipt',
            platform: 'ios',
          };
        }
      } else {
        logger.error('iOS receipt validation failed', {
          status: result?.status,
          error: result?.error || 'Unknown error',
        });

        return {
          isValid: false,
          error: `Apple validation failed: ${result?.status || 'Unknown error'}`,
          platform: 'ios',
        };
      }
    } catch (error: any) {
      logger.error('iOS receipt validation error', {
        error: error.message,
        productId: params.productId,
      });

      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
        platform: 'ios',
      };
    }
  }

  /**
   * Validate Android receipt with Google Play Billing
   */
  static async validateAndroidReceipt(params: AndroidValidationParams): Promise<ValidationResult> {
    try {
      logger.info('Validating Android receipt', { 
        productId: params.productId,
        packageName: params.packageName,
        isSub: params.isSub,
      });

      // Check required parameters
      if (!params.packageName || !params.productToken) {
        return {
          isValid: false,
          error: 'Android validation requires packageName and productToken',
          platform: 'android',
        };
      }

      // For now, we'll implement a basic validation
      // In production, you would use Google Play Developer API
      // This requires OAuth2 authentication and proper API setup
      
      // Mock validation for development
      if (process.env.NODE_ENV === 'development') {
        logger.info('Android receipt validation (development mode)', {
          productId: params.productId,
          packageName: params.packageName,
        });

        return {
          isValid: true,
          transactionId: `android_${Date.now()}`,
          productId: params.productId,
          purchaseDate: new Date().toISOString(),
          platform: 'android',
        };
      }

      // Production validation would go here
      // You would need to implement Google Play Developer API calls
      logger.warn('Android receipt validation not fully implemented for production');
      
      return {
        isValid: false,
        error: 'Android validation not implemented for production',
        platform: 'android',
      };
    } catch (error: any) {
      logger.error('Android receipt validation error', {
        error: error.message,
        productId: params.productId,
      });

      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
        platform: 'android',
      };
    }
  }

  /**
   * Validate receipt for any platform
   */
  static async validateReceipt(
    platform: 'ios' | 'android',
    params: IOSValidationParams | AndroidValidationParams
  ): Promise<ValidationResult> {
    if (platform === 'ios') {
      return this.validateIOSReceipt(params as IOSValidationParams);
    } else if (platform === 'android') {
      return this.validateAndroidReceipt(params as AndroidValidationParams);
    } else {
      return {
        isValid: false,
        error: 'Unsupported platform',
      };
    }
  }

  /**
   * Check if transaction has already been processed
   */
  static async isTransactionProcessed(transactionId: string): Promise<boolean> {
    try {
      const { supabaseAdmin } = await import('../config/database');
      
      const { data, error } = await supabaseAdmin
        .from('iap_receipts')
        .select('id')
        .eq('transaction_id', transactionId)
        .eq('status', 'verified')
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Error checking transaction status', { error: error.message });
        return false;
      }

      return !!data;
    } catch (error: any) {
      logger.error('Error checking transaction status', { error: error.message });
      return false;
    }
  }

  /**
   * Get user-friendly error message for validation errors
   */
  static getValidationErrorMessage(error: string): string {
    const errorMap: { [key: string]: string } = {
      'iOS validation requires receiptData': 'Invalid receipt data provided',
      'Android validation requires packageName and productToken': 'Invalid purchase information',
      'Product not found in receipt': 'Purchase verification failed',
      'Apple validation failed': 'Could not verify purchase with Apple',
      'Android validation not implemented for production': 'Android purchases temporarily unavailable',
      'Unsupported platform': 'Platform not supported',
    };

    // Check for partial matches
    for (const [key, message] of Object.entries(errorMap)) {
      if (error.includes(key)) {
        return message;
      }
    }

    return 'Purchase verification failed. Please try again.';
  }
}