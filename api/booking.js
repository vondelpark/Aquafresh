/**
 * Aquafresh Boats — Online Booking Endpoint
 *
 * POST /api/booking
 *
 * Receives bookings from the website form, saves to store,
 * creates calendar event, and sends WhatsApp notification to owner.
 */

const store = require('../lib/store');
const wa = require('../lib/whatsapp');
const calendar = require('../lib/calendar');
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

    const bookingId = store.generateBookingId();

    const booking = {
      booking_id: bookingId,
      created_at: new Date().toISOString(),
      source: 'website',
      customer_name: data.customer_name,
      phone_number: data.phone_number,
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
      booking_status: 'Booked - Pending Confirmation',
      payment_status: 'Pending',
      tikkie_url: null,
      calendar_event_id: null,
    };

    // Save booking
    await store.saveBooking(booking);

    // Try to create calendar event
    try {
      const eventId = await calendar.createEvent(booking);
      booking.calendar_event_id = eventId;
      await store.saveBooking(booking);
    } catch (err) {
      console.error('[Booking API - Calendar]', err.message);
    }

    // Notify the business owner via WhatsApp (if configured)
    try {
      if (CONFIG.WA_ACCESS_TOKEN && CONFIG.WA_PHONE_NUMBER_ID) {
        // Send to the business's own WhatsApp number
        const ownerPhone = CONFIG.OWNER_PHONE || '';
        if (ownerPhone) {
          const msg =
            `🆕 *Nieuwe online boeking!*\n\n` +
            `📋 Boeking: *${bookingId}*\n` +
            `👤 ${booking.customer_name}\n` +
            `📞 ${booking.phone_number}\n` +
            (booking.email ? `📧 ${booking.email}\n` : '') +
            `🚤 Boot: ${booking.boat_length_m}m × ${booking.boat_width_m}m (${booking.estimated_area_m2} m²)\n` +
            `🧹 ${booking.tier_label} (€${booking.price_per_m2}/m²)\n` +
            `📅 ${booking.preferred_date} om ${booking.preferred_time}\n` +
            `📍 ${booking.boat_location}\n` +
            `💰 €${booking.quoted_amount_eur}\n` +
            (booking.notes ? `📝 ${booking.notes}\n` : '') +
            `\nBron: Website`;

          await wa.sendText(ownerPhone, msg);
        }
      }
    } catch (err) {
      console.error('[Booking API - WA Notify]', err.message);
    }

    return res.status(200).json({
      booking_id: bookingId,
      status: 'received',
    });

  } catch (err) {
    console.error('[Booking API]', err);
    return res.status(500).json({ error: 'Internal error' });
  }
};
