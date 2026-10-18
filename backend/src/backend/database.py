from collections.abc import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from backend.config import settings

# psycopg prepares a statement once it has run 5 times on a connection. Supabase's
# transaction pooler shares its server connections between clients, so two clients'
# statements collide ("prepared statement _pg3_0 already exists"). Never prepare.
engine = create_engine(settings.database_url, connect_args={"prepare_threshold": None})
SessionLocal = sessionmaker(bind=engine)

# Supabase's free tier makes the database read-only past 500 MB. Loaders of law stop at
# this size (MiB, as pg_size_pretty reports), leaving room for documents and indexes.
MAX_LAW_LOAD_MB = 460


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


def database_size_mb(session: Session) -> float:
    """The whole database's size on disk, in MiB."""
    size = session.execute(text("select pg_database_size(current_database())")).scalar_one()
    return size / (1024 * 1024)
