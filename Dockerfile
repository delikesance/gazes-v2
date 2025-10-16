# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.12.0
FROM node:${NODE_VERSION}-slim AS base

# Installer bun et les outils nécessaires pour les packages natifs
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    python3 \
    make \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Installer Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

ARG PORT=3000
ENV PORT=${PORT}

# Build args pour les variables d'environnement nécessaires au build
ARG SUPABASE_URL
ARG SUPABASE_KEY
ARG SEARCH_API_URL
ARG CATALOGUE_API_URL
ARG JWT_SECRET
ARG JWT_REFRESH_SECRET
ARG JWT_EXPIRES_IN=7d
ARG JWT_REFRESH_EXPIRES_IN=30d
ARG NODE_ENV=production

# Définir les variables d'environnement pour le build
ENV SUPABASE_URL=${SUPABASE_URL}
ENV SUPABASE_KEY=${SUPABASE_KEY}
ENV SEARCH_API_URL=${SEARCH_API_URL}
ENV CATALOGUE_API_URL=${CATALOGUE_API_URL}
ENV JWT_SECRET=${JWT_SECRET}
ENV JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
ENV JWT_EXPIRES_IN=${JWT_EXPIRES_IN}
ENV JWT_REFRESH_EXPIRES_IN=${JWT_REFRESH_EXPIRES_IN}
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

# Copier les fichiers de dépendances
COPY package.json bun.lockb* ./

# Installer les dépendances avec bun (inclut devDependencies par défaut)
RUN bun install --frozen-lockfile

# Copier le reste du projet
COPY . .

# Build Nuxt pour la production
RUN bun run build

EXPOSE 3000

# Lancer le serveur Nuxt
CMD ["bun", "run", "start"]
