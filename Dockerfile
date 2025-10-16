# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.2.0
FROM node:${NODE_VERSION}-slim as base

# Installer pnpm et les outils nécessaires pour node-gyp
RUN npm install -g pnpm && \
    apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

ARG PORT=3000
ENV PORT=${PORT}
WORKDIR /app

# Copier les fichiers de dépendance
# Copy package.json and lockfile so install uses exact versions and optional deps build scripts run
COPY package.json pnpm-lock.yaml ./

# Install dependencies respecting the lockfile and allowing install scripts (needed for native bindings)
RUN pnpm install --frozen-lockfile
# Copier le reste du projet
COPY . .

# Build Nuxt pour server/export
RUN pnpm run build

EXPOSE 3000

# Lancer le serveur Nuxt
CMD ["pnpm", "run", "start"]
