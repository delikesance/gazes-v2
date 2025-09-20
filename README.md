# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Media proxy endpoints

Two server endpoints support playing third‑party media without CORS issues:

- GET `/api/player/resolve?url=<pageOrEmbedUrl>&referer=<optional>&ua=<optional>`
	- Scrapes the external player page and attempts to extract direct media URLs (m3u8/mp4/mpd).
	- Returns a list of candidates and includes a `proxiedUrl` for each that routes through our proxy.

- GET `/api/proxy?url=<encodedMediaUrl>&referer=<optional>&origin=<optional>&ua=<optional>&rewrite=1`
	- Streams remote media with Range support and sets permissive CORS headers.
	- If the target is an HLS playlist (.m3u8) and `rewrite=1` (default), the playlist is rewritten so all segments and keys are also proxied.

Notes:
- Some hosts require a specific Referer/Origin/User‑Agent; pass them via query to be forwarded.
- Only http/https URLs are allowed; other schemes are rejected.
- For HLS, prefer the `proxiedUrl` returned by `/api/player/resolve` to ensure proper rewriting.

Example flow:
1. Call `/api/player/resolve?url=https%3A%2F%2Fexample.com%2Fembed%2F123`.
2. Pick the first result (usually HLS) and use its `proxiedUrl` as the `src` in your player.
