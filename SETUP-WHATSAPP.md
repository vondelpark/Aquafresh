# Aquafresh Boats — WhatsApp Business Booking Setup

This guide walks you through connecting the WhatsApp booking bot to your Vercel deployment.

## Architecture

```
Customer (WhatsApp) → Meta Cloud API → Vercel /api/webhook → Conversation Engine
                                                              ├── Upstash Redis (state & bookings)
                                                              ├── Google Calendar (availability)
                                                              └── Tikkie API (payments)
```

## Prerequisites

- Vercel account with this repo deployed
- Meta Business account + WhatsApp Business API access
- Upstash Redis account (free tier works)
- Google Cloud service account (for Calendar)
- ABN AMRO Tikkie Business account (for payments)

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

## Step 4: Tikkie Payments

1. Go to [developer.abnamro.com](https://developer.abnamro.com)
2. Register and subscribe to the **Tikkie API** product
3. Create an app and get your:
   - **API Key**
   - **App Token** (from Tikkie portal)
4. Set up the payment notification webhook in Tikkie:
   - **URL**: `https://aquafreshboats.nl/api/tikkie-callback`
5. Add to Vercel Environment Variables:
   ```
   TIKKIE_API_KEY=your-api-key
   TIKKIE_APP_TOKEN=your-app-token
   TIKKIE_SANDBOX=false
   ```
   > Set `TIKKIE_SANDBOX=true` to test with sandbox API first.

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
| `TIKKIE_API_KEY` | Optional | ABN AMRO Tikkie API key |
| `TIKKIE_APP_TOKEN` | Optional | Tikkie app token |
| `TIKKIE_SANDBOX` | Optional | Set "true" for sandbox mode |

> Google Calendar and Tikkie are optional — the bot works without them (calendar events won't be created, and you'll need to send Tikkie links manually).

---

## Pricing

Configured in `lib/pricing.js`:

| Tier | Rate | Description |
|---|---|---|
| Basic | €1.50/m² | Standard cleaning of accessible surfaces |
| Extra | €2.00/m² | Includes teak and harder-to-clean areas |
| Heavy Duty | €2.50/m² | Deep cleaning for stubborn dirt |

**Formula**: `boat_length × 2.5 (area factor) × rate_per_m²`

---

## WhatsApp Conversation Flow

1. Customer sends any message → Bot greets and asks for boat length
2. Bot asks for service tier (interactive buttons: Basic / Extra / Heavy Duty)
3. Bot asks for preferred date
4. Bot asks for preferred time (buttons: Morning / Afternoon / Flexible)
5. Bot asks for boat location
6. Bot asks for customer name
7. Bot calculates and sends quote with summary → asks for confirmation (buttons)
8. On confirm: creates Google Calendar event + Tikkie link → sends to customer
9. Tikkie callback updates booking status → sends final WhatsApp confirmation

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
