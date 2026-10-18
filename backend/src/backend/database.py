from collections.abc import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from backend.config import settings

# psycopg prepares a statement once it has run 5 times on a connection. Supabase's
# transaction pooler shares its server connections between clients, so two clients'
# statements collide ("prepared statement _pg3_0 already exists"). Never prepare.
# The pooler can also drop a connection that sat idle, so each one is tested before use.
engine = create_engine(
    settings.database_url,
    connect_args={"prepare_threshold": None},
    pool_pre_ping=True,
)
# Loaded objects stay usable after a commit, so a request can end its transaction while
# it waits on the language model (release_connection) and carry on with what it loaded.
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

# Supabase's free tier makes the database read-only past 500 MB. Loaders of law stop at
# this size (MiB, as pg_size_pretty reports), leaving room for documents and indexes.
MAX_LAW_LOAD_MB = 460


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


def release_connection(session: Session) -> None:
    """Ends the session's transaction, which returns its connection to the pool. Call it
    before waiting on the language model: the pooler shares few server connections, and
    one left idle in a transaction for a minute or two can be dropped, failing the next
    query. What the session loaded stays usable; its next query starts a new transaction."""
    session.commit()


def database_size_mb(session: Session) -> float:
    """The whole database's size on disk, in MiB."""
    size = session.execute(text("select pg_database_size(current_database())")).scalar_one()
    return size / (1024 * 1024)
