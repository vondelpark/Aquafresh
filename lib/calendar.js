/**
 * Aquafresh Boats — Google Calendar integration
 *
 * Uses a Google Service Account to create events and check availability.
 * Requires: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_CALENDAR_ID
 */

const CONFIG = require('./config');
const crypto = require('crypto');

const SCOPES = 'https://www.googleapis.com/auth/calendar';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Create a calendar event for a booking.
 * @param {object} booking
 * @returns {string} event ID
 */
async function createEvent(booking) {
  if (!CONFIG.GOOGLE_PRIVATE_KEY || !CONFIG.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    throw new Error('Google Calendar not configured');
  }

  const token = await getAccessToken();
  const startTime = parseStartTime(booking.preferred_date, booking.preferred_time);
  const endTime = new Date(startTime.getTime() + 120 * 60 * 1000); // 2 hours

  const event = {
    summary: `Aquafresh Boats - ${booking.customer_name} - ${booking.service_tier}`,
    description:
      `Bootlengte: ${booking.boat_length_m}m\n` +
      `Oppervlak: ${booking.estimated_area_m2} m²\n` +
      `Service: ${booking.service_tier}\n` +
      `Prijs: €${booking.quoted_amount_eur}\n` +
      `Telefoon: ${booking.phone_number}\n` +
      `Boeking: ${booking.booking_id}`,
    location: booking.boat_location,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: 'Europe/Amsterdam',
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'Europe/Amsterdam',
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
      ],
    },
  };

  const res = await fetch(
    `${CAL_BASE}/calendars/${encodeURIComponent(CONFIG.GOOGLE_CALENDAR_ID)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.id;
}

/**
 * Check if a time slot is available.
 * @param {string} dateStr — YYYY-MM-DD
 * @param {string} timeSlot — e.g. "08:00-12:00" or "Flexibel"
 * @returns {{ available: boolean, conflicting_events: number }}
 */
async function checkAvailability(dateStr, timeSlot) {
  if (!CONFIG.GOOGLE_PRIVATE_KEY || !CONFIG.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    return { available: true, conflicting_events: 0 };
  }

  const token = await getAccessToken();
  const start = parseStartTime(dateStr, timeSlot);
  const end = new Date(start.getTime() + 120 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: 'true',
    maxResults: '5',
  });

  const res = await fetch(
    `${CAL_BASE}/calendars/${encodeURIComponent(CONFIG.GOOGLE_CALENDAR_ID)}/events?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) return { available: true, conflicting_events: 0 };

  const data = await res.json();
  const count = (data.items || []).length;
  return { available: count === 0, conflicting_events: count };
}

/* ===== Internal: JWT-based auth for service accounts ===== */

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry - 60000) {
    return cachedToken;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: CONFIG.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));

  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = base64url(sign.sign(CONFIG.GOOGLE_PRIVATE_KEY));
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    throw new Error(`Google auth failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiry = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

function base64url(input) {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function parseStartTime(dateStr, timeSlot) {
  let hour = 9; // default
  if (timeSlot) {
    if (/^(\d{1,2})[:.:](\d{2})/.test(timeSlot)) {
      hour = parseInt(RegExp.$1, 10);
    } else if (/08|ochtend|morning/i.test(timeSlot)) {
      hour = 8;
    } else if (/12|middag|afternoon/i.test(timeSlot)) {
      hour = 12;
    }
  }
  return new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00+02:00`);
}

module.exports = { createEvent, checkAvailability };
