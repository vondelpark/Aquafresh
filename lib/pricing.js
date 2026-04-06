/**
 * Aquafresh Boats — Pricing calculator
 *
 * Surface area = boat_length_m × boat_width_m
 * Price = area × rate_per_m2, subject to minimum
 */

const TIERS = {
  basic: {
    label: 'Basic',
    price_per_m2: 1.50,
    description: 'Standard cleaning of accessible fiberglass, wood and metal surfaces.',
  },
  extra: {
    label: 'Extra',
    price_per_m2: 2.00,
    description: 'Includes teak surfaces and harder-to-clean areas.',
  },
  'heavy duty': {
    label: 'Heavy Duty',
    price_per_m2: 2.50,
    description: 'Deep cleaning for stubborn dirt and heavier cleaning work.',
  },
};

const MINIMUM_PRICE = 0;

/**
 * Normalize tier input to a valid key.
 */
function normalizeTier(input) {
  if (!input) return null;
  const s = input.toLowerCase().trim();
  if (s === 'basic') return 'basic';
  if (s === 'extra') return 'extra';
  if (s.includes('heavy')) return 'heavy duty';
  return null;
}

/**
 * Calculate quote using actual length × width.
 * @param {number} boatLengthM
 * @param {number} boatWidthM
 * @param {string} tierKey — normalized tier key
 * @returns {{ tier, area_m2, price_per_m2, total_eur }}
 */
function calculateQuote(boatLengthM, boatWidthM, tierKey) {
  const tier = TIERS[tierKey];
  if (!tier) throw new Error(`Unknown tier: ${tierKey}`);

  const area = Math.round(boatLengthM * boatWidthM * 10) / 10;
  const raw = area * tier.price_per_m2;
  const total = Math.max(MINIMUM_PRICE, Math.round(raw));

  return {
    tier: tier.label,
    area_m2: area,
    price_per_m2: tier.price_per_m2,
    total_eur: total,
  };
}

/**
 * Build a human-readable tier list for WhatsApp messages.
 */
function tierListText() {
  return Object.values(TIERS)
    .map((t) => `• *${t.label}* (€${t.price_per_m2.toFixed(2)}/m²) — ${t.description}`)
    .join('\n');
}

module.exports = { TIERS, MINIMUM_PRICE, normalizeTier, calculateQuote, tierListText };
