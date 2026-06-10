/**
 * Aquafresh Boats — Availability API
 *
 * GET /api/availability?date=YYYY-MM-DD
 * Returns which time slots are free on the given date,
 * based on the Google Calendar.
 */

const calendar = require('../lib/calendar');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const date = (req.query.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date, expected YYYY-MM-DD' });
  }

  try {
    const [morning, afternoon] = await Promise.all([
      calendar.checkAvailability(date, '08:00-12:00'),
      calendar.checkAvailability(date, '12:00-17:00'),
    ]);

    return res.status(200).json({
      date,
      morning: morning.available,
      afternoon: afternoon.available,
    });
  } catch (err) {
    console.error('[Availability API]', err.message);
    // If calendar fails, assume open so bookings aren't blocked
    return res.status(200).json({ date, morning: true, afternoon: true });
  }
};
