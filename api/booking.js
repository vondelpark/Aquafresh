/**
 * Aquafresh Boats — Online Booking Endpoint
 *
 * POST /api/booking
 *
 * Receives bookings from the website form, checks availability,
 * saves to store, and returns a Revolut payment link.
 * The booking is committed (calendar event + cleaner dispatch)
 * by the Revolut callback once payment completes.
 */

const store = require('../lib/store');
const wa = require('../lib/whatsapp');
const calendar = require('../lib/calendar');
const revolut = require('../lib/revolut');
const CONFIG = require('../lib/config');

module.exports = async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;

    // Validate required fields
    if (!data.customer_name || !data.phone_number || !data.boat_length_m ||
        !data.boat_width_m || !data.service_tier || !data.preferred_date || !data.boat_location) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check the slot is still free
    try {
      const slot = data.preferred_time === 'afternoon' ? '12:00-17:00' : '08:00-12:00';
      const check = await calendar.checkAvailability(data.preferred_date, slot);
      if (!check.available && data.preferred_time !== 'flexible') {
        return res.status(409).json({ error: 'slot_taken' });
      }
    } catch (err) {
      console.error('[Booking API - Availability]', err.message);
    }

    const bookingId = store.generateBookingId();

    // Normalize phone to international digits (e.g. "+31 6 19..." → "31619...")
    let phone = String(data.phone_number).replace(/\D/g, '');
    if (phone.startsWith('0031')) phone = phone.slice(2);
    else if (phone.startsWith('0') && phone.length === 10) phone = '31' + phone.slice(1);

    const booking = {
      booking_id: bookingId,
      job_key: store.generateJobKey(),
      created_at: new Date().toISOString(),
      source: 'website',
      customer_name: data.customer_name,
      phone_number: phone,
      email: data.email || null,
      boat_length_m: data.boat_length_m,
      boat_width_m: data.boat_width_m,
      estimated_area_m2: data.estimated_area_m2,
      service_tier: data.service_tier,
      tier_label: data.tier_label,
      price_per_m2: data.price_per_m2,
      quoted_amount_eur: data.quoted_amount_eur,
      preferred_date: data.preferred_date,
      preferred_time: data.preferred_time,
      boat_location: data.boat_location,
      notes: data.notes || null,
      language: data.language || 'nl',
      booking_status: 'Pending Payment',
      payment_status: 'Pending',
      payment_url: null,
      calendar_event_id: null,
    };

    // Generate Revolut payment link
    try {
      booking.payment_url = await revolut.createPaymentRequest(booking);
    } catch (err) {
      console.error('[Booking API - Revolut]', err.message);
    }

    await store.saveBooking(booking);

    // If payments aren't configured, fall back to manual confirmation:
    // notify the owner so they can follow up directly.
    if (!booking.payment_url && CONFIG.WA_ACCESS_TOKEN && CONFIG.OWNER_PHONE) {
      const msg =
        `🆕 *Nieuwe online boeking (handmatig bevestigen)*\n\n` +
        `📋 ${bookingId}\n` +
        `👤 ${booking.customer_name}\n` +
        `📞 ${booking.phone_number}\n` +
        (booking.email ? `📧 ${booking.email}\n` : '') +
        `🚤 ${booking.boat_length_m}m × ${booking.boat_width_m}m (${booking.estimated_area_m2} m²)\n` +
        `🧹 ${booking.tier_label} (€${booking.price_per_m2}/m²)\n` +
        `📅 ${booking.preferred_date} om ${booking.preferred_time}\n` +
        `📍 ${booking.boat_location}\n` +
        `💰 €${booking.quoted_amount_eur}\n` +
        (booking.notes ? `📝 ${booking.notes}\n` : '') +
        `\nBron: Website — betaallink kon niet worden aangemaakt.`;
      await wa.sendText(CONFIG.OWNER_PHONE, msg).catch(() => {});
    }

    return res.status(200).json({
      booking_id: bookingId,
      status: 'pending_payment',
      payment_url: booking.payment_url,
    });

  } catch (err) {
    console.error('[Booking API]', err);
    return res.status(500).json({ error: 'Internal error' });
  }
};
