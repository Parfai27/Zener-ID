# Zener ID — Company Dashboard (Frontend)

The company dashboard is where a company (our client) verifies its customers.
The company signs in, enters a customer's details, sends the customer a
verification link or QR code, and follows the result.

- **Built with:** Next.js 15, TypeScript, Tailwind CSS
- **Data:** everything is saved in PostgreSQL through the backend. A new company
  starts with an empty dashboard and no sample data.

## How to run it

1. Start the backend first. It must run on `http://localhost:8000`.
2. Then run the frontend:

```bash
cd frontend
npm install
npm run dev
```

3. Open **http://localhost:5173**.
4. Create an account at `/register`, or sign in at `/login`.

## The pages

| Page | Address | What it does |
|---|---|---|
| **Overview** | `/dashboard` | Shows total verifications, verified users, pending and failed, plus the latest activity. |
| **New verification** | `/dashboard/verifications/new` | A form for the customer's first name, last name, date of birth, email, phone and country. |
| **Link & QR code** | `/dashboard/verifications/<ref>/link` | Shows the customer's link and QR code. You can copy the link, download the QR code, or send the link by Email, SMS or WhatsApp. |
| **Verified users** | `/dashboard/verified` | Customers who passed verification, with search and date filters. |
| **All verifications** | `/dashboard/verifications` | Every request, with tabs: Pending, Processing, In review, Completed, Failed, Expired. |
| **Verification details** | `/dashboard/verifications/<ref>` | One customer's details, check results, captured photos, and a PDF report to download. |
| **API keys** | `/dashboard/api-keys` | Create or revoke keys, so the company's own systems can use the API. |
| **Settings** | `/dashboard/settings` | Account details. |

## How the flow works

1. The company fills in **New verification**.
2. The backend creates a unique link, and the dashboard shows it with a QR code.
3. The company sends the link to the customer (email, SMS, WhatsApp, or the QR code).
4. The customer opens the link, takes a photo of their ID, and does a face check.
5. The result appears in the dashboard: **Verified**, **Declined** or **In review**.

## Sending the link by email and SMS

- **WhatsApp** works straight away. It opens WhatsApp with the message ready.
- **Email** and **SMS** are sent by the backend, through this API:

```
POST /v1/verifications/{reference}/send

{ "channel": "email" }                         → sends to the customer's email
{ "channel": "sms", "to": "+250788123456" }    → sends to this phone number
```

If `to` is left out, the backend uses the email or phone entered when the
verification was created. Phone numbers must start with `+` and the country code.

To make sending work, add these settings to `backend/.env`, then **restart the backend**.

**Email (Gmail)**: needs a Gmail *app password*: https://myaccount.google.com/apppasswords

```
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=Zener ID <you@gmail.com>
```

**SMS (Africa's Talking)**: get the API key from your **sandbox app**: https://account.africastalking.com

```
SMS_PROVIDER=africastalking
AT_USERNAME=sandbox
AT_API_KEY=your-sandbox-api-key
```

Sandbox messages appear only in the Africa's Talking simulator, not on real phones.
For real phones, use a live app with credit.

## Folders

```
src/app/(dashboard)/   the dashboard pages, sign in and register
src/app/api/           sign-in cookie and the bridge to the backend
src/components/        shared parts: sidebar, tables, filters, QR code, send dialog
src/lib/               backend calls, types, formatting
```

## Common problems

| Problem | Solution |
|---|---|
| "Cannot reach the Zener ID backend" | Start the backend on port 8000. |
| "Email / SMS is not set up on this server" | Add the settings above to `backend/.env` and restart the backend. |
| "Africa's Talking rejected the username or API key" | Use the key from the sandbox app with `AT_USERNAME=sandbox`. |
| The link does not open on a phone | `localhost` links only work on this computer. Run the backend at a public address. |
