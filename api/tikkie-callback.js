/**
 * Aquafresh Boats — Tikkie Payment Callback
 *
 * POST /api/tikkie-callback
 *
 * Receives payment status updates from Tikkie.
 * Updates booking status and sends WhatsApp confirmation.
 */

const store = require('../lib/store');
const wa = require('../lib/whatsapp');
const tikkie = require('../lib/tikkie');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const payload = req.body;
    const { bookingId, paid, amount } = tikkie.parsePaymentNotification(payload);

    if (!bookingId) {
      console.warn('[Tikkie Callback] No booking ID in payload');
      return res.status(200).json({ status: 'ignored' });
    }

    const booking = await store.getBooking(bookingId);
    if (!booking) {
      console.warn('[Tikkie Callback] Booking not found:', bookingId);
      return res.status(200).json({ status: 'not_found' });
    }

    if (paid) {
      await store.updateBooking(bookingId, {
        booking_status: 'Confirmed',
        payment_status: 'Paid',
      });

      // Send confirmation to customer via WhatsApp
      await wa.sendText(booking.phone_number,
        `✅ *Betaling ontvangen!*\n\n` +
        `€${amount || booking.quoted_amount_eur} voor boeking *${bookingId}*.\n\n` +
        `Je afspraak staat vast op *${booking.preferred_date}* om *${booking.preferred_time}*.\n` +
        `📍 ${booking.boat_location}\n\n` +
        `We sturen je 24 uur van tevoren nog een herinnering. Tot dan! 🚤`
      );

      console.log('[Tikkie Callback] Payment confirmed for', bookingId);
    } else {
      await store.updateBooking(bookingId, {
        booking_status: 'Booked - Payment Failed',
        payment_status: 'Failed',
      });

      await wa.sendText(booking.phone_number,
        `⚠️ Er is een probleem met de betaling voor boeking *${bookingId}*.\n\n` +
        (booking.tikkie_url
          ? `Probeer opnieuw via deze link:\n${booking.tikkie_url}`
          : 'Neem contact met ons op voor een nieuwe betaallink.')
      );

      console.log('[Tikkie Callback] Payment failed for', bookingId);
    }

    return res.status(200).json({ status: 'processed' });
  } catch (err) {
    console.error('[Tikkie Callback] Error:', err);
    return res.status(200).json({ status: 'error' });
  }
};
