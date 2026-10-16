import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from backend.api import router as api_router
from backend.auth import router as auth_router
from backend.config import settings
from backend.database import engine
from backend.schema_check import ensure_schema_up_to_date

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Fail fast with a clear message instead of 500s on every request after a missed migration.
    try:
        ensure_schema_up_to_date(engine)
    except OperationalError:
        logger.warning("Database unreachable at startup; skipping the schema check.")
    yield


app = FastAPI(title="Project API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(api_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/health/db")
def health_check_db():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "db connected"}
