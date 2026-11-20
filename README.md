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

## Run the frontend (quickest)

Needs **Node.js 18+**. It runs on built-in mock data, so no backend is needed yet.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

| Page | Mock sign-in |
|---|---|
| `/` landing, `/signup` register | password of 12+ characters |
| `/login` client dashboard | `aline@acmebank.rw` + any 6+ character password |
| `/admin/login` admin console | any email, any 6+ character password, any 6-digit code |

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
- API docs: http://localhost:8000/docs

## Status

The frontend is not connected to the backend yet; `frontend/README.md` explains how to connect it.
