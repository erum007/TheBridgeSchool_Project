# backend/update_db.py
from sqlalchemy import text
from .database import engine

def update_database():
    print("⏳ Connecting to the database to apply schema updates...")
    with engine.connect() as conn:
        try:
            # Write your ALTER TABLE statements here. For example:
            # conn.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR(32) NULL;"))
            
            conn.commit()
            print("✅ Successfully updated the database schema!")
        except Exception as e:
            print(f"⚠️ Could not update database schema. Error: {e}")

if __name__ == "__main__":
    update_database()
