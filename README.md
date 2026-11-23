# MediTrack – Personal Medicine & Prescription Management System

React (Vite) frontend, Python FastAPI backend, MySQL database.

```
meditrack/
├── database/schema.sql      MySQL schema (optional, tables are also auto-created)
├── backend/                 FastAPI app (app/main.py, routers/, models.py, ...)
└── frontend/                React app (src/pages, src/components, ...)
```

## 1. Database (MySQL 8)

In MySQL Workbench: File → Open SQL Script → choose `database/schema.sql` → click the lightning-bolt button.
(`SOURCE` only works in the command-line client, not in Workbench's editor.) This creates the `meditrack` database and all tables. (If you skip it, the backend creates the tables on first start, but the database itself `meditrack` must exist: `CREATE DATABASE meditrack;`.)

## 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env            # macOS/Linux: cp .env.example .env
```
Edit `.env`: set your MySQL password in `DATABASE_URL` and put a long random string in `SECRET_KEY`
(generate one with `python -c "import secrets; print(secrets.token_hex(32))"`).

```bash
uvicorn app.main:app --reload --port 8000
```
API docs (Swagger): http://localhost:8000/docs

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. In development, `/api` is proxied to port 8000.
For a production build run `npm run build` (set `VITE_API_URL` if the API is on another host, and add the site URL to `CORS_ORIGINS` in the backend `.env`).

## Modules and where they live

| Module | Backend | Frontend |
|---|---|---|
| User authentication (JWT, bcrypt) | `routers/auth.py` | `Login`, `Register`, `AuthContext` |
| Medicine management | `routers/medicines.py` | `pages/Medicines.jsx` |
| Reminder scheduling + Taken/Skipped/Pending | `routers/reminders.py`, `services.py` | `pages/Reminders.jsx`, `DoseRow` |
| Prescription upload / view / download | `routers/prescriptions.py` | `pages/Prescriptions.jsx` |
| Stock and expiry tracking | `services.medicine_out` | `pages/Stock.jsx` |
| Medication history (daily / weekly) | `routers/history.py` | `pages/History.jsx` |
| Dashboard | `routers/dashboard.py` | `pages/Dashboard.jsx` |
| Smart refill prediction | `services.refill_forecast`, `GET /api/medicines/refills` | `components/RefillPanel.jsx` (Dashboard, Stock) |
| Browser notifications | (none, runs in the browser) | `notify.js`, `components/useDoseNotifications.js`, `NotificationPanel.jsx` |
| Doctor-ready adherence report | `routers/reports.py` | `pages/Report.jsx` (print or save as PDF) |
| Emergency medical card (QR) | `routers/emergency.py` | `pages/EmergencyCard.jsx`, public `pages/PublicEmergency.jsx` |
| Automatic medicine entry from a prescription PDF | `prescription_parser.py`, `POST /api/prescriptions/{id}/extract`, `POST /api/medicines/import` | `components/ImportReview.jsx` (opens after a PDF upload) |

## How it behaves

- **Doses:** a reminder is a time of day. Each day the app creates one dose row per active reminder (when you open the Dashboard, Reminders or History pages). Doses start Pending and you mark them Taken or Skipped. A Pending dose from a past day shows as "Missed".
- **Stock:** marking a dose Taken subtracts 1 from the medicine's quantity; switching it away from Taken adds it back. Use the Stock page to enter the new count after a refill.
- **Alerts:** *Low stock* = quantity at or below the threshold you set per medicine; *Out of stock* = 0; *Near expiry* = within 30 days (`NEAR_EXPIRY_DAYS` in `.env`); *Expired* = past the expiry date. Doses stop being scheduled after a medicine's expiry date.
- **Prescriptions:** PDF, PNG or JPG up to 5 MB. File type is checked by content, not just extension. Files are stored in the database (table `prescription_files`) and served only to their owner.
- **Security:** passwords hashed with bcrypt, JWT bearer tokens (24 h), every query is scoped to the logged-in user.

## Notes for production

Use HTTPS, a strong `SECRET_KEY`, a dedicated MySQL user (not root), and back up the database. Reminders are in-app (a schedule you check off), not push or SMS notifications.

## Added features: how they work

- **Refill prediction:** doses per day = number of active reminders for a medicine (one unit per dose). Days left = stock ÷ doses per day. Critical at 3 days or less, soon at 7 or less, and "order by" is 3 days before the run-out date. Medicines without a reminder have no schedule, so they are not predicted.
- **Browser notifications:** turn on from the Reminders page. A notification appears when a dose is due and again 15 minutes later if it is still Pending. The page checks every 30 seconds, so MediTrack must be open in a browser tab (background is fine). It does not work when the browser is closed.
- **Doctor report:** pick 7, 30, 90 days or a custom range (max 93 days), then "Print or save as PDF" and choose "Save as PDF" as the printer. A past Pending dose counts as missed; today's pending doses are not counted yet.
- **Emergency card:** opt-in. When sharing is on, anyone with the secret link or QR code can see name, blood group, allergies, conditions, one contact, notes and current unexpired medicines (never the email). Switch sharing off or use "Revoke" to kill the link. For a phone to open the QR code, set the address to your computer's Wi-Fi IP (for example `http://192.168.1.5:5173`), keep the phone on the same Wi-Fi, and allow Node.js through the Windows firewall.

## Automatic medicine entry (PDF text, no AI)

Upload a PDF prescription and a review window opens. MediTrack reads the PDF's text (with `pypdf`, pure Python, no AI service and no internet needed), suggests each medicine with its dosage, frequency, reminder times, course length, quantity and notes, and you confirm or edit before anything is saved. You can also open it later with "Add medicines" on any uploaded PDF.

- **How it reads:** it looks for dosages such as `500 mg`, takes the words before as the medicine name, then searches the text up to the next medicine for the frequency (`1-0-1`, `OD`, `BD`, `TDS`, `QID`, `SOS`, "twice daily", "every 8 hours", "once weekly"), the course length ("5 days", "2 weeks", "1 month") and instructions ("after food").
- **Reminder times:** once daily 08:00 (21:00 if it says night or bedtime), twice 08:00 and 20:00, three times 08:00, 14:00 and 20:00, four times 06:00, 12:00, 18:00 and 22:00. For `1-0-1` style the positions are morning, afternoon and night. Every time can be changed in the review window.
- **Expiry date:** a prescription does not list one, so it is pre-filled with the last day of the course. Replace it with the date on the pack.
- **Not created automatically:** weekly and as-needed (SOS) medicines get no reminder, because reminders repeat daily.
- **Limits:** it works only on PDFs that contain real text. Scans, photos and images cannot be read (reading them needs OCR or an AI vision model, which this version does not use). Unusual layouts can be missed, which is why the review step exists. A medicine already saved with the same name and dosage is skipped.

## Upgrading an existing copy

Extract the new zip over your existing folder, then run `npm install` in `frontend` (new package: `qrcode`) and `python -m pip install -r requirements.txt` in the backend (new package: `pypdf`, pure Python). Restart the backend, which creates the new `emergency_profiles` table by itself.

## Hosting online (Render + Vercel + TiDB Cloud)

Render has no MySQL, and Aiven closed new free MySQL services on 6 November 2026, so the free MySQL option used here is TiDB Cloud Starter (MySQL-compatible). Render's free disk is wiped whenever the service sleeps, which is why uploaded prescriptions are stored in the database.

1. **GitHub:** push the project (without `.env`, `.venv` and `node_modules`, which `.gitignore` already excludes).
2. **Database (TiDB Cloud Starter):** create a Starter instance, run `CREATE DATABASE meditrack;` in its SQL editor, then Connect > Public > SQLAlchemy > PyMySQL for the connection string. Use `/meditrack` as the database name, set `ssl_ca=/etc/ssl/certs/ca-certificates.crt` (Linux) and keep `ssl_verify_cert=true&ssl_verify_identity=true`. URL-encode special characters in the password.
3. **Backend (Render Web Service):** Root Directory `backend`, Build Command `pip install -r requirements.txt`, Start Command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, Free instance. Environment variables: `DATABASE_URL`, `SECRET_KEY` (long random string), `CORS_ORIGINS` (your Vercel URL), optionally `PYTHON_VERSION=3.13.5`. Check `https://<service>.onrender.com/api/health`.
4. **Frontend (Vercel):** import the repo, Root Directory `frontend`, Framework Vite, environment variable `VITE_API_URL=https://<service>.onrender.com/api`. `frontend/vercel.json` makes page refreshes and the emergency QR links work.
5. **Connect them:** put the Vercel address into `CORS_ORIGINS` on Render (no trailing slash) and redeploy.

Free-tier behaviour: the Render service sleeps after 15 minutes without traffic and takes about a minute to wake, so open `/api/health` before a demo. Change `VITE_API_URL` only with a Vercel redeploy, because Vite bakes it in at build time.
