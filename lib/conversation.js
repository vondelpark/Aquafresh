/**
 * Aquafresh Boats — Conversation state machine
 *
 * States:
 *   idle              → greeting, detect intent
 *   awaiting_length   → waiting for boat length
 *   awaiting_width    → waiting for boat width
 *   awaiting_tier     → waiting for service tier selection
 *   awaiting_date     → waiting for preferred date
 *   awaiting_time     → waiting for preferred time
 *   awaiting_location → waiting for boat location (WhatsApp location pin)
 *   awaiting_name     → waiting for customer name
 *   awaiting_confirm  → quote sent, waiting for yes/no
 *   booked            → calendar booked, payment link sent
 *   completed         → payment received, done
 */

const wa = require('./whatsapp');
const store = require('./store');
const pricing = require('./pricing');
const calendar = require('./calendar');
const revolut = require('./revolut');

/**
 * Process an incoming message and advance the conversation.
 * @param {{ from: string, text: string, buttonId: string, messageId: string, location: object|null }} msg
 */
async function handleMessage(msg) {
  const { from, text, buttonId } = msg;
  const conv = await store.getConversation(from);
  const input = (buttonId || text || '').trim();
  const inputLower = input.toLowerCase();

  // Mark message as read
  wa.markRead(msg.messageId).catch(() => {});

  // Global commands
  if (inputLower === 'reset' || inputLower === 'opnieuw' || inputLower === 'cancel') {
    await store.clearConversation(from);
    await wa.sendText(from,
      'Geen probleem! Stuur een bericht als je opnieuw wilt beginnen. 👋'
    );
    return;
  }

  if (inputLower === 'diensten' || inputLower === 'services' || inputLower === 'info') {
    await wa.sendText(from,
      '*Onze diensten:*\n\n' + pricing.tierListText() +
      '\n\nWil je een offerte? Stuur "boeken" of "offerte".'
    );
    return;
  }

  // Route based on current state
  switch (conv.state) {
    case 'idle':
      await handleIdle(from, conv, inputLower);
      break;
    case 'awaiting_length':
      await handleLength(from, conv, input);
      break;
    case 'awaiting_width':
      await handleWidth(from, conv, input);
      break;
    case 'awaiting_tier':
      await handleTier(from, conv, input, buttonId);
      break;
    case 'awaiting_date':
      await handleDate(from, conv, input);
      break;
    case 'awaiting_time':
      await handleTime(from, conv, input, buttonId);
      break;
    case 'awaiting_location':
      await handleLocation(from, conv, input, msg);
      break;
    case 'awaiting_name':
      await handleName(from, conv, input);
      break;
    case 'awaiting_confirm':
      await handleConfirmation(from, conv, input, buttonId);
      break;
    case 'booked':
      await handleBooked(from, conv, inputLower);
      break;
    default:
      await startIntake(from, conv);
      break;
  }
}

/* ===== State Handlers ===== */

async function handleIdle(from, conv, input) {
  const bookingIntent = [
    'boeken', 'book', 'offerte', 'quote', 'prijs', 'price',
    'schoonmaken', 'clean', 'afspraak', 'appointment', 'hallo',
    'hello', 'hi', 'hoi', 'hey', 'start',
  ];

  if (bookingIntent.some((w) => input.includes(w)) || input.length > 0) {
    await startIntake(from, conv);
  } else {
    await wa.sendText(from,
      'Hoi! 👋 Welkom bij *Aquafresh Boats*.\n\n' +
      'Stuur "boeken" voor een offerte, of "diensten" voor meer info over onze services.'
    );
  }
}

async function startIntake(from, conv) {
  conv.state = 'awaiting_length';
  conv.data = {};
  await store.setConversation(from, conv);

  await wa.sendText(from,
    'Leuk dat je interesse hebt! Laten we een offerte voor je maken. 🚤\n\n' +
    'Hoe lang is je boot? (in meters, bijv. *8* of *12.5*)'
  );
}

async function handleLength(from, conv, input) {
  const num = parseNumber(input);
  if (!num || num < 1 || num > 60) {
    await wa.sendText(from,
      'Ik heb een geldige bootlengte nodig in meters (bijv. *8* of *12.5*). Probeer het opnieuw.'
    );
    return;
  }

  conv.data.boat_length_m = num;
  conv.state = 'awaiting_width';
  await store.setConversation(from, conv);

  await wa.sendText(from,
    `${num} meter lengte, begrepen! En hoe breed is je boot? (in meters, bijv. *2.5* of *3*)`
  );
}

async function handleWidth(from, conv, input) {
  const num = parseNumber(input);
  if (!num || num < 0.5 || num > 20) {
    await wa.sendText(from,
      'Ik heb een geldige bootbreedte nodig in meters (bijv. *2.5* of *3.5*). Probeer het opnieuw.'
    );
    return;
  }

  conv.data.boat_width_m = num;
  const area = Math.round(conv.data.boat_length_m * num * 10) / 10;
  conv.state = 'awaiting_tier';
  await store.setConversation(from, conv);

  await wa.sendButtons(from,
    `${conv.data.boat_length_m}m × ${num}m = *${area} m²*. Welke service wil je?`,
    [
      { id: 'tier_basic', title: 'Basic €1.50/m²' },
      { id: 'tier_extra', title: 'Extra €2.00/m²' },
      { id: 'tier_heavy', title: 'Heavy Duty €2.50/m²' },
    ]
  );
}

async function handleTier(from, conv, input, buttonId) {
  let tierKey = null;

  if (buttonId === 'tier_basic') tierKey = 'basic';
  else if (buttonId === 'tier_extra') tierKey = 'extra';
  else if (buttonId === 'tier_heavy') tierKey = 'heavy duty';
  else tierKey = pricing.normalizeTier(input);

  if (!tierKey) {
    await wa.sendButtons(from,
      'Kies alsjeblieft een van de drie services:',
      [
        { id: 'tier_basic', title: 'Basic €1.50/m²' },
        { id: 'tier_extra', title: 'Extra €2.00/m²' },
        { id: 'tier_heavy', title: 'Heavy Duty €2.50/m²' },
      ]
    );
    return;
  }

  conv.data.service_tier = tierKey;
  conv.state = 'awaiting_date';
  await store.setConversation(from, conv);

  await wa.sendText(from,
    'Top! Wanneer wil je de afspraak? Stuur een datum (bijv. *15 juni*, *2026-06-15*, of *volgende week dinsdag*).'
  );
}

async function handleDate(from, conv, input) {
  const parsed = parseDate(input);
  if (!parsed) {
    await wa.sendText(from,
      'Ik kon die datum niet herkennen. Probeer een formaat zoals *15 juni*, *15-06-2026*, of *volgende week maandag*.'
    );
    return;
  }

  conv.data.preferred_date = parsed;
  conv.state = 'awaiting_time';
  await store.setConversation(from, conv);

  await wa.sendButtons(from,
    `Datum: *${parsed}*. Welk tijdslot heeft je voorkeur?`,
    [
      { id: 'time_morning', title: 'Ochtend (8-12u)' },
      { id: 'time_afternoon', title: 'Middag (12-17u)' },
      { id: 'time_flexible', title: 'Flexibel' },
    ]
  );
}

async function handleTime(from, conv, input, buttonId) {
  let timeSlot = '';
  if (buttonId === 'time_morning' || /ochtend|morning|8.*12/i.test(input)) {
    timeSlot = '08:00-12:00';
  } else if (buttonId === 'time_afternoon' || /middag|afternoon|12.*17/i.test(input)) {
    timeSlot = '12:00-17:00';
  } else if (buttonId === 'time_flexible' || /flexibel|flexible|maakt niet uit/i.test(input)) {
    timeSlot = 'Flexibel';
  } else {
    if (/\d{1,2}[:.]\d{2}/.test(input)) {
      timeSlot = input;
    } else {
      await wa.sendButtons(from,
        'Kies alsjeblieft een tijdslot:',
        [
          { id: 'time_morning', title: 'Ochtend (8-12u)' },
          { id: 'time_afternoon', title: 'Middag (12-17u)' },
          { id: 'time_flexible', title: 'Flexibel' },
        ]
      );
      return;
    }
  }

  conv.data.preferred_time = timeSlot;
  conv.state = 'awaiting_location';
  await store.setConversation(from, conv);

  await wa.sendText(from,
    'Waar ligt je boot? 📍\n\n' +
    'Deel je *locatie* via WhatsApp:\n' +
    'Tik op 📎 (bijlage) → *Locatie* → kies je positie en verstuur.\n\n' +
    'Of typ de naam van de jachthaven/ligplaats.'
  );
}

/**
 * Handle location — accepts WhatsApp location pin (preferred) or text fallback.
 */
async function handleLocation(from, conv, input, msg) {
  if (msg.location) {
    // WhatsApp location message received
    const loc = msg.location;
    const label = loc.name || loc.address || `${loc.latitude}, ${loc.longitude}`;
    conv.data.boat_location = label;
    conv.data.boat_latitude = loc.latitude;
    conv.data.boat_longitude = loc.longitude;
    if (loc.name) conv.data.boat_location_name = loc.name;
    if (loc.address) conv.data.boat_location_address = loc.address;

    conv.state = 'awaiting_name';
    await store.setConversation(from, conv);

    await wa.sendText(from,
      `📍 Locatie ontvangen: *${label}*\n\nBijna klaar! Wat is je naam?`
    );
    return;
  }

  // Text fallback — accept if it looks like a place name
  if (input.length < 2 || input === '[media]') {
    await wa.sendText(from,
      'Deel alsjeblieft je locatie via WhatsApp:\n' +
      'Tik op 📎 → *Locatie* → verstuur.\n\n' +
      'Of typ de naam van de jachthaven waar je boot ligt.'
    );
    return;
  }

  conv.data.boat_location = input;
  conv.data.boat_latitude = null;
  conv.data.boat_longitude = null;
  conv.state = 'awaiting_name';
  await store.setConversation(from, conv);

  await wa.sendText(from, 'Bijna klaar! Wat is je naam?');
}

async function handleName(from, conv, input) {
  if (input.length < 2) {
    await wa.sendText(from, 'Voer alsjeblieft je naam in.');
    return;
  }

  conv.data.customer_name = input;
  conv.data.phone_number = from;

  // Calculate quote using length × width
  const quote = pricing.calculateQuote(
    conv.data.boat_length_m,
    conv.data.boat_width_m,
    conv.data.service_tier
  );
  conv.data.estimated_area_m2 = quote.area_m2;
  conv.data.price_per_m2 = quote.price_per_m2;
  conv.data.quoted_amount_eur = quote.total_eur;

  conv.state = 'awaiting_confirm';
  await store.setConversation(from, conv);

  let locationLine = `📍 Locatie: ${conv.data.boat_location}`;
  if (conv.data.boat_latitude && conv.data.boat_longitude) {
    locationLine += ` (${conv.data.boat_latitude.toFixed(4)}, ${conv.data.boat_longitude.toFixed(4)})`;
  }

  const summary =
    `*Offerte Aquafresh Boats*\n\n` +
    `👤 ${conv.data.customer_name}\n` +
    `🚤 Boot: ${conv.data.boat_length_m}m × ${conv.data.boat_width_m}m\n` +
    `📐 Oppervlak: ${quote.area_m2} m²\n` +
    `🧹 Service: *${quote.tier}* (€${quote.price_per_m2.toFixed(2)}/m²)\n` +
    `📅 Datum: ${conv.data.preferred_date}\n` +
    `🕐 Tijd: ${conv.data.preferred_time}\n` +
    `${locationLine}\n\n` +
    `💰 *Totaalprijs: €${quote.total_eur}*\n\n` +
    `Klopt dit? Wil je deze afspraak bevestigen?`;

  await wa.sendButtons(from, summary, [
    { id: 'confirm_yes', title: 'Ja, bevestigen ✅' },
    { id: 'confirm_change', title: 'Iets wijzigen' },
    { id: 'confirm_no', title: 'Annuleren' },
  ]);
}

async function handleConfirmation(from, conv, input, buttonId) {
  if (buttonId === 'confirm_no' || /nee|cancel|annuleer/i.test(input)) {
    await store.clearConversation(from);
    await wa.sendText(from,
      'Geen probleem, de offerte is geannuleerd. Stuur gerust een bericht als je later wilt boeken! 👋'
    );
    return;
  }

  if (buttonId === 'confirm_change' || /wijzig|change|aanpassen/i.test(input)) {
    conv.state = 'awaiting_length';
    conv.data = {};
    await store.setConversation(from, conv);
    await wa.sendText(from,
      'Oké, laten we opnieuw beginnen. Hoe lang is je boot? (in meters)'
    );
    return;
  }

  if (buttonId === 'confirm_yes' || /ja|yes|ok|bevestig|confirm|akkoord/i.test(input)) {
    // Create booking
    const bookingId = store.generateBookingId();
    const booking = {
      booking_id: bookingId,
      created_at: new Date().toISOString(),
      customer_name: conv.data.customer_name,
      phone_number: from,
      boat_length_m: conv.data.boat_length_m,
      boat_width_m: conv.data.boat_width_m,
      service_tier: conv.data.service_tier,
      price_per_m2: conv.data.price_per_m2,
      estimated_area_m2: conv.data.estimated_area_m2,
      quoted_amount_eur: conv.data.quoted_amount_eur,
      preferred_date: conv.data.preferred_date,
      preferred_time: conv.data.preferred_time,
      boat_location: conv.data.boat_location,
      boat_latitude: conv.data.boat_latitude || null,
      boat_longitude: conv.data.boat_longitude || null,
      booking_status: 'Booked - Pending Payment',
      payment_status: 'Pending',
      payment_url: null,
      calendar_event_id: null,
    };

    // Try to create calendar event
    try {
      const eventId = await calendar.createEvent(booking);
      booking.calendar_event_id = eventId;
    } catch (err) {
      console.error('[Calendar Error]', err.message);
    }

    // Try to generate Revolut payment link
    try {
      const paymentUrl = await revolut.createPaymentRequest(booking);
      booking.payment_url = paymentUrl;
    } catch (err) {
      console.error('[Revolut Error]', err.message);
    }

    await store.saveBooking(booking);

    // Update conversation state
    conv.state = 'booked';
    conv.data.booking_id = bookingId;
    await store.setConversation(from, conv);

    // Send confirmation
    let confirmMsg =
      `✅ *Boeking bevestigd!*\n\n` +
      `Boekingsnummer: *${bookingId}*\n` +
      `📅 ${booking.preferred_date} om ${booking.preferred_time}\n` +
      `📍 ${booking.boat_location}\n` +
      `💰 €${booking.quoted_amount_eur}\n`;

    if (booking.payment_url) {
      confirmMsg += `\n💳 Betaal hier:\n${booking.payment_url}\n\nNa betaling is je boeking definitief.`;
    } else {
      confirmMsg += `\nWe sturen je zo een betaallink.`;
    }

    confirmMsg += `\n\n📸 Stuur gerust alvast een foto van je boot!`;

    await wa.sendText(from, confirmMsg);
    return;
  }

  // Didn't understand
  await wa.sendButtons(from,
    'Wil je de afspraak bevestigen?',
    [
      { id: 'confirm_yes', title: 'Ja, bevestigen ✅' },
      { id: 'confirm_change', title: 'Iets wijzigen' },
      { id: 'confirm_no', title: 'Annuleren' },
    ]
  );
}

async function handleBooked(from, conv, input) {
  if (!conv.data.booking_id) {
    await store.clearConversation(from);
    await startIntake(from, conv);
    return;
  }

  const booking = await store.getBooking(conv.data.booking_id);

  if (/status|betaling|payment/i.test(input)) {
    const status = booking
      ? `Boeking *${booking.booking_id}*: ${booking.booking_status} | Betaling: ${booking.payment_status}`
      : 'Boeking niet gevonden.';
    await wa.sendText(from, status);
    return;
  }

  if (/nieuw|new|andere|another/i.test(input)) {
    await store.clearConversation(from);
    await startIntake(from, { phone: from, state: 'idle', data: {} });
    return;
  }

  await wa.sendText(from,
    `Je boeking *${conv.data.booking_id}* is actief.\n\n` +
    'Stuur "status" om je boeking te controleren, of "nieuw" voor een nieuwe boeking.'
  );
}

/* ===== Helpers ===== */

/**
 * Parse a number from user input. Handles comma decimals.
 */
function parseNumber(input) {
  return parseFloat(input.replace(',', '.').replace(/[^0-9.]/g, ''));
}

/**
 * Simple date parser — handles common Dutch/international formats.
 * Returns an ISO date string (YYYY-MM-DD) or null.
 */
function parseDate(input) {
  const s = input.trim().toLowerCase();

  // ISO format: 2026-06-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  // DD-MM (assume current year)
  const dm = s.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (dm) {
    const year = new Date().getFullYear();
    return `${year}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
  }

  // Dutch month names: "15 juni", "3 juli 2026"
  const months = {
    januari: '01', februari: '02', maart: '03', april: '04',
    mei: '05', juni: '06', juli: '07', augustus: '08',
    september: '09', oktober: '10', november: '11', december: '12',
    january: '01', february: '02', march: '03', may: '05',
    june: '06', july: '07', august: '08', october: '10',
  };

  const nlMatch = s.match(/^(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?$/);
  if (nlMatch) {
    const month = months[nlMatch[2]];
    if (month) {
      const year = nlMatch[3] || new Date().getFullYear();
      return `${year}-${month}-${nlMatch[1].padStart(2, '0')}`;
    }
  }

  // Relative dates
  const today = new Date();
  if (s === 'morgen' || s === 'tomorrow') {
    today.setDate(today.getDate() + 1);
    return today.toISOString().slice(0, 10);
  }
  if (s === 'overmorgen') {
    today.setDate(today.getDate() + 2);
    return today.toISOString().slice(0, 10);
  }
  if (s === 'vandaag' || s === 'today') {
    return today.toISOString().slice(0, 10);
  }

  // "volgende week <dag>"
  const weekDays = {
    maandag: 1, dinsdag: 2, woensdag: 3, donderdag: 4,
    vrijdag: 5, zaterdag: 6, zondag: 0,
    monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
    friday: 5, saturday: 6, sunday: 0,
  };
  const vwMatch = s.match(/volgende\s+week\s+(\w+)/);
  if (vwMatch && weekDays[vwMatch[1]] !== undefined) {
    const target = weekDays[vwMatch[1]];
    const current = today.getDay();
    let daysAhead = target - current + 7;
    if (daysAhead <= 7) daysAhead += 7;
    today.setDate(today.getDate() + daysAhead);
    return today.toISOString().slice(0, 10);
  }

  return null;
}

module.exports = { handleMessage };
