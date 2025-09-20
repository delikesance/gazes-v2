# gazes v2 — Clean monochrome redesign

This Nuxt 4 app was redesigned to a crisp, black-and-white interface with subtle purple accents. The homepage features a focused hero, fast search, and clean cards. Anime detail pages have consistent pills, tabs, and episode grids. A safe media proxy and resolver are included.

## What changed
- Global CSS extracted to `assets/css/theme.css` and loaded via `nuxt.config.ts`.
- New layout with `components/SiteHeader.vue`, unified header/footer.
- Minimalist homepage in `pages/index.vue` with search wired to `/api/search`.
- Detail page (`pages/anime/[id].vue`) styled to match the new theme.
- Robust `/api/proxy` and `/api/player/resolve` for streaming friendliness.

## Run locally
Use your preferred package manager.

```bash
# install deps
bun install

# start dev server
bun run dev
```

Dev server will print the URL (e.g. http://localhost:3000 or 3001 if 3000 is busy).

## Production
```bash
bun run build
bun run preview
```

## Notes
- Styling uses custom CSS variables and small utilities; Tailwind is installed and available.
- The proxy endpoint only serves media (m3u8/mp4) and will reject HTML pages.

## Tailwind CSS

This project includes Tailwind via `@nuxtjs/tailwindcss`.

- Entry CSS: `assets/css/tailwind.css` (contains `@tailwind base; @tailwind components; @tailwind utilities`)
- Custom theme: `assets/css/theme.css` (loaded after Tailwind for overrides)
- Config: `tailwind.config.ts` (maps our CSS variables to Tailwind colors)

Mapped colors you can use in classes:

- `bg-bg`, `bg-panel`, `border-border`
- `text-text`, `text-ink`, `text-muted`
- `bg-accent`, `text-accent`, `border-accent`, `bg-accent-600`

Examples:

```html
<div class="bg-panel text-ink border border-border rounded-xl p-4">
	<h2 class="text-lg font-semibold">Panel title</h2>
	<p class="text-muted">Muted description.</p>
	<button class="mt-3 inline-flex items-center gap-2 bg-accent hover:bg-accent-600 text-white font-semibold px-3 py-2 rounded-lg">
		Call to action
	</button>
	<a class="ml-3 text-accent underline">Link</a>
  
	<!-- Container helper from Tailwind config -->
	<div class="container mt-6">Centered content with padding</div>
  
	<!-- Utility spacing/typography works as usual -->
	<div class="mt-4 grid grid-cols-2 gap-4">
		<div class="h-12 bg-bg border border-border rounded" />
		<div class="h-12 bg-bg border border-border rounded" />
	</div>
```

Notes:

- Preflight is enabled by default. If you need to disable it, set `preflight: false` under `@nuxtjs/tailwindcss` module options or via PostCSS.
- If you generate class names dynamically, consider a Tailwind `safelist` in `tailwind.config.ts`.

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
