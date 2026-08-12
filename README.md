# Bridge School Portal

A web portal for managing school operations such as results, meetings, and parent communication built with React and FastAPI.

## Setup — every teammate does this after cloning

### 1. Database (Aiven MySQL — shared by team)
The project uses a shared Aiven MySQL database. **No local MySQL installation is needed.**

You will need **two files** from the team lead (do NOT commit these to Git):
- `backend/.env` — contains the database password and API keys
- `backend/ca.pem` — SSL certificate required to connect to Aiven

### 2. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Linux / macOS
# venv\Scripts\activate          # Windows
pip install -r requirements.txt
```
Ask the team lead for the `.env` and `ca.pem` files and place them in the `backend/` folder.

Tables are created automatically on first run:
```bash
cd ..
python -m uvicorn backend.main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

### Deployment API URL

The frontend uses same-origin API paths by default, so no source changes are needed when the frontend and backend are deployed behind one domain. For a separately hosted API, set `VITE_API_BASE_URL` in the frontend deployment environment and set `CORS_ORIGINS` in the backend environment (see the `.env.example` files). Uploaded email images use the deployed request host; set `PUBLIC_BASE_URL` in the backend environment if a reverse proxy does not forward that public host.

### Web push notifications

Web push requires HTTPS (localhost is allowed for development), a service worker, browser permission, and VAPID keys. Generate one VAPID key pair for the deployed application, set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in `backend/.env`, then restart the backend. Users opt in from Settings → Device notifications. A browser profile is associated with the most recently signed-in account, so shared/public computers should not enable device notifications.

### 4. Test Accounts (seeded automatically)
| Role    | Email                  | Password     |
|---------|------------------------|--------------|
| Admin   | admin@bridge.school    | password123  |
| Teacher | teacher@bridge.school  | password123  |
| Student | student@bridge.school  | password123  |
| Parent  | parent@bridge.school   | password123  |

## Tech Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: FastAPI + SQLAlchemy
- Database: Aiven MySQL (cloud-hosted, shared)
