/**
 * Aquafresh Boats — Revolut Payment Callback
 *
 * POST /api/revolut-callback
 *
 * Receives payment status updates from Revolut webhooks.
 * Updates booking status and sends WhatsApp confirmation.
 */

const store = require('../lib/store');
const wa = require('../lib/whatsapp');
const revolut = require('../lib/revolut');

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
      await store.updateBooking(bookingId, {
        booking_status: 'Confirmed',
        payment_status: 'Paid',
      });

      // Send confirmation to customer via WhatsApp
      await wa.sendText(booking.phone_number,
        `\u2705 *Betaling ontvangen!*\n\n` +
        `\u20AC${amount || booking.quoted_amount_eur} voor boeking *${bookingId}*.\n\n` +
        `Je afspraak staat vast op *${booking.preferred_date}* om *${booking.preferred_time}*.\n` +
        `\uD83D\uDCCD ${booking.boat_location}\n\n` +
        `We sturen je 24 uur van tevoren nog een herinnering. Tot dan! \uD83D\uDEA4`
      );

      console.log('[Revolut Callback] Payment confirmed for', bookingId);
    } else if (failed) {
      await store.updateBooking(bookingId, {
        booking_status: 'Booked - Payment Failed',
        payment_status: 'Failed',
      });

      await wa.sendText(booking.phone_number,
        `\u26A0\uFE0F Er is een probleem met de betaling voor boeking *${bookingId}*.\n\n` +
        (booking.payment_url
          ? `Probeer opnieuw via deze link:\n${booking.payment_url}`
          : 'Neem contact met ons op voor een nieuwe betaallink.')
      );

      console.log('[Revolut Callback] Payment failed for', bookingId);
    } else {
      // Other status (pending, processing) — acknowledge but don't act
      console.log('[Revolut Callback] Status update for', bookingId, ':', payload.event || 'unknown');
    }

    return res.status(200).json({ status: 'processed' });
  } catch (err) {
    console.error('[Revolut Callback] Error:', err);
    return res.status(200).json({ status: 'error' });
  }
};
