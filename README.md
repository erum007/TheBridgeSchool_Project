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

The frontend uses same-origin API paths by default, so no source changes are needed when the frontend and backend are deployed behind one domain. For a separately hosted API, set `VITE_API_URL` in the frontend deployment environment and set `CORS_ORIGINS` in the backend environment (see the `.env.example` files). Uploaded email images use the deployed request host; set `PUBLIC_BASE_URL` in the backend environment if a reverse proxy does not forward that public host.

### Android / Cordova build

Production and mobile builds use the Railway API URL from `frontend/.env.production`
and `frontend/.env.mobile`; local `npm run dev` continues to use `frontend/.env`.

```bash
cd frontend
npm run build          # outputs the deployable web app to frontend/dist
npm run build:mobile   # outputs the Cordova app directly to mobile/www

cd ../mobile
npx cordova build android
```

The Railway backend must allow the Cordova Android WebView origin. Set this Railway
environment variable and redeploy the backend:

```text
CORS_ORIGINS=https://localhost,http://localhost
```

If the browser frontend is hosted on another domain, append that origin to the same
comma-separated value.

### API rate limits

Requests are limited per client and API service. Standard reads allow 120 requests
per minute and writes allow 30 per minute. Email delivery, push delivery, and file
uploads allow 10 per minute; AI and sensitive authentication operations allow 5 per
minute. Responses include `X-RateLimit-*` headers, and rejected requests return HTTP
`429` with `Retry-After`. Set `RATE_LIMIT_ENABLED=false` only when local testing needs
to bypass the limiter.

The included counter is process-local. Use a shared backing store such as Redis before
running multiple backend workers or replicas so every instance shares the same quota.

### Android native notifications

The Cordova build uses Firebase Cloud Messaging; browser Web Push remains in use
for the website. In Firebase Console, add an Android app with package name
`com.thebridgeschool.portal`, download `google-services.json`, and copy it to
`mobile/google-services.json`. Create a Firebase service-account private key and
set the complete JSON object as Railway's `FIREBASE_SERVICE_ACCOUNT_JSON` value.
Never commit the service-account private key.

Then rebuild the native app:

```bash
cd frontend
npm run build:mobile
cd ../mobile
npx cordova prepare android
npx cordova build android
```

The mobile build includes native Firebase messaging, app-scoped file downloads,
system-browser links, secure credential storage, and Android Back-button handling.

### Browser push notifications

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
