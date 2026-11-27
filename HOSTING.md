# Hosting Zener ID on Vercel and Render

| Part | Where | Address |
|---|---|---|
| Website: landing, dashboards, admin console, verification pages (`frontend/`) | **Vercel** | `https://zenerid.vercel.app` (or your own domain) |
| API (`backend/`) | **Render**, web service | `https://zenerid-api.onrender.com` |
| Database | **Render**, PostgreSQL | private to Render |

Both deploy from GitHub by themselves on every push to `main`. Nothing is built
on your computer: Render builds `backend/Dockerfile` on its own servers.

The website calls the API directly (not through Vercel), because Vercel's
forwarding refuses requests over 4.5 MB, and the face check sends more.

## Cost, roughly per month

| | Plan | Why |
|---|---|---|
| Render API | **Standard**, about $25 | 2 GB of memory; the OCR and face models do not fit in less |
| Render disk, 5 GB | about $1.25 | uploaded ID photos survive restarts |
| Render PostgreSQL | **Basic 256 MB**, about $6 | the free one is deleted after 30 days |
| Vercel | Hobby, free | Vercel asks businesses to use **Pro** ($20) |

## The order

Each side needs the other's address, so: Vercel first, then Render, then tell
Vercel where Render is.

### 1. Vercel: the website

1. Sign in at <https://vercel.com> with GitHub.
2. **Add New → Project**, pick **Parfai27/Zener-ID**, then **Import**.
3. **Project Name:** `zenerid` (this gives `https://zenerid.vercel.app`).
4. **Root Directory:** click **Edit** and choose **`frontend`**. Vercel then
   finds `frontend/vercel.json` and builds it as a Vite app.
5. **Deploy**. Note the address it shows, e.g. `https://zenerid.vercel.app`.
   The site opens, but signing in fails until step 3.

### 2. Render: the API and the database

1. Sign in at <https://render.com> with GitHub, and add a payment card
   (Account → Billing): the plans above are paid.
2. **New → Blueprint**, pick **Parfai27/Zener-ID**, branch **main**. Render reads
   `render.yaml` and lists `zenerid-db` and `zenerid-api`.
3. It asks for the values it cannot know:

   | Setting | Value |
   |---|---|
   | `DASHBOARD_URL` | the Vercel address, e.g. `https://zenerid.vercel.app` |
   | `VERIFY_BASE_URL` | the same address |
   | `CORS_ORIGINS` | the same address |
   | `SMTP_PASSWORD` | a **new** SendGrid API key (Mail Send permission) |
   | `EMAIL_FROM` | `Zener ID <sender@yourdomain.com>`, a sender verified in SendGrid |

4. **Apply**. The first build takes 15 to 25 minutes (it compiles the face
   library and downloads the models). Follow it under **zenerid-api → Logs**:
   `running migrations`, then the models load, then the service is **Live**.
5. Note the API's address at the top of its page, e.g.
   `https://zenerid-api.onrender.com`. Opening
   `https://zenerid-api.onrender.com/v1/health` should show `"status":"ok"`.

### 3. Vercel: point the website at the API

1. In the Vercel project: **Settings → Environment Variables**, add
   `VITE_API_URL` = the Render address, e.g. `https://zenerid-api.onrender.com`
   (no slash at the end), for **Production**.
2. **Deployments**, the latest one, **⋯ → Redeploy**. The address is built into
   the website, so it needs this rebuild.

### 4. Your admin account

In Render: **zenerid-api → Shell**, and run (with your own details):

```
python -m app.scripts.console_admin create --email you@yourdomain.com \
  --first-name Your --last-name Name --role owner --products kyc \
  --phone 788000000 --country-code +250 --country Rwanda --date-of-birth 1990-01-01
```

It shows the database host and asks you to type it back, then asks for the
password (at least 12 characters). Log in at `https://zenerid.vercel.app/login`.

### 5. Try the whole journey

Register a business account, create a verification, open the link on your phone,
do the document and face steps, and see the result in the dashboard and the
admin console.

## Your own domain (optional)

- **Website:** Vercel → Settings → **Domains**, add e.g. `app.yourdomain.com` and
  create the DNS record it shows.
- **API:** Render → zenerid-api → Settings → **Custom Domains**, add e.g.
  `api.yourdomain.com` and create the DNS record it shows.
- Then update `DASHBOARD_URL`, `VERIFY_BASE_URL` and `CORS_ORIGINS` on Render, and
  `VITE_API_URL` on Vercel (and redeploy it), to the new addresses.

## Updating

Merge into `main`. Vercel and Render both redeploy by themselves; database
changes are applied when the API starts.

## If something goes wrong

- **Sign-in says the service is unavailable:** `VITE_API_URL` is missing or wrong
  on Vercel, or Vercel was not redeployed after setting it.
- **The browser console shows a CORS error:** `CORS_ORIGINS` on Render must be the
  website's address exactly, with `https://` and no slash at the end.
- **The API restarts with "out of memory":** move zenerid-api to the **Pro** plan (4 GB).
- **Reset emails do not arrive:** check `EMAIL_FROM` is a verified sender in
  SendGrid; in the Render Shell, `python -m app.scripts.send_test_email you@example.com`.
- **QR codes or emailed links point at the wrong place:** `VERIFY_BASE_URL` and
  `DASHBOARD_URL` on Render.
