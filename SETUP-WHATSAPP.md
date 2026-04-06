# Aquafresh Boats — Complete Setup Guide

A step-by-step guide to deploy the Aquafresh Boats website and WhatsApp booking bot. Written for someone who has never done this before.

---

## What You're Setting Up

Your system has two parts that work together:

1. **Website** (already live on Vercel) — customers can browse services, get a price estimate, and book online or via WhatsApp
2. **WhatsApp Bot** — an automated chatbot that walks customers through booking step-by-step, generates a payment link, and adds the appointment to your Google Calendar

Here's how everything connects:

```
Customer sends WhatsApp message
    ↓
Meta (Facebook) receives it
    ↓
Meta forwards it to your Vercel server (/api/webhook)
    ↓
Your bot reads the message, figures out where the customer is in the booking flow
    ↓
Bot replies via WhatsApp (asks for boat size, date, location, etc.)
    ↓
When the customer confirms → bot creates:
    ├── A booking saved in Upstash Redis (your database)
    ├── A Google Calendar event (so you see it in your calendar)
    └── A Revolut payment link (sent to the customer via WhatsApp)
    ↓
Customer pays via the Revolut link
    ↓
Revolut sends a webhook to your server (/api/revolut-callback)
    ↓
Bot sends "Payment received!" confirmation via WhatsApp
```

---

## What You Need Before Starting

You'll need accounts on these services (all free or already included with your Revolut Business):

| Service | What it does | Cost |
|---|---|---|
| **GitHub** | Stores your code | Free |
| **Vercel** | Hosts your website and runs the bot | Free tier works |
| **Meta (Facebook) Developer** | Connects WhatsApp to your bot | Free (WhatsApp charges per-conversation after 1,000/month) |
| **Upstash** | Database that remembers conversation state and bookings | Free tier works |
| **Google Cloud** | Lets the bot add events to your Google Calendar | Free |
| **Revolut Business** | Generates payment links for customers | You already have this |

---

## Step 1: Make Sure Your Website Is Deployed on Vercel

Your website is already live on Vercel connected to the GitHub repo. Let's make sure it's up to date.

### 1a. Check that Vercel is connected to GitHub

1. Go to [vercel.com](https://vercel.com) and log in
2. Click on your **Aquafresh** project
3. You should see it's connected to the `vondelpark/Aquafresh` GitHub repository
4. Every time you push code to the `main` branch on GitHub, Vercel automatically rebuilds and deploys

### 1b. Deploy the latest code

If you haven't already merged the latest changes to `main`:

1. Go to your GitHub repository
2. If there's an open Pull Request, merge it
3. Or push directly to `main` — Vercel will auto-deploy

### 1c. Verify the site works

1. Open your Vercel project dashboard
2. Click the deployment URL (e.g., `https://aquafreshboats.nl` or your `.vercel.app` URL)
3. You should see the Aquafresh Boats website with the water animation

---

## Step 2: Set Up Upstash Redis (Database)

The bot needs a database to remember where each customer is in the booking conversation. Upstash Redis is a simple cloud database with a generous free tier.

### 2a. Create an account

1. Go to [upstash.com](https://upstash.com)
2. Click **Sign Up** (you can sign in with GitHub for convenience)

### 2b. Create a database

1. Once logged in, click **Create Database**
2. Give it a name: `aquafresh-boats`
3. **Region**: Select **EU West 1 (Ireland)** — this is closest to Amsterdam for fast performance
4. **Type**: Leave as **Regional**
5. Click **Create**

### 2c. Copy your credentials

1. After creating the database, you'll see a dashboard with connection details
2. Scroll down to the **REST API** section
3. You need two values:
   - **UPSTASH_REDIS_REST_URL** — looks like `https://eu1-something-12345.upstash.io`
   - **UPSTASH_REDIS_REST_TOKEN** — a long string of letters and numbers

4. Keep this page open — you'll paste these into Vercel in Step 6

---

## Step 3: Set Up WhatsApp Business API (Meta)

This is the most involved step. You're connecting your WhatsApp Business number (+31 6 1951 1991) to Meta's Cloud API so the bot can send and receive messages automatically.

### 3a. Create a Meta Developer account

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **Get Started** in the top right
3. Log in with your Facebook account (or create one)
4. Accept the developer terms
5. Verify your account (you may need to add a phone number)

### 3b. Create an app

1. Click **My Apps** in the top menu bar
2. Click **Create App**
3. Select **Other** for use case, then click **Next**
4. Select **Business** as the app type, then click **Next**
5. Fill in:
   - **App name**: `Aquafresh Boats`
   - **Contact email**: `aquafreshboats@gmail.com`
   - **Business Account**: Select your business account (or create one)
6. Click **Create App**

### 3c. Add WhatsApp to your app

1. On the app dashboard, scroll down to **Add Products**
2. Find **WhatsApp** and click **Set Up**
3. You'll be taken to the WhatsApp Getting Started page

### 3d. Note your credentials

On the WhatsApp **Getting Started** page, you'll see:

1. **Phone Number ID** — a long number like `123456789012345`
   - This identifies your WhatsApp Business number
   - If you need to register +31 6 1951 1991, follow Meta's prompts to add and verify it

2. **Temporary Access Token** — click **Generate** to create one
   - This expires in 24 hours (you'll replace it with a permanent one later)
   - Copy it now for testing

### 3e. Get a permanent access token (important!)

The temporary token expires. For production, you need a permanent System User Token:

1. Go to [business.facebook.com](https://business.facebook.com)
2. Click **Settings** (gear icon) in the bottom left
3. Go to **Users** → **System Users**
4. Click **Add** to create a new system user:
   - **Name**: `Aquafresh Bot`
   - **Role**: Admin
5. Click **Generate Token**
6. Select your **Aquafresh Boats** app
7. Check these permissions:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
8. Click **Generate Token**
9. **Copy this token immediately** — you won't be able to see it again!
   - This is your permanent `WA_ACCESS_TOKEN`

### 3f. Get your App Secret

1. Go back to [developers.facebook.com](https://developers.facebook.com)
2. Click on your **Aquafresh Boats** app
3. In the left sidebar, click **Settings** → **Basic**
4. Find **App Secret** — click **Show** and copy it
5. This is your `WA_APP_SECRET` (used to verify incoming webhooks are really from Meta)

### 3g. Set up the webhook (do this AFTER Step 6)

You need your Vercel URL first. Come back to this after adding env vars.

1. In your app on developers.facebook.com, go to **WhatsApp** → **Configuration**
2. Under **Webhook**, click **Edit**
3. Fill in:
   - **Callback URL**: `https://aquafreshboats.nl/api/webhook`
     (replace with your actual Vercel domain if different)
   - **Verify Token**: `aquafresh-verify-token`
     (you can choose any string — just make sure it matches the `WA_VERIFY_TOKEN` env var in Vercel)
4. Click **Verify and Save**
   - Meta will send a test request to your URL. If Vercel is deployed with the env vars set, it should verify successfully.
5. After verification, click **Manage** next to the webhook
6. Find the **messages** field and check the **Subscribe** checkbox
   - This tells Meta to forward incoming WhatsApp messages to your bot

### 3h. Choose your Verify Token

Pick a secret string for `WA_VERIFY_TOKEN`. This is a password that Meta uses to confirm your webhook URL belongs to you. It can be anything, for example:
- `aquafresh-verify-token`
- `my-secret-verify-2024`
- Any random string you want

**Important**: The value you enter in Meta's webhook setup MUST match the `WA_VERIFY_TOKEN` you set in Vercel.

---

## Step 4: Set Up Google Calendar

This lets the bot automatically create calendar events when customers book. You'll see appointments appear in your Google Calendar.

### 4a. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with `aquafreshboats@gmail.com` (or whichever Google account has your calendar)
3. Click the project dropdown at the top → **New Project**
4. Name it `Aquafresh Boats` and click **Create**
5. Make sure this project is selected in the dropdown

### 4b. Enable the Calendar API

1. In the left sidebar, go to **APIs & Services** → **Library**
2. Search for `Google Calendar API`
3. Click on it, then click **Enable**

### 4c. Create a Service Account

A service account is like a robot user that the bot uses to access your calendar.

1. In the left sidebar, go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Fill in:
   - **Name**: `aquafresh-bot`
   - **Description**: `Bot that creates calendar events for bookings`
4. Click **Create and Continue**
5. For the role, select **No role** (it doesn't need project-level access) → click **Continue**
6. Click **Done**

### 4d. Download the key file

1. Click on the service account you just created (e.g., `aquafresh-bot@aquafresh-boats.iam.gserviceaccount.com`)
2. Go to the **Keys** tab
3. Click **Add Key** → **Create New Key**
4. Select **JSON** and click **Create**
5. A `.json` file will download. Open it in a text editor.
6. You need two values from this file:
   - `"client_email"` → this is your `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `"private_key"` → this is your `GOOGLE_PRIVATE_KEY`

### 4e. Share your calendar with the service account

1. Open [Google Calendar](https://calendar.google.com) (logged in as `aquafreshboats@gmail.com`)
2. On the left, find the calendar you want to use (e.g., your main calendar)
3. Click the **three dots** next to it → **Settings and sharing**
4. Scroll down to **Share with specific people or groups**
5. Click **Add people and groups**
6. Paste the service account email (e.g., `aquafresh-bot@aquafresh-boats.iam.gserviceaccount.com`)
7. Set permission to **Make changes to events**
8. Click **Send**

### 4f. Find your Calendar ID

1. Still in Calendar Settings, scroll down to **Integrate calendar**
2. Copy the **Calendar ID**
   - For your main calendar, it's usually your email: `aquafreshboats@gmail.com`
   - For other calendars, it looks like: `abc123@group.calendar.google.com`

---

## Step 5: Set Up Revolut Payments

Revolut generates payment links that customers click to pay by card, Apple Pay, or Google Pay.

### 5a. Access the Revolut Business dashboard

1. Log in to your Revolut Business account at [business.revolut.com](https://business.revolut.com)
2. Make sure your business is verified and active

### 5b. Get your Merchant API key

1. In the Revolut Business dashboard, go to **Developer** → **API Settings**
   (If you don't see "Developer" in the menu, go to **Settings** → **APIs**)
2. Click **Merchant API**
3. Click **Generate API key** or **Add new key**
4. Set the permissions to include **Payment orders** (create and read)
5. Copy the **API Secret Key** — this is your `REVOLUT_API_SECRET_KEY`
   - It starts with `sk_` for production or `sk_sandbox_` for sandbox

### 5c. Set up the payment webhook

When a customer pays, Revolut needs to tell your server so the bot can send a confirmation.

1. In the **Developer** → **API Settings** section, find **Webhooks**
2. Click **Add webhook endpoint**
3. **URL**: `https://aquafreshboats.nl/api/revolut-callback`
4. **Events**: Select `ORDER_COMPLETED` and `ORDER_CANCELLED`
5. Click **Save**
6. Copy the **Webhook Signing Secret** — this is your `REVOLUT_WEBHOOK_SECRET`

### 5d. (Optional) Test with sandbox first

Revolut has a sandbox environment for testing without real money:

1. Go to [sandbox-business.revolut.com](https://sandbox-business.revolut.com)
2. Sign up for a sandbox account
3. Generate sandbox API keys (they start with `sk_sandbox_`)
4. Set `REVOLUT_SANDBOX=true` in Vercel
5. Test the full flow, then switch to production keys when ready

---

## Step 6: Add Environment Variables to Vercel

Now put all the credentials into Vercel so your bot can use them.

### 6a. Open your Vercel project settings

1. Go to [vercel.com](https://vercel.com) and click on your **Aquafresh** project
2. Click **Settings** (tab at the top)
3. Click **Environment Variables** in the left sidebar

### 6b. Add each variable

For each variable below, click **Add New**, paste the **Name** and **Value**, select all environments (Production, Preview, Development), and click **Save**.

**Required — WhatsApp Bot:**

| Name | Value | Where to find it |
|---|---|---|
| `WA_PHONE_NUMBER_ID` | Your Phone Number ID | Meta Developer → WhatsApp → Getting Started |
| `WA_ACCESS_TOKEN` | Your permanent System User Token | Meta Business → System Users (Step 3e) |
| `WA_VERIFY_TOKEN` | Any secret string you choose | You pick this (e.g., `aquafresh-verify-token`) |
| `WA_APP_SECRET` | Your App Secret | Meta Developer → Settings → Basic |

**Required — Database:**

| Name | Value | Where to find it |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | `https://eu1-...upstash.io` | Upstash dashboard → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Long token string | Upstash dashboard → REST API |

**Optional — Google Calendar:**

| Name | Value | Where to find it |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `aquafresh-bot@...gserviceaccount.com` | Downloaded JSON key file → `client_email` |
| `GOOGLE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` | Downloaded JSON key file → `private_key` |
| `GOOGLE_CALENDAR_ID` | `aquafreshboats@gmail.com` | Google Calendar → Settings → Integrate |

> **Important for GOOGLE_PRIVATE_KEY**: Copy the entire value from the JSON file including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` parts. Keep the `\n` characters as-is — do NOT replace them with actual line breaks.

**Optional — Revolut Payments:**

| Name | Value | Where to find it |
|---|---|---|
| `REVOLUT_API_SECRET_KEY` | `sk_live_...` or `sk_sandbox_...` | Revolut Business → Developer → API Settings |
| `REVOLUT_WEBHOOK_SECRET` | Signing secret string | Revolut Business → Developer → Webhooks |
| `REVOLUT_SANDBOX` | `true` or `false` | Set `true` for testing, `false` for real payments |

**Optional — Notifications:**

| Name | Value | Where to find it |
|---|---|---|
| `OWNER_PHONE` | `31619511991` | Your WhatsApp number (no + or spaces) |

### 6c. Redeploy after adding variables

After adding all the env vars:

1. Go to the **Deployments** tab in your Vercel project
2. Find the latest deployment
3. Click the **three dots** (⋯) → **Redeploy**
4. Wait for the deployment to finish (usually 30-60 seconds)

---

## Step 7: Configure the WhatsApp Webhook

Now that Vercel is deployed with your env vars, set up the webhook (Step 3g above):

1. Go to [developers.facebook.com](https://developers.facebook.com) → your app → **WhatsApp** → **Configuration**
2. Click **Edit** under Webhook
3. Enter:
   - **Callback URL**: `https://aquafreshboats.nl/api/webhook`
   - **Verify Token**: the exact same string you set as `WA_VERIFY_TOKEN` in Vercel
4. Click **Verify and Save**
5. If it says **verified** — it works!
6. Subscribe to the **messages** webhook field

**If verification fails**:
- Double-check your Vercel URL is correct and the site is deployed
- Make sure the `WA_VERIFY_TOKEN` in Vercel exactly matches what you typed in Meta
- Check Vercel logs for errors: go to your project → **Deployments** → click latest → **Functions** tab

---

## Step 8: Test Everything

### 8a. Test the WhatsApp bot

1. Open WhatsApp on your phone
2. Send a message to your business number (+31 6 1951 1991)
3. Type `hoi` or `boeken`
4. The bot should respond asking for your boat length
5. Walk through the full flow:
   - Enter a length (e.g., `10`)
   - Enter a width (e.g., `3`)
   - Select a service tier (tap a button)
   - Enter a date (e.g., `morgen` or `15 juni`)
   - Select a time slot (tap a button)
   - Share your location (tap 📎 → Location) or type a marina name
   - Enter your name
   - Confirm the quote
6. You should get a booking confirmation with a Revolut payment link (if configured)

### 8b. Test the website booking

1. Go to your website
2. Fill in the booking form (boat dimensions, service, date, details)
3. Click **Book Online**
4. You should get a confirmation, and (if `OWNER_PHONE` is set) a WhatsApp notification to your phone

### 8c. Test the payment flow

1. If using sandbox mode (`REVOLUT_SANDBOX=true`), use Revolut's test card numbers
2. Click the payment link from the bot
3. Complete the payment
4. The bot should send a "Payment received!" message via WhatsApp

### 8d. Check your Google Calendar

1. Open Google Calendar
2. The booking should appear as a 2-hour event on the date the customer chose

---

## Troubleshooting

### "The bot doesn't respond to my WhatsApp messages"

- **Check webhook subscription**: Go to Meta Developer → WhatsApp → Configuration → make sure **messages** is subscribed
- **Check access token**: If using the temporary token, it expires in 24 hours. Generate a permanent one (Step 3e)
- **Check Vercel logs**: Go to Vercel → Deployments → latest → Functions → look for errors in `/api/webhook`

### "Webhook verification fails"

- Make sure your site is deployed and running on Vercel
- The `WA_VERIFY_TOKEN` in Vercel must **exactly** match what you entered in Meta (no extra spaces)
- Try visiting `https://aquafreshboats.nl/api/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test` in your browser — it should return `test`

### "Calendar events aren't being created"

- Make sure you shared the calendar with the service account email (Step 4e)
- Check that the permission is **Make changes to events** (not just "See all event details")
- Verify `GOOGLE_PRIVATE_KEY` is the complete key including BEGIN/END markers

### "Payment links aren't being generated"

- Check that `REVOLUT_API_SECRET_KEY` is set correctly in Vercel
- If testing, make sure `REVOLUT_SANDBOX=true` is set and you're using sandbox keys
- Check Vercel function logs for Revolut API errors

### "I need to check what's happening on the server"

View real-time logs:
```
vercel logs aquafreshboats.nl --follow
```
Or check logs in the Vercel dashboard: **Deployments** → click a deployment → **Functions** tab.

---

## Going Live Checklist

Before going live with real customers, make sure:

- [ ] Permanent WhatsApp access token is set (not the temporary one)
- [ ] `REVOLUT_SANDBOX` is set to `false` (or removed) and production API key is used
- [ ] Google Calendar events are appearing correctly
- [ ] Payment links work and payment confirmations are sent
- [ ] Owner receives WhatsApp notifications for new bookings (`OWNER_PHONE` is set)
- [ ] Test the full flow end-to-end: WhatsApp message → booking → payment → confirmation
- [ ] Website booking form works and sends owner notification

---

## Admin Panel

Your website has a built-in admin panel for managing pricing and settings:

1. Go to your website
2. Scroll to the very bottom — click the tiny **Admin** link in the bottom-right corner
3. Log in with:
   - **Email**: `admin@aquafreshboats.nl`
   - **Password**: `admin 123`
4. From here you can:
   - Update pricing per tier
   - Change contact email and phone
   - Configure Google Calendar embed

> **Note**: Admin settings are stored in your browser's localStorage. They only affect what's shown on the website in that browser.

---

## Quick Reference

| What | URL |
|---|---|
| Website | `https://aquafreshboats.nl` |
| WhatsApp webhook | `https://aquafreshboats.nl/api/webhook` |
| Online booking API | `https://aquafreshboats.nl/api/booking` |
| Revolut payment webhook | `https://aquafreshboats.nl/api/revolut-callback` |
| Phone | +31 6 1951 1991 |
| Email | aquafreshboats@gmail.com |
