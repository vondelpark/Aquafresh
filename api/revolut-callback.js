/**
 * Aquafresh Boats — Revolut Payment Callback
 *
 * POST /api/revolut-callback
 *
 * Receives payment status updates from Revolut webhooks.
 * On successful payment:
 *   1. Booking is committed (status Confirmed)
 *   2. Google Calendar event is created
 *   3. Customer gets a WhatsApp confirmation
 *   4. Cleaner gets a WhatsApp with the job link (map, photo, instructions)
 */

const store = require('../lib/store');
const wa = require('../lib/whatsapp');
const revolut = require('../lib/revolut');
const calendar = require('../lib/calendar');
const CONFIG = require('../lib/config');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const payload = req.body;
    const { bookingId, paid, failed, amount } = revolut.parsePaymentNotification(payload);

    if (!bookingId) {
      console.warn('[Revolut Callback] No booking ID in payload');
      return res.status(200).json({ status: 'ignored' });
    }

    const booking = await store.getBooking(bookingId);
    if (!booking) {
      console.warn('[Revolut Callback] Booking not found:', bookingId);
      return res.status(200).json({ status: 'not_found' });
    }

    if (paid) {
      booking.booking_status = 'Confirmed';
      booking.payment_status = 'Paid';
      booking.paid_at = new Date().toISOString();

      // Commit: create the calendar event now that payment is in
      if (!booking.calendar_event_id) {
        try {
          booking.calendar_event_id = await calendar.createEvent(booking);
        } catch (err) {
          console.error('[Revolut Callback - Calendar]', err.message);
        }
      }

      await store.saveBooking(booking);

      // 1. Confirm to customer
      await wa.sendText(booking.phone_number,
        `✅ *Betaling ontvangen — boeking definitief!*\n\n` +
        `€${amount || booking.quoted_amount_eur} voor boeking *${bookingId}*.\n\n` +
        `Je afspraak staat vast op *${booking.preferred_date}* om *${booking.preferred_time}*.\n` +
        `📍 ${booking.boat_location}\n\n` +
        `We sturen je 24 uur van tevoren nog een herinnering. Tot dan! 🚤`
      ).catch((e) => console.error('[WA customer]', e));

      // 2. Dispatch job to the cleaner
      if (CONFIG.OWNER_PHONE) {
        const jobUrl = `${CONFIG.SITE_URL}/job.html?id=${encodeURIComponent(bookingId)}&k=${booking.job_key || ''}`;
        const mapsUrl = booking.boat_latitude && booking.boat_longitude
          ? `https://maps.google.com/?q=${booking.boat_latitude},${booking.boat_longitude}`
          : null;

        const jobMsg =
          `🧽 *Nieuwe klus — betaald & bevestigd!*\n\n` +
          `📋 ${bookingId}\n` +
          `👤 ${booking.customer_name} (${booking.phone_number})\n` +
          `🚤 ${booking.boat_length_m}m × ${booking.boat_width_m}m (${booking.estimated_area_m2} m²)\n` +
          `🧹 ${booking.service_tier} — €${booking.quoted_amount_eur}\n` +
          `📅 ${booking.preferred_date} om ${booking.preferred_time}\n` +
          `📍 ${booking.boat_location}\n` +
          (mapsUrl ? `🗺️ ${mapsUrl}\n` : '') +
          (booking.notes ? `📝 ${booking.notes}\n` : '') +
          `\n🔗 *Klusdetails + foto + afronden:*\n${jobUrl}`;

        await wa.sendText(CONFIG.OWNER_PHONE, jobMsg)
          .catch((e) => console.error('[WA cleaner]', e));
      }

      console.log('[Revolut Callback] Payment confirmed for', bookingId);
    } else if (failed) {
      await store.updateBooking(bookingId, {
        booking_status: 'Payment Failed',
        payment_status: 'Failed',
      });

      await wa.sendText(booking.phone_number,
        `⚠️ Er is een probleem met de betaling voor boeking *${bookingId}*.\n\n` +
        (booking.payment_url
          ? `Probeer opnieuw via deze link:\n${booking.payment_url}`
          : 'Neem contact met ons op voor een nieuwe betaallink.')
      ).catch((e) => console.error('[WA customer]', e));

      console.log('[Revolut Callback] Payment failed for', bookingId);
    } else {
      console.log('[Revolut Callback] Status update for', bookingId, ':', payload.event || 'unknown');
    }

    return res.status(200).json({ status: 'processed' });
  } catch (err) {
    console.error('[Revolut Callback] Error:', err);
    return res.status(200).json({ status: 'error' });
  }
};
