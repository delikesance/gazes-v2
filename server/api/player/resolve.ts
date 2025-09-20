// Resolve direct media URL(s) from an external player page and return a proxied URL to avoid CORS.
// Usage: /api/player/resolve?url=<pageOrEmbedUrl>&referer=<optional>&ua=<optional>

type ResolvedMedia = {
  type: 'hls' | 'mp4' | 'dash' | 'unknown'
  url: string
  proxiedUrl: string
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const pageUrl = typeof query.url === 'string' ? query.url : ''
  if (!pageUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Missing url query parameter' })
  }

  let baseUrl: URL
  try {
    baseUrl = new URL(pageUrl)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Invalid url' })
  }
  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Only http/https URLs are allowed' })
  }

  const referer = typeof query.referer === 'string' ? query.referer : undefined
  const ua = typeof query.ua === 'string' ? query.ua : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

  const headers: Record<string, string> = {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  }
  if (referer) headers['Referer'] = referer

  const res = await fetch(baseUrl.toString(), { headers, redirect: 'follow' })
  if (!res.ok) {
    throw createError({ statusCode: res.status, statusMessage: res.statusText, message: 'Failed to fetch player page' })
  }
  const html = await res.text()

  // Try to extract direct media URLs via simple heuristics
  // 1) Look for video/source tags
  const urls = new Set<string>()
  for (const re of [
    /<source[^>]+src=["']([^"']+\.(?:m3u8|mp4|mpd)(?:\?[^"']*)?)["'][^>]*>/ig,
    /<video[^>]+src=["']([^"']+\.(?:m3u8|mp4|mpd)(?:\?[^"']*)?)["'][^>]*>/ig,
  ]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      try { urls.add(new URL(m[1], pageUrl).toString()) } catch {}
    }
  }

  // 2) Common JS config patterns: file:"...", src:"...", url:"..."
  for (const re of [
    /(?:file|src|url)\s*:\s*["']([^"']+\.(?:m3u8|mp4|mpd)(?:\?[^"']*)?)["']/ig,
  ]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      try { urls.add(new URL(m[1], pageUrl).toString()) } catch {}
    }
  }

  // 3) HLS playlists without extension (some sites)
  for (const re of [
    /https?:[^\s'"<>]+\.m3u8[^\s'"<>]*/ig,
  ]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      urls.add(m[0])
    }
  }

  // If nothing found and an iframe is present, follow it once
  if (urls.size === 0) {
    const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i)
    if (iframeMatch) {
      try {
        const iframeUrl = new URL(iframeMatch[1], baseUrl).toString()
        const ires = await fetch(iframeUrl, { headers, redirect: 'follow' })
        if (ires.ok) {
          const ih = await ires.text()
          let m: RegExpExecArray | null
          const re = /https?:[^\s'"<>]+\.(?:m3u8|mp4|mpd)[^\s'"<>]*/ig
          while ((m = re.exec(ih)) !== null) urls.add(m[0])
        }
      } catch {}
    }
  }

  if (urls.size === 0) {
    return { ok: false, urls: [], message: 'No media URL found' }
  }

  const results: ResolvedMedia[] = []
  for (const u of urls) {
    let type: ResolvedMedia['type'] = 'unknown'
    if (/\.m3u8($|\?)/i.test(u)) type = 'hls'
    else if (/\.(mp4)($|\?)/i.test(u)) type = 'mp4'
    else if (/\.mpd($|\?)/i.test(u)) type = 'dash'

    const params = new URLSearchParams({ url: u })
    if (referer) params.set('referer', referer)
    params.set('rewrite', '1') // enable playlist rewrite by default
    const proxiedUrl = `/api/proxy?${params.toString()}`

    results.push({ type, url: u, proxiedUrl })
  }

  // Prefer HLS first, then MP4
  results.sort((a, b) => {
    const order = (t: ResolvedMedia['type']) => t === 'hls' ? 0 : t === 'mp4' ? 1 : t === 'dash' ? 2 : 3
    return order(a.type) - order(b.type)
  })

  return { ok: true, urls: results }
})
