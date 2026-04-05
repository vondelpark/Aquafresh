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
 * Returns { from, text, buttonId, messageId } or null.
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
    } else if (msg.type === 'image' || msg.type === 'document') {
      text = '[media]';
    }

    return { from, text, buttonId, messageId };
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

module.exports = { sendText, sendButtons, sendList, markRead, parseIncoming };
