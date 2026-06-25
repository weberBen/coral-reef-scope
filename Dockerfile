# --- Stage 1: Install Python dependencies ---
FROM python:3.13-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# --- Stage 2: Runtime ---
FROM python:3.13-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 1000 coral

WORKDIR /app

COPY --from=deps /app/.venv /app/.venv
COPY coral_sim/ coral_sim/
COPY tools/ tools/
COPY docker/entrypoint.sh docker/entrypoint.sh

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV MUJOCO_LOG=/tmp/MUJOCO_LOG.TXT

RUN mkdir -p data cache && chown -R coral:coral data cache

USER coral

ENTRYPOINT ["docker/entrypoint.sh"]
