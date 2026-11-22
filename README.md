# Zener ID

Identity verification (KYC): a business sends a link, the person photographs their ID
and takes a short face check, and the business gets **Verified**, **Declined** or
**Needs review**, with the reasons.

```
backend/    FastAPI service: OCR, MRZ, liveness, face match, decisions (Python 3.11, PostgreSQL)
frontend/   Web app: landing, sign in / register, company dashboard, applicant flow, admin console (Next.js)
```

## Get the code

```bash
git clone -b parfait https://github.com/Parfai27/Zener-ID.git zener-id
cd zener-id
```

## Run the backend

Needs **Python 3.11** (3.12 also works), **PostgreSQL 14+** and **Tesseract OCR**. Full details: [backend/README.md](backend/README.md); a step-by-step Windows guide is in [frontend/README.md](frontend/README.md#2-set-it-up-from-scratch-windows).

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env               # then set DATABASE_URL to your database
alembic upgrade head
uvicorn app.main:app --reload --reload-dir app --port 8000
```

- Download the face models into `backend/models/` first (commands in `backend/README.md`, about 276 MB).
- On Windows set `PYTHONUTF8=1` before starting, and add Tesseract (`C:\Program Files\Tesseract-OCR`) to `PATH`.
- The backend reads `.env` only when it starts: restart it after changing `.env`.
- Sending links by email and SMS needs `EMAIL_ENABLED` / `SMTP_*` and `SMS_PROVIDER` with its keys in `.env` (see `.env.example`).
- API docs: http://localhost:8000/docs

## Run the frontend

Needs **Node.js 18.18+** and the backend running (below): the company dashboard
reads and writes the PostgreSQL database through it.

```bash
cd frontend
npm install
npm run dev                        # backend elsewhere? set ZENER_API_URL first
```

Open http://localhost:5173

| Page | Sign-in |
|---|---|
| `/` landing | — |
| `/register`, `/login` company dashboard | a real account: register first (password of 12+ characters) |
| `/admin/login` admin console | mock: any email, any 6+ character password, any 6-digit code |

Details: [frontend/README.md](frontend/README.md).

## Status

- The **company dashboard** (`/dashboard`) is connected to the backend: a new company starts
  empty, and everything it creates is stored in PostgreSQL.
- The **admin console** (`/admin`) and the **applicant flow** (`/v/<token>`) still run on the
  in-browser mock. The link a company sends its customer opens the backend's own
  verification pages (`/verify/<token>`).
