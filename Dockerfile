# Utilise l'image officielle Bun avec Node.js 20
FROM oven/bun:1.1.43 AS builder

WORKDIR /app

# Installe Python et configure pour better-sqlite3
RUN apt-get update && apt-get install -y python3 python3-dev && \
    rm -rf /var/lib/apt/lists/*

# Configure Python pour node-gyp
ENV PYTHON=/usr/bin/python3

# Copie les fichiers nécessaires
COPY package.json bun.lock ./
COPY . ./

# Installe les dépendances
RUN bun install

# Build Nuxt en mode serveur avec optimisation mémoire
RUN bun run build

# Étape finale pour exécuter l'app
FROM oven/bun:1.1.43 AS runner
WORKDIR /app

COPY --from=builder /app .

# Expose le port par défaut de Nuxt
EXPOSE 3000

CMD ["bun", "run", "start"]
