/**
 * Aquafresh Boats — Pricing calculator
 *
 * Surface area = boat_length_m × boat_width_m
 * Price = area × rate_per_m2
 *
 * Rates are stored in Redis (config:pricing) and managed via the admin panel.
 * Falls back to defaults if Redis is unavailable.
 */

const store = require('./store');

const PRICING_KEY = 'config:pricing';

const DEFAULTS = {
  basic: 1.50,
  extra: 2.00,
  heavy: 2.50,
};

const TIER_META = {
  basic: {
    label: 'Basic',
    description: 'Standard cleaning of accessible fiberglass, wood and metal surfaces.',
  },
  extra: {
    label: 'Extra',
    description: 'Includes teak surfaces and harder-to-clean areas.',
  },
  'heavy duty': {
    label: 'Heavy Duty',
    description: 'Deep cleaning for stubborn dirt and heavier cleaning work.',
  },
};

let cachedRates = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 1000; // refresh from Redis every 60 seconds

async function getRates() {
  const now = Date.now();
  if (cachedRates && (now - cacheTime) < CACHE_TTL) {
    return cachedRates;
  }
  try {
    const data = await store.getRaw(PRICING_KEY);
    if (data && data.basic) {
      cachedRates = data;
      cacheTime = now;
      return cachedRates;
    }
  } catch (err) {
    console.error('[Pricing] Redis read error:', err.message);
  }
  return DEFAULTS;
}

function normalizeTier(input) {
  if (!input) return null;
  const s = input.toLowerCase().trim();
  if (s === 'basic') return 'basic';
  if (s === 'extra') return 'extra';
  if (s.includes('heavy')) return 'heavy duty';
  return null;
}

async function calculateQuote(boatLengthM, boatWidthM, tierKey) {
  const rates = await getRates();
  const meta = TIER_META[tierKey];
  if (!meta) throw new Error(`Unknown tier: ${tierKey}`);

  const rateKey = tierKey === 'heavy duty' ? 'heavy' : tierKey;
  const pricePerM2 = rates[rateKey] || DEFAULTS[rateKey];

  const area = Math.round(boatLengthM * boatWidthM * 10) / 10;
  const total = Math.round(area * pricePerM2);

  return {
    tier: meta.label,
    area_m2: area,
    price_per_m2: pricePerM2,
    total_eur: total,
  };
}

async function tierListText() {
  const rates = await getRates();
  return Object.entries(TIER_META)
    .map(([key, meta]) => {
      const rateKey = key === 'heavy duty' ? 'heavy' : key;
      const rate = rates[rateKey] || DEFAULTS[rateKey];
      return `• *${meta.label}* (€${rate.toFixed(2)}/m²) — ${meta.description}`;
    })
    .join('\n');
}

module.exports = { DEFAULTS, TIER_META, normalizeTier, calculateQuote, tierListText, getRates };
