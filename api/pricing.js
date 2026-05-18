/**
 * Aquafresh Boats — Pricing API
 *
 * GET  /api/pricing — read current tier rates (public)
 * POST /api/pricing — update tier rates (requires admin key)
 */

const store = require('../lib/store');

const PRICING_KEY = 'config:pricing';
const ADMIN_KEY = 'admin 123';

const DEFAULTS = {
  basic: 1.50,
  extra: 2.00,
  heavy: 2.50,
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const data = await store.getRaw(PRICING_KEY);
      return res.status(200).json(data || DEFAULTS);
    } catch (err) {
      console.error('[Pricing API] Read error:', err.message);
      return res.status(200).json(DEFAULTS);
    }
  }

  if (req.method === 'POST') {
    const authHeader = req.headers['x-admin-key'] || '';
    if (authHeader !== ADMIN_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const body = req.body;
      const pricing = {
        basic: parseFloat(body.basic) || DEFAULTS.basic,
        extra: parseFloat(body.extra) || DEFAULTS.extra,
        heavy: parseFloat(body.heavy) || DEFAULTS.heavy,
      };

      await store.setRaw(PRICING_KEY, pricing);
      return res.status(200).json({ status: 'saved', pricing });
    } catch (err) {
      console.error('[Pricing API] Write error:', err.message);
      return res.status(500).json({ error: 'Failed to save' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
