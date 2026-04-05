/**
 * Aquafresh Boats — Tikkie payment integration
 *
 * Creates Tikkie payment requests via the ABN AMRO Tikkie API.
 * Docs: https://developer.abnamro.com/api-products/tikkie
 *
 * Requires: TIKKIE_API_KEY, TIKKIE_APP_TOKEN
 * Set TIKKIE_SANDBOX=true for testing with sandbox API.
 */

const CONFIG = require('./config');

const PROD_URL = 'https://api.abnamro.com/v2/tikkie/paymentrequests';
const SANDBOX_URL = 'https://api-sandbox.abnamro.com/v2/tikkie/paymentrequests';

/**
 * Create a Tikkie payment request.
 * @param {object} booking
 * @returns {string} payment URL
 */
async function createPaymentRequest(booking) {
  if (!CONFIG.TIKKIE_API_KEY || !CONFIG.TIKKIE_APP_TOKEN) {
    throw new Error('Tikkie not configured');
  }

  const apiUrl = CONFIG.TIKKIE_SANDBOX ? SANDBOX_URL : PROD_URL;

  // Amount in cents
  const amountInCents = Math.round(booking.quoted_amount_eur * 100);

  const body = {
    amountInCents,
    description: `Aquafresh Boats - ${booking.service_tier} - ${booking.customer_name}`,
    externalId: booking.booking_id,
    referenceId: booking.booking_id,
    expiryDate: getExpiryDate(3), // expires in 3 days
  };

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'API-Key': CONFIG.TIKKIE_API_KEY,
      'X-App-Token': CONFIG.TIKKIE_APP_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tikkie API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.url;
}

/**
 * Verify a Tikkie payment notification (webhook callback).
 * @param {object} payload — the POST body from Tikkie
 * @returns {{ bookingId: string, paid: boolean, amount: number }}
 */
function parsePaymentNotification(payload) {
  // Tikkie sends a notification with paymentRequestToken and status
  const status = (payload.status || '').toUpperCase();
  const paid = status === 'PAID' || status === 'SETTLED';
  const bookingId = payload.externalId || payload.referenceId || '';
  const amount = (payload.amountInCents || 0) / 100;

  return { bookingId, paid, amount };
}

/**
 * Get expiry date string (YYYY-MM-DD) N days from now.
 */
function getExpiryDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = { createPaymentRequest, parsePaymentNotification };
