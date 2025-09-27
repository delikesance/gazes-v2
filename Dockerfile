# Utilise l'image officielle Bun
FROM oven/bun:1.1.13 as builder

WORKDIR /app

# Copie les fichiers nécessaires
COPY package.json bun.lock ./
COPY . ./

# Installe les dépendances
RUN bun install --production

# Build Nuxt en mode serveur
RUN bun run build

# Étape finale pour exécuter l'app
FROM oven/bun:1.1.13 as runner
WORKDIR /app

COPY --from=builder /app .

# Expose le port par défaut de Nuxt
EXPOSE 3000

CMD ["bun", "run", "start"]
