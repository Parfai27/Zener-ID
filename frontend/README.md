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

The parts not connected yet use an in-browser mock
(`src/api/mock.ts`) stored in `localStorage`, so the UI can be checked first.
**Sign-in, registration and password reset use the backend** (`src/api/auth.ts`,
`POST /v1/auth/*` and `/v1/console/auth/login`). The token is kept in
`localStorage` and checked with `GET /v1/auth/me` when the dashboard opens.
Everything else still uses the mock, which **starts empty**: a registered account
gets an empty workspace the first time it opens the dashboard.

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
| Applicant | `/v/<token>` | the link shown after creating a verification |

## Try the whole loop

1. Register at `/signup` (you are signed in straight away) → **New verification** → fill in the applicant → **Create**. The applicant flow follows Shufti's hosted layout and order: consent → face → document (country, type, photo or upload, front and back, "Check your photo") → verification → completed.
2. Click **Open** on the link (new tab) to act as the applicant.
3. Use the **Sandbox** box (bottom-left) to choose the outcome: pass, face mismatch,
   borderline (goes to review), liveness fail, name / DOB mismatch, expired, under 18,
   or "first photo blurry".
4. Capture the document with the camera, upload a photo, or use the sample buttons.
   The blur / light / size check runs for real in the browser (Laplacian variance).
5. Do the face check (look straight, left, right). Without a camera there is a
   "continue without a camera (mock only)" button.
6. Back in the dashboard the verification shows its decision and reasons.
7. Borderline cases appear in **/admin/review**: approve, decline or ask to retry, with a note.

Delete the verifications and keys kept in this browser from **Settings → Data → Clear local data** (accounts are on the server and stay).

## Structure

```
src/
  api/types.ts      shapes mirroring kyc-backend schemas (statuses, checks, session)
  api/auth.ts       sign-in, register, forgot / reset password, staff sign-in (backend)
  api/session.ts    the signed-in token for client and staff, in localStorage
  api/mock.ts       mock for the rest: store (starts empty), decision engine, latency
  api/index.ts      single import point
  lib/quality.ts    in-browser image quality check (blur, light, size)
  lib/format.ts     labels, result words, reason-code text
  components/       UI kit, Shufti-style SessionCard
  layouts/          client shell, admin shell, auth split
  pages/client/     login, dashboard, verifications, new, detail, API keys, settings
  pages/applicant/  the verification flow + camera hook
  pages/admin/      staff login, overview, review queue, case review, verifications, clients
```

## Connecting the backend later

The status vocabulary already matches the backend (`pending`, `in_progress`, `passed`,
`failed`, `needs_review`, `expired`; checks `pass` / `fail` / `review`). To connect:

Auth is done (`src/api/auth.ts`; the `/v1` dev proxy is in `vite.config.ts`). For
the rest, move each mock function to an HTTP call with the same name, sending
`Authorization: Bearer <token>` from `currentSession(...)`
(e.g. `POST /v1/verifications`, `GET /v1/verifications/{reference}`,
`GET /v1/sessions/{token}`, `POST /v1/sessions/{token}/document`, `.../face`,
`/v1/console/reviews/{id}/approve`).

Mock-only pieces to replace then: the QR code (not scannable — the backend serves a
real one), the PDF report button, and the sandbox outcome panel.
