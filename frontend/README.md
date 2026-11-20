# Zener ID — frontend (mock mode)

The web app for Zener ID: the **landing page** with **sign in** and **register**, the
**client dashboard**, the **applicant verification flow** and the **admin (reviewer)
console**. The landing, sign-in and register pages are ported from the
[`landing`](https://github.com/Rootway-Labs/landing) repo (Next.js) into `src/landing/`
(Tailwind CSS v4); `next/link` is mapped to the router by a small shim, and the forms
call the mock instead of the Next.js `/api/auth/*` routes. Visual style and flow follow Shufti
(session card with short result words, white cards), styled with the Zener ID brand
(`zenerid_brand.pdf`): official logo and favicons in `public/`, Deep Pine / Paper /
Evergreen / Mint palette, Manrope ExtraBold headings and Inter body text.

**It is not connected to the backend yet.** All data comes from an in-browser mock
(`src/api/mock.ts`) stored in `localStorage`, so the UI can be checked first.

## Run it

```bash
cd zener-id/frontend
npm install
npm run dev
```

Open http://localhost:5173. Use `localhost` (or https) — browsers only allow the
camera there.

| Who | Where | Mock sign-in |
|---|---|---|
| Visitor | `/` | the landing page |
| New client | `/signup` | two steps: name, email, password (12+ characters); country, phone, date of birth |
| Client | `/login` | `aline@acmebank.rw` (or the email you registered) + any password of 6+ characters |
| Staff / reviewer | `/admin/login` | any email, any 6+ char password, any 6-digit code |
| Applicant | `/v/<token>` | the link shown after creating a verification |

## Try the whole loop

1. Sign in as the client → **New verification** → fill in the applicant → **Create**. The applicant flow follows Shufti's hosted layout and order: consent → face → document (country, type, photo or upload, front and back, "Check your photo") → verification → completed.
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

Reset everything from **Settings → Mock data**.

## Structure

```
src/
  api/types.ts      shapes mirroring kyc-backend schemas (statuses, checks, session)
  api/mock.ts       mock backend: store, seed data, decision engine, latency
  api/index.ts      single import point — swap mock for HTTP here later
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

1. Add `src/api/http.ts` exporting the same functions, calling `/v1/...`
   (e.g. `POST /v1/verifications`, `GET /v1/verifications/{reference}`,
   `GET /v1/sessions/{token}`, `POST /v1/sessions/{token}/document`, `.../face`,
   `/v1/console/reviews/{id}/approve`).
2. Switch the export in `src/api/index.ts`.
3. Add a dev proxy for `/v1` → `http://localhost:8000` in `vite.config.ts`.

Mock-only pieces to replace then: the QR code (not scannable — the backend serves a
real one), the PDF report button, and the sandbox outcome panel.
