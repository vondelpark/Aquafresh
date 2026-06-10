/**
 * Aquafresh Boats — Media proxy
 *
 * GET /api/media?id=AQ-XXX&k=jobkey   — customer's boat photo (proxied from WhatsApp)
 * GET /api/media?done=AQ-XXX          — cleaner's after-photo (stored in Redis)
 */

const store = require('../lib/store');
const wa = require('../lib/whatsapp');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // After-photo (completion) — public by unguessable booking ID
  if (req.query.done) {
    const stored = await store.getRaw(`photo:${req.query.done}`);
    if (!stored || !stored.data) return res.status(404).send('Not found');

    const match = stored.data.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return res.status(404).send('Not found');

    const buffer = Buffer.from(match[2], 'base64');
    res.setHeader('Content-Type', match[1]);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(buffer);
  }

  // Boat photo — requires the job key
  const { id, k } = req.query;
  if (!id || !k) return res.status(400).send('Missing parameters');

  const booking = await store.getBooking(id);
  if (!booking || booking.job_key !== k || !booking.boat_photo_id) {
    return res.status(404).send('Not found');
  }

  try {
    const media = await wa.fetchMedia(booking.boat_photo_id);
    if (!media) return res.status(404).send('Media unavailable');

    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(media.buffer);
  } catch (err) {
    console.error('[Media API]', err.message);
    return res.status(500).send('Error fetching media');
  }
};
