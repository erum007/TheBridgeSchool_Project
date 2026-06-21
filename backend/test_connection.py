# backend/test_connection.py
import sys
from sqlalchemy import text
from .database import engine

def test_connection():
    print("Connecting to the database...")
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1;"))
            val = result.scalar()
            if val == 1:
                print("✅ Success! Connected to database successfully.")
            else:
                print(f"⚠️ Connected, but test query returned unexpected value: {val}")
    except Exception as e:
        print("❌ Connection failed!")
        print(f"Error Details: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_connection()
