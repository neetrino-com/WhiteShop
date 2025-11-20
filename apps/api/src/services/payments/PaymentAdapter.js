/**
 * Base Payment Adapter Interface
 * All payment adapters must implement this interface
 */
class PaymentAdapter {
  /**
   * Create a payment and return payment URL
   * @param {Object} order - Order object
   * @param {Object} options - Additional options
   * @returns {Promise<{paymentUrl: string, paymentId: string, expiresAt: Date}>}
   */
  async createPayment(order, options = {}) {
    throw new Error('createPayment must be implemented');
  }

  /**
   * Verify webhook signature
   * @param {Object} request - Express request object
   * @returns {Promise<boolean>}
   */
  async verifyWebhook(request) {
    throw new Error('verifyWebhook must be implemented');
  }

  /**
   * Process webhook callback
   * @param {Object} request - Express request object
   * @returns {Promise<{orderId: string, status: string, transactionId: string}>}
   */
  async processWebhook(request) {
    throw new Error('processWebhook must be implemented');
  }

  /**
   * Process refund
   * @param {string} paymentId - Payment transaction ID
   * @param {number} amount - Refund amount
   * @returns {Promise<{success: boolean, transactionId: string}>}
   */
  async processRefund(paymentId, amount) {
    throw new Error('processRefund must be implemented');
  }
}

module.exports = PaymentAdapter;

