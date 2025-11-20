const PaymentAdapter = require('./PaymentAdapter');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

/**
 * Idram Payment Adapter
 * Implements Idram payment gateway integration
 */
class IdramAdapter extends PaymentAdapter {
  constructor(config) {
    super();
    this.merchantId = config.merchantId || process.env.IDRAM_MERCHANT_ID;
    this.secretKey = config.secretKey || process.env.IDRAM_SECRET_KEY;
    this.publicKey = config.publicKey || process.env.IDRAM_PUBLIC_KEY;
    this.apiUrl = config.apiUrl || process.env.IDRAM_API_URL || 'https://banking.idram.am/api/v1';
    this.testMode = config.testMode || process.env.IDRAM_TEST_MODE === 'true';
    
    console.log('[IdramAdapter] Initialized:', {
      merchantId: this.merchantId ? '***' + this.merchantId.slice(-4) : 'NOT SET',
      testMode: this.testMode,
      apiUrl: this.apiUrl,
    });
  }

  /**
   * Create payment URL for Idram
   */
  async createPayment(order, options = {}) {
    try {
      console.log('[IdramAdapter] Creating payment for order:', order.number);

      if (!this.merchantId || !this.secretKey) {
        throw new Error('Idram credentials not configured');
      }

      const amount = Math.round(order.total * 100); // Convert to smallest currency unit (dram)
      const orderId = order.number;
      const description = `Order ${order.number}`;
      
      // Generate payment URL
      // Idram typically uses a form-based redirect or API endpoint
      // This is a simplified implementation - actual Idram API may differ
      const paymentParams = {
        EDP_LANGUAGE: 'EN',
        EDP_REC_ACCOUNT: this.merchantId,
        EDP_REC_AMOUNT: amount,
        EDP_DESCRIPTION: description,
        EDP_BILL_NO: orderId,
        EDP_SUCCESS_URL: `${process.env.APP_URL || 'http://localhost:3000'}/orders/${order.number}?status=success`,
        EDP_FAIL_URL: `${process.env.APP_URL || 'http://localhost:3000'}/orders/${order.number}?status=failed`,
      };

      // Generate signature (Idram specific signature algorithm)
      const signatureString = [
        this.merchantId,
        amount,
        orderId,
        description,
        paymentParams.EDP_SUCCESS_URL,
        paymentParams.EDP_FAIL_URL,
      ].join(':');

      const signature = crypto
        .createHmac('sha256', this.secretKey)
        .update(signatureString)
        .digest('hex');

      paymentParams.EDP_CHECKSUM = signature;

      // Build payment URL
      const paymentUrl = `${this.apiUrl}/payment/redirect?${new URLSearchParams(paymentParams).toString()}`;

      console.log('[IdramAdapter] Payment URL generated:', {
        orderId,
        amount,
        paymentUrl: paymentUrl.substring(0, 100) + '...',
      });

      return {
        paymentUrl,
        paymentId: orderId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      };
    } catch (error) {
      console.error('[IdramAdapter] Error creating payment:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature from Idram
   */
  async verifyWebhook(request) {
    try {
      const body = request.body;
      const receivedSignature = body.EDP_CHECKSUM || body.signature;

      if (!receivedSignature) {
        console.warn('[IdramAdapter] No signature in webhook');
        return false;
      }

      // Reconstruct signature string from webhook data
      const signatureString = [
        body.EDP_REC_ACCOUNT || body.merchantId,
        body.EDP_REC_AMOUNT || body.amount,
        body.EDP_BILL_NO || body.orderId,
        body.EDP_TRANS_ID || body.transactionId,
        body.EDP_PAYER_ACCOUNT || body.payerAccount,
      ].join(':');

      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(signatureString)
        .digest('hex');

      const isValid = receivedSignature.toLowerCase() === expectedSignature.toLowerCase();

      console.log('[IdramAdapter] Webhook signature verification:', {
        isValid,
        orderId: body.EDP_BILL_NO || body.orderId,
      });

      return isValid;
    } catch (error) {
      console.error('[IdramAdapter] Error verifying webhook:', error);
      return false;
    }
  }

  /**
   * Process webhook callback from Idram
   */
  async processWebhook(request) {
    try {
      const body = request.body;
      
      console.log('[IdramAdapter] Processing webhook:', {
        orderId: body.EDP_BILL_NO || body.orderId,
        status: body.EDP_TRANS_STATUS || body.status,
        transactionId: body.EDP_TRANS_ID || body.transactionId,
      });

      const orderId = body.EDP_BILL_NO || body.orderId;
      const transactionId = body.EDP_TRANS_ID || body.transactionId;
      const status = body.EDP_TRANS_STATUS || body.status;

      // Map Idram status to our payment status
      let paymentStatus = 'pending';
      if (status === 'OK' || status === 'success' || status === 'completed') {
        paymentStatus = 'paid';
      } else if (status === 'FAILED' || status === 'failed' || status === 'error') {
        paymentStatus = 'failed';
      } else if (status === 'CANCELLED' || status === 'cancelled') {
        paymentStatus = 'cancelled';
      }

      return {
        orderId,
        status: paymentStatus,
        transactionId,
        amount: body.EDP_REC_AMOUNT || body.amount,
        metadata: body,
      };
    } catch (error) {
      console.error('[IdramAdapter] Error processing webhook:', error);
      throw error;
    }
  }

  /**
   * Process refund (if supported by Idram)
   */
  async processRefund(paymentId, amount) {
    try {
      console.log('[IdramAdapter] Processing refund:', { paymentId, amount });
      
      // Idram refund implementation
      // This would typically make an API call to Idram's refund endpoint
      
      throw new Error('Refund not implemented for Idram yet');
    } catch (error) {
      console.error('[IdramAdapter] Error processing refund:', error);
      throw error;
    }
  }
}

module.exports = IdramAdapter;

