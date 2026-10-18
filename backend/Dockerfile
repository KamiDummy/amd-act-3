FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.10 /uv /bin/uv

# Compile bytecode for a faster start; copy from the cache instead of linking, since it
# is a separate mount.
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/opt/huggingface

WORKDIR /app

# Dependencies first, in their own layer, so code changes don't reinstall them.
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-dev --no-install-project

COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev

ENV PATH="/app/.venv/bin:$PATH"

# Bake the embedding model into the image, so the first search doesn't download it.
# Settings need a database URL to import; nothing connects to it here.
RUN DATABASE_URL=postgresql://build@localhost/build \
    python -c "from backend.laws import get_model; get_model()"

RUN useradd --system --no-create-home app \
    && mkdir -p storage \
    && chown app:app storage
USER app

EXPOSE 8000

# Migrations and the demo contracts are both safe to apply on every start.
CMD ["sh", "-c", "alembic upgrade head && python -m backend.seed && exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips '*'"]
