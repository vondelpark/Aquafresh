/**
 * Aquafresh Boats — Shared configuration
 * All env vars are set in Vercel project settings.
 */

const CONFIG = {
  // --- WhatsApp Cloud API ---
  WA_PHONE_NUMBER_ID: process.env.WA_PHONE_NUMBER_ID || '',
  WA_ACCESS_TOKEN: process.env.WA_ACCESS_TOKEN || '',
  WA_VERIFY_TOKEN: process.env.WA_VERIFY_TOKEN || 'aquafresh-verify-token',
  WA_APP_SECRET: process.env.WA_APP_SECRET || '',

  // --- Revolut Business API ---
  REVOLUT_API_SECRET_KEY: process.env.REVOLUT_API_SECRET_KEY || '',
  REVOLUT_WEBHOOK_SECRET: process.env.REVOLUT_WEBHOOK_SECRET || '',
  REVOLUT_SANDBOX: process.env.REVOLUT_SANDBOX === 'true',

  // --- Google Calendar ---
  GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || 'aquafreshboats@gmail.com',
  GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
  GOOGLE_PRIVATE_KEY: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),

  // --- Upstash Redis ---
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',

  // --- Business Owner ---
  OWNER_PHONE: process.env.OWNER_PHONE || '',

  // --- Base URL (for webhooks) ---
  BASE_URL: process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BASE_URL || 'http://localhost:3000',
};

module.exports = CONFIG;
