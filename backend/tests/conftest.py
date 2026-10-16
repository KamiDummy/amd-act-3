import os

# Settings require DATABASE_URL at import time; tests never connect, so any URL works.
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
