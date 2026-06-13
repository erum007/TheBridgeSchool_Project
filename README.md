# Bridge School Portal

## Setup — every teammate does this after cloning

### 1. Database (MySQL must be installed)
```sql
CREATE DATABASE bridge_school CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'bridge_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON bridge_school.* TO 'bridge_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Fill in your DB password and SECRET_KEY in .env
uvicorn main:app --reload
```
Tables are created automatically on first run.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Tech Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: FastAPI + SQLAlchemy
- Database: MySQL