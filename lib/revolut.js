/**
 * Aquafresh Boats — Revolut payment integration
 *
 * Creates payment links via the Revolut Business Merchant API.
 * Docs: https://developer.revolut.com/docs/merchant/
 *
 * Requires: REVOLUT_API_SECRET_KEY
 * Set REVOLUT_SANDBOX=true for testing with sandbox API.
 */

const CONFIG = require('./config');

const PROD_URL = 'https://merchant.revolut.com/api/1.0/orders';
const SANDBOX_URL = 'https://sandbox-merchant.revolut.com/api/1.0/orders';

/**
 * Create a Revolut payment order with a checkout link.
 * @param {object} booking
 * @returns {string} payment checkout URL
 */
async function createPaymentRequest(booking) {
  if (!CONFIG.REVOLUT_API_SECRET_KEY) {
    throw new Error('Revolut not configured');
  }

  const apiUrl = CONFIG.REVOLUT_SANDBOX ? SANDBOX_URL : PROD_URL;

  // Amount in minor units (cents)
  const amountInCents = Math.round(booking.quoted_amount_eur * 100);

  const body = {
    amount: amountInCents,
    currency: 'EUR',
    description: `Aquafresh Boats - ${booking.service_tier} - ${booking.customer_name}`,
    merchant_order_ext_ref: booking.booking_id,
    customer_email: booking.email || undefined,
  };

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.REVOLUT_API_SECRET_KEY}`,
      'Content-Type': 'application/json',
      'Revolut-Api-Version': '2024-09-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Revolut API ${res.status}: ${err}`);
  }

  const data = await res.json();

  // The checkout_url is the payment link for the customer
  return data.checkout_url || data.public_id
    ? `https://pay.revolut.com/payment-link/${data.public_id}`
    : null;
}

/**
 * Parse a Revolut webhook notification.
 * @param {object} payload — the POST body from Revolut
 * @returns {{ bookingId: string, paid: boolean, amount: number, orderId: string }}
 */
function parsePaymentNotification(payload) {
  const event = payload.event || '';
  const order = payload.order || payload;

  const state = (order.state || '').toUpperCase();
  const paid = state === 'COMPLETED' || event === 'ORDER_COMPLETED';
  const failed = state === 'CANCELLED' || state === 'FAILED';

  const bookingId = order.merchant_order_ext_ref || '';
  const amount = (order.amount || 0) / 100;
  const orderId = order.id || '';

  return { bookingId, paid, failed, amount, orderId };
}

/**
 * Verify Revolut webhook signature (optional but recommended).
 * @param {string} body — raw request body
 * @param {string} signature — value of Revolut-Signature header
 * @returns {boolean}
 */
function verifyWebhookSignature(body, signature) {
  if (!CONFIG.REVOLUT_WEBHOOK_SECRET || !signature) return true; // skip if not configured

  const crypto = require('crypto');
  const expectedSig = crypto
    .createHmac('sha256', CONFIG.REVOLUT_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSig)
  );
}

module.exports = { createPaymentRequest, parsePaymentNotification, verifyWebhookSignature };
