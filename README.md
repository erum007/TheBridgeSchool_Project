# Bridge School Portal

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

## Meeting Workspace & Action Tracker

### 1. Required environment variables
Add the following values to [backend/.env](backend/.env) before running the AI features:

- GEMINI_API_KEY: your Google AI Studio API key for Gemini. Create one at https://aistudio.google.com/app/apikey.
- GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET: OAuth 2.0 credentials for Gmail API access. Create them in Google Cloud Console -> APIs & Services -> Credentials, then enable the Gmail API.
- Optional: GEMINI_MODEL if you want to override the default model; the feature currently uses gemini-3.1-flash-lite.

> Keep the .env file local and do not commit secrets.

### 2. How to run this feature locally
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Linux / macOS
# venv\Scripts\activate         # Windows
pip install -r requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

Then use the existing meetings API endpoints to:
- POST /api/meetings/{meeting_id}/ai-workspace with a meeting transcript body
- POST /api/action-items/{action_item_id}/complete to mark an action item as done

### 3. Daily reminder job
The backend includes a reminder flow for action items that are due today or overdue. It groups pending items by assignee and sends one email per assignee, skipping completed tasks.

To change the reminder schedule, edit the APScheduler setup in [backend/main.py](backend/main.py) (or the scheduler service if it is later extracted) and adjust the interval or cron expression to match your preferred cadence.

### 4. Gemini free-tier rate limits to be aware of
The Gemini free tier is usually rate-limited by requests per minute and requests per day, and those thresholds can change without notice. Bridge School should monitor usage closely and be prepared to move to a paid tier if:
- many meetings are processed in a short burst
- reminder or summary jobs run frequently across many users
- the app starts processing transcripts continuously during the school day

If the free quota is exhausted, the AI service will surface a clear error and the meeting workspace feature will stop producing new summaries until the limit resets or a paid plan is enabled.