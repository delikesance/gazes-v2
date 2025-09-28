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
COPY package.json .

# Installer les dépendances avec scripts ignorés
RUN PNPM_IGNORE_SCRIPTS=true pnpm install
# Copier le reste du projet
COPY . .

# Build Nuxt pour server/export
RUN --mount=type=cache,target=/app/.nuxt pnpm run build

EXPOSE 3000

# Lancer le serveur Nuxt
CMD ["pnpm", "run", "start"]
