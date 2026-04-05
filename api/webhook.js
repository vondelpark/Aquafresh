/**
 * Aquafresh Boats — WhatsApp Webhook
 *
 * GET  /api/webhook  → Meta verification (hub.challenge)
 * POST /api/webhook  → Incoming WhatsApp messages
 *
 * Set these env vars in Vercel:
 *   WA_VERIFY_TOKEN, WA_ACCESS_TOKEN, WA_PHONE_NUMBER_ID, WA_APP_SECRET
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

const crypto = require('crypto');
const CONFIG = require('../lib/config');
const wa = require('../lib/whatsapp');
const conversation = require('../lib/conversation');

module.exports = async function handler(req, res) {
  // --- GET: Meta webhook verification ---
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === CONFIG.WA_VERIFY_TOKEN) {
      console.log('[Webhook] Verified');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // --- POST: Incoming messages ---
  if (req.method === 'POST') {
    // Verify signature (optional but recommended)
    if (CONFIG.WA_APP_SECRET && req.headers['x-hub-signature-256']) {
      const signature = req.headers['x-hub-signature-256'];
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expected =
        'sha256=' +
        crypto.createHmac('sha256', CONFIG.WA_APP_SECRET).update(rawBody).digest('hex');

      if (signature !== expected) {
        console.warn('[Webhook] Invalid signature');
        return res.status(401).send('Invalid signature');
      }
    }

    const body = req.body;

    // Parse the incoming message
    const msg = wa.parseIncoming(body);

    if (msg) {
      try {
        await conversation.handleMessage(msg);
      } catch (err) {
        console.error('[Webhook] Error processing message:', err);
        // Don't crash — WhatsApp will retry if we return non-200
        try {
          await wa.sendText(msg.from,
            'Sorry, er ging iets mis. Probeer het opnieuw of stuur "reset" om opnieuw te beginnen.'
          );
        } catch {
          // ignore send failure
        }
      }
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json({ status: 'ok' });
  }

  return res.status(405).send('Method not allowed');
};
