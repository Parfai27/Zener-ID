# Zener ID — frontend

The web app for Zener ID: the **landing page** with **sign in** and **register**, the
**client dashboard**, the **applicant verification flow** and the **admin (reviewer)
console**. The landing, sign-in and register pages are ported from the
[`landing`](https://github.com/Rootway-Labs/landing) repo (Next.js) into `src/landing/`
(Tailwind CSS v4); `next/link` is mapped to the router by a small shim, and the forms
call the backend directly instead of the Next.js `/api/auth/*` routes. Visual style and flow follow Shufti
(session card with short result words, white cards), styled with the Zener ID brand
(`zenerid_brand.pdf`): official logo and favicons in `public/`, Deep Pine / Paper /
Evergreen / Mint palette, Manrope ExtraBold headings and Inter body text.

**Sign-in, registration and password reset use the backend** (`src/api/auth.ts`,
`POST /v1/auth/*` and `/v1/console/auth/login`). The token is kept in
`localStorage` and checked with `GET /v1/auth/me` when the dashboard opens.

**The client dashboard uses the backend too** (`src/api/client.ts`): API keys
(`/v1/api-keys`), creating, listing and reading verifications (`/v1/verifications`,
with evidence images and the PDF report), and the dashboard numbers
(`/v1/metrics/overview`).

**The applicant flow uses the backend** (`src/api/applicant.ts`): the link opens
`/verify/<token>` here (backend `VERIFY_BASE_URL=http://localhost:5173`), and the
page follows the backend's order: consent → document photos
(`POST /v1/sessions/{token}/document`) → a guided face check → result. The face
check sends camera frames to `POST /v1/face/frame` for live guidance (light,
framing, which way the head points), learns the resting pose, waits for each
movement (up, down, left, right), takes a still facing the camera, and sends it all
with a short clip to `POST /v1/sessions/{token}/face`. Retakes and the attempt
limit come from the backend. The QR code on the link is drawn by the backend and
reached through the dev server, so it opens this app.

Still on the in-browser mock (`src/api/mock.ts`, starts empty): the admin
console's data.

## Run it

```bash
cd zener-id/frontend
npm install
npm run dev
```

Start the backend on port 8000 first (see the root README); the dev server
forwards `/v1` to it (`BACKEND_URL` overrides the address). Open
http://localhost:5173. Use `localhost` (or https) — browsers only allow the
camera there.

| Who | Where | Sign-in |
|---|---|---|
| Visitor | `/` | the landing page |
| New client | `/signup` | two steps: name, email, password (12+ characters); country, phone, date of birth |
| Client | `/login` | the email and password you registered with; **Forgot password?** → `/reset-password?token=…` |
| Staff / reviewer | `/login` (same page) → `/admin` | a backend account with a console role (`python -m app.scripts.console_admin create`) |
| Applicant | `/verify/<token>` | the link shown after creating a verification (needs the camera: use `localhost` or https) |

## Try it

1. Register at `/signup` (you are signed in straight away).
2. **New verification** → fill in the applicant → **Create**. You get the link, a QR code
   to scan with a phone, and a button that writes the email in your own mail app.
3. Open the link (new tab, or scan the QR with a phone on the same network through a
   tunnel) and complete the check: photograph the document, then the guided face check.
   Use a real ID: the backend reads it (OCR, MRZ) and compares the face with its photo.
4. The verification's page refreshes by itself while the applicant is at it, then shows
   the decision, each check, what was read from the document and the captured files.
   **Download report** gives the backend's PDF.
5. **API keys**: create a key (shown once), call the API with it in the `X-API-Key`
   header, revoke it.

## Structure

```
src/
  api/types.ts      shapes mirroring kyc-backend schemas (statuses, checks, session)
  api/http.ts       the request helper and how backend errors read
  api/auth.ts       sign-in, register, forgot / reset password, staff sign-in (backend)
  api/client.ts     client dashboard: API keys, verifications, report, metrics (backend)
  api/session.ts    the signed-in token for client and staff, in localStorage
  api/applicant.ts  the applicant's flow on the link: session, document, face (backend)
  api/mock.ts       mock for the admin console's data (starts empty)
  api/index.ts      single import point
  lib/quality.ts    in-browser image quality check (blur, light, size)
  lib/format.ts     labels, result words, reason-code text
  components/       UI kit, Shufti-style SessionCard
  layouts/          client shell, admin shell, auth split
  pages/client/     login, dashboard, verifications, new, detail, API keys, settings
  pages/applicant/  the verification flow + camera hook
  pages/admin/      staff login, overview, review queue, case review, verifications, clients
```

## Connecting the rest

Done: auth (`src/api/auth.ts`), the client dashboard (`src/api/client.ts`) and the
applicant flow (`src/api/applicant.ts`); the dev proxy is in `vite.config.ts`. Next:
the admin console: `/v1/console/metrics/overview`, `/v1/console/verifications`,
`/v1/console/verifications/{id}/approve|decline|redo`, `/v1/console/clients`.
