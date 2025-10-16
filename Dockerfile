# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.12.0
FROM node:${NODE_VERSION}-slim AS base

# Installer les outils nécessaires pour node-gyp (plus besoin de pnpm)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

ARG PORT=3000
ENV PORT=${PORT}
WORKDIR /app

# Copier package.json pour installer les dépendances avec npm
COPY package.json ./

# Install dependencies with npm - force reinstall to avoid native binding issues
# Add --ignore-engines temporarily since we're on the edge of version compatibility
RUN npm install --ignore-engines --force || (rm -rf node_modules package-lock.json && npm install --ignore-engines --force)
# Copier le reste du projet
COPY . .

# Build Nuxt pour server/export
RUN npm run build

EXPOSE 3000

# Lancer le serveur Nuxt
CMD ["npm", "run", "start"]
