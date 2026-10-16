from pathlib import Path

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Engine

ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


class SchemaOutOfDateError(RuntimeError):
    pass


def ensure_schema_up_to_date(engine: Engine) -> None:
    """Raises SchemaOutOfDateError if the database is missing Alembic migrations."""
    script = ScriptDirectory.from_config(Config(ALEMBIC_INI))
    with engine.connect() as connection:
        current = set(MigrationContext.configure(connection).get_current_heads())
    if current != set(script.get_heads()):
        raise SchemaOutOfDateError(
            "The database schema is out of date. From the backend directory run: "
            "uv run alembic upgrade head"
        )
