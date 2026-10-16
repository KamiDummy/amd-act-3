"""Loads Canadian federal Acts and regulations into the vector database.

Run from the backend directory:
    uv run python -m backend.ingest_laws                 # download + load every Act and regulation
    uv run python -m backend.ingest_laws --only C-46 A-1 # just these laws (file names)
    uv run python -m backend.ingest_laws --limit 20      # first 20 files, for a test run

Safe to run again: laws already loaded are skipped (use --force to reload them).
"""

import argparse
import subprocess
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.exc import DBAPIError

from backend.database import SessionLocal, engine
from backend.laws import ParsedAct, parse_act, store_act
from backend.models import Law

REPO = "https://github.com/justicecanada/laws-lois-xml.git"
DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "laws-lois-xml"


def fetch_xml() -> Path:
    """Clones (or updates) the English Acts and regulations. Returns the `eng` folder."""
    if not DATA_DIR.exists():
        DATA_DIR.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["git", "clone", "--depth", "1", "--filter=blob:none", "--sparse", REPO, str(DATA_DIR)],
            check=True,
        )
        subprocess.run(["git", "-C", str(DATA_DIR), "sparse-checkout", "set", "eng/acts", "eng/regulations"], check=True)
    else:
        subprocess.run(["git", "-C", str(DATA_DIR), "pull", "--ff-only"], check=True)
    return DATA_DIR / "eng"


def main() -> None:
    parser = argparse.ArgumentParser(description="Load federal Acts and regulations into the vector database.")
    parser.add_argument("--only", nargs="+", metavar="ID", help="file names, e.g. C-46")
    parser.add_argument("--limit", type=int, help="Stop after this many files")
    parser.add_argument("--force", action="store_true", help="Reload laws already stored")
    args = parser.parse_args()

    eng_dir = fetch_xml()
    # Acts first: they are the core of what a contract question needs.
    paths = sorted(eng_dir.glob("acts/*.xml")) + sorted(eng_dir.glob("regulations/*.xml"))
    if args.only:
        wanted = set(args.only)
        paths = [p for p in paths if p.stem in wanted]
    if args.limit:
        paths = paths[: args.limit]

    with SessionLocal() as db:
        loaded = set(db.scalars(select(Law.id)))
    for i, path in enumerate(paths, 1):
        if path.stem in loaded and not args.force:
            continue
        act = parse_act(path)
        if act is None:
            print(f"[{i}/{len(paths)}] {path.stem}: skipped (repealed or not a law)")
            continue
        count = store_with_retry(act)
        print(f"[{i}/{len(paths)}] {act.id} {act.title}: {count} sections", flush=True)


def store_with_retry(act: ParsedAct) -> int:
    """Stores one law on a fresh connection. Embedding can take long enough for
    Supabase's pooler to drop an idle connection, so one failed attempt is retried."""
    for attempt in (1, 2):
        try:
            with SessionLocal() as db:
                return store_act(db, act)
        except DBAPIError:
            if attempt == 2:
                raise
            engine.dispose()
    raise AssertionError("unreachable")


if __name__ == "__main__":
    main()
