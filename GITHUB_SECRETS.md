# Configuration des Variables d'Environnement pour GitHub Actions

Pour que votre application fonctionne correctement en production avec GitHub Actions et Docker, vous devez configurer les secrets suivants dans votre repository GitHub :

## Comment ajouter les secrets GitHub

1. Allez dans votre repository GitHub
2. Cliquez sur **Settings** (Paramètres)
3. Dans la sidebar, cliquez sur **Secrets and variables** > **Actions**
4. Cliquez sur **New repository secret**

## Secrets requis

### Variables d'authentification JWT
- `JWT_SECRET`: Clé secrète pour signer les tokens JWT (minimum 32 caractères)
- `JWT_REFRESH_SECRET`: Clé secrète pour les tokens de refresh (minimum 32 caractères)
- `JWT_EXPIRES_IN`: Durée d'expiration des tokens (ex: "7d")
- `JWT_REFRESH_EXPIRES_IN`: Durée d'expiration des refresh tokens (ex: "30d")

### Configuration Supabase
- `SUPABASE_URL`: URL de votre projet Supabase (ex: https://votre-projet.supabase.co)
- `SUPABASE_KEY`: Clé anonyme publique de Supabase

### Configuration API externe (optionnel)
- `SEARCH_API_URL`: URL de l'API de recherche (par défaut: https://179.43.149.218/template-php/defaut/fetch.php)
- `CATALOGUE_API_URL`: URL de l'API catalogue (par défaut: https://179.43.149.218)

## Test local avec Docker

Pour tester localement avec Docker, utilisez :

```bash
# Build avec les variables d'environnement
docker build \
  --build-arg SUPABASE_URL=votre-url \
  --build-arg SUPABASE_KEY=votre-key \
  --build-arg JWT_SECRET=votre-secret \
  --build-arg JWT_REFRESH_SECRET=votre-refresh-secret \
  -t gazes-v2 .

# Run avec les variables d'environnement
docker run -p 3000:3000 \
  -e SUPABASE_URL=votre-url \
  -e SUPABASE_KEY=votre-key \
  -e JWT_SECRET=votre-secret \
  -e JWT_REFRESH_SECRET=votre-refresh-secret \
  gazes-v2
```

## Génération de clés JWT sécurisées

Vous pouvez générer des clés sécurisées avec :

```bash
# Générer une clé de 64 caractères
openssl rand -hex 32

# Ou avec Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
