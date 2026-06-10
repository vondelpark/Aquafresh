/**
 * Aquafresh Boats — WhatsApp Cloud API helper
 *
 * Sends text and interactive messages via Meta's Cloud API.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const CONFIG = require('./config');

const API_BASE = 'https://graph.facebook.com/v21.0';

/**
 * Send a plain text message.
 */
async function sendText(to, body) {
  return callAPI(`${API_BASE}/${CONFIG.WA_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  });
}

/**
 * Send an interactive button message (max 3 buttons).
 * @param {string} to
 * @param {string} body
 * @param {Array<{id: string, title: string}>} buttons
 */
async function sendButtons(to, body, buttons) {
  return callAPI(`${API_BASE}/${CONFIG.WA_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  });
}

/**
 * Send an interactive list message.
 * @param {string} to
 * @param {string} body
 * @param {string} buttonText — the CTA on the list button
 * @param {Array<{title: string, rows: Array<{id: string, title: string, description?: string}>}>} sections
 */
async function sendList(to, body, buttonText, sections) {
  return callAPI(`${API_BASE}/${CONFIG.WA_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonText,
        sections,
      },
    },
  });
}

/**
 * Send an image by public URL, with optional caption.
 */
async function sendImage(to, imageUrl, caption) {
  return callAPI(`${API_BASE}/${CONFIG.WA_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: { link: imageUrl, ...(caption ? { caption } : {}) },
  });
}

/**
 * Fetch the download URL + binary of a received media item (e.g. boat photo).
 * Returns { buffer, mimeType } or null.
 */
async function fetchMedia(mediaId) {
  const metaRes = await fetch(`${API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${CONFIG.WA_ACCESS_TOKEN}` },
  });
  if (!metaRes.ok) return null;
  const meta = await metaRes.json();
  if (!meta.url) return null;

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${CONFIG.WA_ACCESS_TOKEN}` },
  });
  if (!fileRes.ok) return null;

  const buffer = Buffer.from(await fileRes.arrayBuffer());
  return { buffer, mimeType: meta.mime_type || 'image/jpeg' };
}

/**
 * Mark a message as read.
 */
async function markRead(messageId) {
  return callAPI(`${API_BASE}/${CONFIG.WA_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  });
}

/**
 * Extract the first usable message from a webhook payload.
 * Returns { from, text, buttonId, messageId, location, image } or null.
 *
 * location (if present): { latitude, longitude, name, address }
 * image (if present): { id, mime_type, caption }
 */
function parseIncoming(body) {
  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    if (!value?.messages?.length) return null;

    const msg = value.messages[0];
    const from = msg.from; // phone number in international format
    const messageId = msg.id;

    let text = '';
    let buttonId = '';
    let location = null;
    let image = null;

    if (msg.type === 'text') {
      text = msg.text?.body || '';
    } else if (msg.type === 'interactive') {
      if (msg.interactive?.type === 'button_reply') {
        buttonId = msg.interactive.button_reply?.id || '';
        text = msg.interactive.button_reply?.title || '';
      } else if (msg.interactive?.type === 'list_reply') {
        buttonId = msg.interactive.list_reply?.id || '';
        text = msg.interactive.list_reply?.title || '';
      }
    } else if (msg.type === 'location') {
      location = {
        latitude: msg.location?.latitude,
        longitude: msg.location?.longitude,
        name: msg.location?.name || '',
        address: msg.location?.address || '',
      };
      text = '[location]';
    } else if (msg.type === 'image') {
      image = {
        id: msg.image?.id || '',
        mime_type: msg.image?.mime_type || '',
        caption: msg.image?.caption || '',
      };
      text = '[image]';
    } else if (msg.type === 'document') {
      text = '[media]';
    }

    return { from, text, buttonId, messageId, location, image };
  } catch {
    return null;
  }
}

/* ---- internal ---- */

async function callAPI(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CONFIG.WA_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[WhatsApp API Error]', res.status, err);
  }
  return res;
}

module.exports = { sendText, sendButtons, sendList, sendImage, fetchMedia, markRead, parseIncoming };
