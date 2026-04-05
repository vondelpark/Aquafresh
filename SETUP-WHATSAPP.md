# Aquafresh Boats — WhatsApp Business Booking Setup

This guide walks you through connecting the WhatsApp booking bot to your Vercel deployment.

## Architecture

```
Customer (WhatsApp) → Meta Cloud API → Vercel /api/webhook → Conversation Engine
                                                              ├── Upstash Redis (state & bookings)
                                                              ├── Google Calendar (availability)
                                                              └── Revolut API (payments)
```

## Prerequisites

- Vercel account with this repo deployed
- Meta Business account + WhatsApp Business API access
- Upstash Redis account (free tier works)
- Google Cloud service account (for Calendar)
- Revolut Business account (for payment links)

---

## Step 1: Upstash Redis (State Store)

1. Go to [upstash.com](https://upstash.com) and create a free account
2. Create a new Redis database (region: EU West)
3. Copy the **REST URL** and **REST Token**
4. Add to Vercel Environment Variables:
   ```
   UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token
   ```

## Step 2: Meta WhatsApp Business API

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a new app → select "Business" type
3. Add the **WhatsApp** product
4. In WhatsApp → Getting Started:
   - Note your **Phone Number ID** and **temporary Access Token**
   - For production, generate a permanent **System User Token** in Business Settings
5. Set up the webhook:
   - **Callback URL**: `https://aquafreshboats.nl/api/webhook`
   - **Verify Token**: `aquafresh-verify-token` (or your custom value)
   - Subscribe to: `messages`
6. Add to Vercel Environment Variables:
   ```
   WA_PHONE_NUMBER_ID=your-phone-number-id
   WA_ACCESS_TOKEN=your-access-token
   WA_VERIFY_TOKEN=aquafresh-verify-token
   WA_APP_SECRET=your-app-secret
   ```

## Step 3: Google Calendar

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or use existing)
3. Enable the **Google Calendar API**
4. Create a **Service Account**:
   - IAM & Admin → Service Accounts → Create
   - Download the JSON key file
5. Share your Google Calendar with the service account email
   (e.g., `aquafresh@project-id.iam.gserviceaccount.com`) — give "Make changes to events" permission
6. Add to Vercel Environment Variables:
   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=aquafresh@project-id.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n
   GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
   ```
   > **Note**: When pasting the private key in Vercel, keep `\n` as literal characters — the code converts them.

## Step 4: Revolut Payments

1. Sign up for a **Revolut Business** account at [business.revolut.com](https://business.revolut.com)
2. Go to **Developer** → **API Settings** in your Revolut Business dashboard
3. Generate an **API Secret Key** (Merchant API)
4. Set up the payment webhook in the Revolut dashboard:
   - **URL**: `https://aquafreshboats.nl/api/revolut-callback`
   - Subscribe to: `ORDER_COMPLETED`, `ORDER_CANCELLED`
5. Copy the **Webhook Secret** for signature verification
6. Add to Vercel Environment Variables:
   ```
   REVOLUT_API_SECRET_KEY=your-api-secret-key
   REVOLUT_WEBHOOK_SECRET=your-webhook-signing-secret
   REVOLUT_SANDBOX=false
   ```
   > Set `REVOLUT_SANDBOX=true` to test with the Revolut sandbox API first.

**Sandbox testing**: Use [sandbox-merchant.revolut.com](https://sandbox-merchant.revolut.com) for test credentials. Generate sandbox API keys from the Revolut Business sandbox portal.

---

## All Environment Variables

| Variable | Required | Description |
|---|---|---|
| `WA_PHONE_NUMBER_ID` | Yes | Meta WhatsApp phone number ID |
| `WA_ACCESS_TOKEN` | Yes | Meta WhatsApp API access token |
| `WA_VERIFY_TOKEN` | Yes | Webhook verification token (you choose) |
| `WA_APP_SECRET` | Recommended | App secret for signature verification |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis auth token |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Optional | Google service account email |
| `GOOGLE_PRIVATE_KEY` | Optional | Google service account private key |
| `GOOGLE_CALENDAR_ID` | Optional | Google Calendar ID (default: primary) |
| `REVOLUT_API_SECRET_KEY` | Optional | Revolut Merchant API secret key |
| `REVOLUT_WEBHOOK_SECRET` | Optional | Revolut webhook signing secret |
| `REVOLUT_SANDBOX` | Optional | Set "true" for sandbox mode |
| `OWNER_PHONE` | Optional | Owner's WhatsApp number (for notifications) |

> Google Calendar and Revolut are optional — the bot works without them (calendar events won't be created, and you'll need to send payment links manually).

---

## Pricing

Configured in `lib/pricing.js`:

| Tier | Rate | Description |
|---|---|---|
| Basic | €1.50/m² | Standard cleaning of accessible surfaces |
| Extra | €2.00/m² | Includes teak and harder-to-clean areas |
| Heavy Duty | €2.50/m² | Deep cleaning for stubborn dirt |

**Formula**: `boat_length × boat_width × rate_per_m²`

---

## WhatsApp Conversation Flow

1. Customer sends any message → Bot greets and asks for boat length
2. Bot asks for boat width → calculates area
3. Bot asks for service tier (interactive buttons: Basic / Extra / Heavy Duty)
4. Bot asks for preferred date
5. Bot asks for preferred time (buttons: Morning / Afternoon / Flexible)
6. Bot asks for boat location (WhatsApp location pin or text)
7. Bot asks for customer name
8. Bot calculates and sends quote with summary → asks for confirmation (buttons)
9. On confirm: creates Google Calendar event + Revolut payment link → sends to customer
10. Revolut callback updates booking status → sends final WhatsApp confirmation

**Commands**: "diensten" (service info), "reset" (start over), "status" (check booking)

---

## Testing

1. Deploy to Vercel: `vercel --prod`
2. Set all env vars in Vercel dashboard
3. Configure Meta webhook to point to `https://aquafreshboats.nl/api/webhook`
4. Send a WhatsApp message to your business number
5. The bot should respond with the intake flow

## Logs

View real-time logs: `vercel logs aquafreshboats.nl --follow`
