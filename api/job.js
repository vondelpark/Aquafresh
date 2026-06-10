/**
 * Aquafresh Boats — Cleaner Job API
 *
 * GET  /api/job?id=AQ-XXX&k=jobkey   — job details for the cleaner page
 * POST /api/job                      — mark job complete
 *      body: { id, k, comments?, photo? (base64 data URL) }
 *
 * On completion the customer receives a WhatsApp message
 * (with the after-photo if one was taken).
 */

const store = require('../lib/store');
const wa = require('../lib/whatsapp');
const CONFIG = require('../lib/config');

const PHOTO_TTL = 60 * 60 * 24 * 90; // 90 days

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { id, k } = req.query;
    const booking = await authBooking(id, k);
    if (!booking) return res.status(404).json({ error: 'Not found' });

    return res.status(200).json({
      booking_id: booking.booking_id,
      customer_name: booking.customer_name,
      phone_number: booking.phone_number,
      boat_length_m: booking.boat_length_m,
      boat_width_m: booking.boat_width_m,
      estimated_area_m2: booking.estimated_area_m2,
      service_tier: booking.tier_label || booking.service_tier,
      quoted_amount_eur: booking.quoted_amount_eur,
      preferred_date: booking.preferred_date,
      preferred_time: booking.preferred_time,
      boat_location: booking.boat_location,
      boat_latitude: booking.boat_latitude || null,
      boat_longitude: booking.boat_longitude || null,
      notes: booking.notes || null,
      has_photo: !!booking.boat_photo_id,
      booking_status: booking.booking_status,
      payment_status: booking.payment_status,
      completed_at: booking.completed_at || null,
      cleaner_comments: booking.cleaner_comments || null,
    });
  }

  if (req.method === 'POST') {
    const { id, k, comments, photo } = req.body || {};
    const booking = await authBooking(id, k);
    if (!booking) return res.status(404).json({ error: 'Not found' });

    if (booking.booking_status === 'Completed') {
      return res.status(200).json({ status: 'already_completed' });
    }

    // Store the after-photo (base64 data URL, compressed client-side)
    let hasAfterPhoto = false;
    if (photo && /^data:image\/(jpeg|png|webp);base64,/.test(photo) && photo.length < 900000) {
      try {
        await store.setRaw(`photo:${booking.booking_id}`, { data: photo, ttl_set: Date.now() });
        hasAfterPhoto = true;
      } catch (err) {
        console.error('[Job API - Photo]', err.message);
      }
    }

    booking.booking_status = 'Completed';
    booking.completed_at = new Date().toISOString();
    booking.cleaner_comments = (comments || '').trim() || null;
    booking.has_after_photo = hasAfterPhoto;
    await store.saveBooking(booking);

    // Notify the customer
    const doneMsg =
      `✨ *Je boot is schoongemaakt!*\n\n` +
      `Boeking *${booking.booking_id}* is afgerond.\n` +
      (booking.cleaner_comments ? `\n📝 Opmerking van onze schoonmaker:\n_${booking.cleaner_comments}_\n` : '') +
      `\nBedankt dat je voor Aquafresh Boats hebt gekozen! ` +
      `Tevreden? We waarderen een aanbeveling aan mede-booteigenaren. 🚤`;

    try {
      if (hasAfterPhoto) {
        const photoUrl = `${CONFIG.SITE_URL}/api/media?done=${encodeURIComponent(booking.booking_id)}`;
        await wa.sendImage(booking.phone_number, photoUrl, doneMsg);
      } else {
        await wa.sendText(booking.phone_number, doneMsg);
      }
    } catch (err) {
      console.error('[Job API - WA notify]', err.message);
    }

    return res.status(200).json({ status: 'completed' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

async function authBooking(id, key) {
  if (!id || !key) return null;
  const booking = await store.getBooking(id);
  if (!booking) return null;
  if (!booking.job_key || booking.job_key !== key) return null;
  return booking;
}
