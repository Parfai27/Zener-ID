# Zener ID

Identity verification (KYC). A business sends a link; the person photographs their ID
and does a short face check; the business gets **Verified**, **Declined** or **Needs
review**, with the reasons.

```
backend/    API: FastAPI, Python 3.11, PostgreSQL. OCR, liveness, face match, decisions
frontend/   Website: React, Vite, Tailwind. Landing, client dashboard, admin console, verification pages
```

## Run it locally

**Backend** needs Python 3.11, PostgreSQL 14+ and Tesseract OCR.

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
sh docker/fetch-models.sh         # face models, about 290 MB, once
cp .env.example .env              # set DATABASE_URL
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

On Windows, set `PYTHONUTF8=1` and add Tesseract to `PATH` first.

**Frontend** needs Node.js 18+. It forwards `/v1` to the backend on port 8000.

```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

## Accounts

- **Business:** register at `/signup`, then log in at `/login`.
- **Admin:** create a staff account, then log in at the same `/login`:

  ```bash
  python -m app.scripts.console_admin create --email you@example.com --first-name You \
    --last-name Name --role owner --products kyc --phone 788000000 \
    --country-code +250 --country Rwanda --date-of-birth 1990-01-01
  ```

## Settings

In `backend/.env`:

| Setting | What |
|---|---|
| `DATABASE_URL` | the PostgreSQL database |
| `JWT_SECRET` | signing key; required outside development |
| `DASHBOARD_URL` | the website's address, for password-reset links |
| `VERIFY_BASE_URL` | the website's address, for verification links and QR codes |
| `EMAIL_ENABLED`, `SMTP_*`, `EMAIL_FROM` | outgoing email (SendGrid) |

## More

- API docs: http://localhost:8000/docs
- Hosting on Vercel and Render: [HOSTING.md](HOSTING.md)
- Details: [backend/README.md](backend/README.md), [frontend/README.md](frontend/README.md)
