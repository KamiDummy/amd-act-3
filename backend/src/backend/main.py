from fastapi import FastAPI
from sqlalchemy import text
from backend.database import engine

app = FastAPI(title="Project API")


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/health/db")
def health_check_db():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "db connected"}
