# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.2.0
FROM node:${NODE_VERSION}-slim as base

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

# Install dependencies with npm (handles native bindings better than pnpm in some cases)
RUN npm install
# Copier le reste du projet
COPY . .

# Build Nuxt pour server/export
RUN npm run build

EXPOSE 3000

# Lancer le serveur Nuxt
CMD ["npm", "run", "start"]
