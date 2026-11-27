# Zener ID

Identity verification (KYC): a business sends a link, the person photographs their ID
and takes a short face check, and the business gets **Verified**, **Declined** or
**Needs review**, with the reasons.

```
backend/    FastAPI service: OCR, MRZ, liveness, face match, decisions (Python 3.11, PostgreSQL)
frontend/   Web app: landing, sign in / register, client dashboard, applicant flow, admin console (React + Vite)
```

## Get the code

```bash
git clone -b parfait https://github.com/Parfai27/Zener-ID.git zener-id
cd zener-id
```

## Run the frontend

Needs **Node.js 18+**, and the backend running on port 8000 (below): accounts,
API keys and verifications are stored there. The admin console's data still
runs on an in-browser mock that starts empty.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

There are no sample accounts: register first.

| Page | Sign-in |
|---|---|
| `/signup` register | your details, password of 12+ characters (common passwords are refused) |
| `/login` client dashboard | the email and password you registered with; **Forgot password?** sends a reset link |
| `/login` → admin console | the same page: a staff account opens the console instead of the dashboard (create one with `python -m app.scripts.console_admin create`, see `backend/README.md`) |

The dev server forwards `/v1` to `http://localhost:8000`; set `BACKEND_URL` to use another address.

## Run the backend

Needs **Python 3.11**, **PostgreSQL 14+** and **Tesseract OCR**. Full details: [backend/README.md](backend/README.md).

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env               # then set DATABASE_URL to your database
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

- Download the face models into `backend/models/` first (commands in `backend/README.md`, about 290 MB).
- On Windows set `PYTHONUTF8=1` before starting, and add Tesseract (`C:\Program Files\Tesseract-OCR`) to `PATH`.
- Add `VERIFY_BASE_URL=http://localhost:5173` to `backend/.env` so verification links open the frontend's applicant flow.
- API docs: http://localhost:8000/docs
- Add `DASHBOARD_URL=http://localhost:5173` to `backend/.env` so password-reset links open the frontend. With email off (the default in development) the reset link is shown on the sign-in page instead of being emailed.

## Status

Connected: sign-in, registration, forgot / reset password (HTML email through SMTP), admin console sign-in,
and the client dashboard (API keys, creating, listing and reading verifications, the PDF report, dashboard numbers).
and the applicant flow on the verification link (document photos, then a guided face check with live feedback).
Not yet: the admin console's data, which still runs on the in-browser mock (`frontend/README.md`).
