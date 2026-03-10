# Pokemon Battle Simulator - Production Dockerfile
# Multi-stage build: Node for frontend + pokemon-showdown, Python for runtime

# Stage 1: Build React frontend
FROM node:20-slim AS frontend-builder
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
WORKDIR /app
COPY frontend/package*.json frontend/
WORKDIR /app/frontend
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build pokemon-showdown (git submodule)
FROM node:20-slim AS ps-builder
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . ./
# Render/CI often omit .git from build context; clone submodule manually if needed
ARG POKEMON_SHOWDOWN_COMMIT=7bd3faaeee2e18edee0b994230bffa8d466c6f20
RUN if [ -d .git ]; then \
      git submodule update --init --recursive; \
    else \
      rm -rf pokemon-showdown && \
      git clone https://github.com/cRz-Shadows/pokemon-showdown.git pokemon-showdown && \
      cd pokemon-showdown && git checkout ${POKEMON_SHOWDOWN_COMMIT} && cd ..; \
    fi
WORKDIR /app/pokemon-showdown
RUN npm install && node build

# Stage 3: Python runtime
FROM python:3.11-slim
WORKDIR /app

# Install Python deps
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy app code
COPY app.py ./
COPY src/ ./src/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy built pokemon-showdown
COPY --from=ps-builder /app/pokemon-showdown ./pokemon-showdown

# Copy Data (inputs, scripts, UsefulDatasets)
COPY Data/ ./Data/

# Ensure WorkerFiles exists (scripts write here)
RUN mkdir -p Data/WorkerFiles Data/Inputs Data/UsefulDatasets/dex-export

# Render and most PaaS set PORT
ENV PORT=5000
EXPOSE 5000

# Bind to 0.0.0.0 so external connections work
CMD gunicorn --bind 0.0.0.0:${PORT} --workers 1 --threads 4 --timeout 300 app:app
