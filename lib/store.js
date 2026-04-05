/**
 * Aquafresh Boats — Data store (Upstash Redis)
 *
 * Stores conversation state and booking records.
 * Keys:
 *   conv:{phone}   — conversation state (JSON, TTL 24h)
 *   book:{id}      — booking record (JSON, TTL 90 days)
 */

const { Redis } = require('@upstash/redis');
const CONFIG = require('./config');

let redis = null;

function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: CONFIG.UPSTASH_REDIS_REST_URL,
      token: CONFIG.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

const CONV_TTL = 60 * 60 * 24;       // 24 hours
const BOOKING_TTL = 60 * 60 * 24 * 90; // 90 days

/* ===== Conversation State ===== */

async function getConversation(phone) {
  const data = await getRedis().get(`conv:${phone}`);
  if (!data) {
    return {
      phone,
      state: 'idle',
      data: {},
      created_at: new Date().toISOString(),
    };
  }
  return typeof data === 'string' ? JSON.parse(data) : data;
}

async function setConversation(phone, conv) {
  await getRedis().set(`conv:${phone}`, JSON.stringify(conv), { ex: CONV_TTL });
}

async function clearConversation(phone) {
  await getRedis().del(`conv:${phone}`);
}

/* ===== Booking Records ===== */

function generateBookingId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `AQ-${ts}-${rand}`.toUpperCase();
}

async function saveBooking(booking) {
  await getRedis().set(`book:${booking.booking_id}`, JSON.stringify(booking), { ex: BOOKING_TTL });
}

async function getBooking(bookingId) {
  const data = await getRedis().get(`book:${bookingId}`);
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

async function updateBooking(bookingId, updates) {
  const booking = await getBooking(bookingId);
  if (!booking) return null;
  Object.assign(booking, updates);
  await saveBooking(booking);
  return booking;
}

module.exports = {
  getConversation,
  setConversation,
  clearConversation,
  generateBookingId,
  saveBooking,
  getBooking,
  updateBooking,
};
