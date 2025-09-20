// Resolve direct media URL(s) from an external player page and return a proxied URL to avoid CORS.
// Usage: /api/player/resolve?url=<pageOrEmbedUrl>&referer=<optional>&ua=<optional>

type ResolvedMedia = {
  type: 'hls' | 'mp4' | 'dash' | 'unknown'
  url: string
  proxiedUrl: string
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const debug = query.debug === '1' || query.debug === 'true'
  // Optional base64url input to avoid broken query parsing when callers forget to encode
  function b64urlDecodeToUtf8(input: string): string {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
    try {
      const padded = base64 + '==='.slice((base64.length + 3) % 4)
      if (typeof atob === 'function') {
        const bin = atob(padded)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        return new TextDecoder().decode(bytes)
      }
    } catch {}
    try {
      const B: any = (globalThis as any).Buffer
      if (B?.from) return B.from(base64, 'base64').toString('utf8')
    } catch {}
    return input
  }

  let pageUrl = ''
  if (typeof query.u64 === 'string' && query.u64) {
    pageUrl = b64urlDecodeToUtf8(query.u64)
  } else if (typeof query.url === 'string') {
    pageUrl = query.url
  }
  if (!pageUrl) throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Missing url query parameter' })

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
  const ua = typeof query.ua === 'string' ? query.ua : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

  // If the caller forgot to encode the full URL, merge stray top-level keys back into the target URL (similar to /api/proxy)
  const controlKeys = new Set(['url', 'u64', 'referer', 'ua'])
  for (const [k, v] of Object.entries(query)) {
    if (controlKeys.has(k)) continue
    if (typeof v !== 'string') continue
    if (!v.length) continue
    if (!baseUrl.searchParams.has(k)) baseUrl.searchParams.set(k, v)
  }

  const headers: Record<string, string> = {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  }
  headers['Referer'] = referer || `${baseUrl.origin}/`

  // Add a 15s timeout to avoid hanging connections
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  let res: Response
  try {
    if (debug) console.info(`[resolve] GET ${baseUrl.toString()} referer=${headers['Referer']} ua=${headers['User-Agent']}`)
    res = await fetch(baseUrl.toString(), { headers, redirect: 'follow', signal: ctrl.signal as any })
  } catch (e: any) {
    clearTimeout(t)
    const name = e?.name || ''
    const code = e?.code || ''
    const reason = /abort/i.test(name) ? 'request timed out' : code || (e?.message || 'network error')
    if (debug) console.warn(`[resolve] ERROR fetch ${baseUrl.toString()} -> ${reason}`)
    return { ok: false, urls: [], message: `Failed to fetch player page: ${reason}` }
  }
  clearTimeout(t)
  if (!res.ok) {
    if (debug) console.warn(`[resolve] HTTP ${res.status} ${res.statusText} for ${baseUrl.toString()}`)
    return { ok: false, urls: [], message: `Failed to fetch player page: ${res.status} ${res.statusText}` }
  }
  const html = await res.text()
  if (debug) console.info(`[resolve] Fetched OK (${html.length.toLocaleString()} bytes)`)
  const host = baseUrl.hostname.toLowerCase()
  const isVidmoly = /(^|\.)vidmoly\./i.test(host)

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

  // 2) Common JS config patterns: file:"...", src:"...", url:"...", source:"..."
  for (const re of [
    /(?:file|src|url|source)\s*:\s*["']([^"']+\.(?:m3u8|mp4|mpd)(?:\?[^"']*)?)["']/ig,
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
        if (debug) console.info(`[resolve] Following iframe -> ${iframeUrl}`)
        const ires = await fetch(iframeUrl, { headers, redirect: 'follow' })
        if (ires.ok) {
          const ih = await ires.text()
          let m: RegExpExecArray | null
          const re = /https?:[^\s'"<>]+\.(?:m3u8|mp4|mpd)[^\s'"<>]*/ig
          while ((m = re.exec(ih)) !== null) urls.add(m[0])
          if (debug) console.info(`[resolve] Iframe scan found ${urls.size} URLs`)
        }
      } catch {}
    }
  }

  // Vidmoly-specific deeper extraction
  if (urls.size === 0 && isVidmoly) {
    if (debug) console.info('[resolve] Vidmoly: attempting deeper extraction (base64/atob, external scripts)')
    const decodeB64 = (s: string) => {
      try {
        const base64 = s.replace(/-/g, '+').replace(/_/g, '/')
        const padded = base64 + '==='.slice((base64.length + 3) % 4)
        const B: any = (globalThis as any).Buffer
        if (B?.from) return B.from(padded, 'base64').toString('utf8')
      } catch {}
      return ''
    }
    const scanForUrls = (text: string) => {
      // generic URL scans
      let m: RegExpExecArray | null
      for (const re of [
        /https?:[^\s'"<>]+\.m3u8[^\s'"<>]*/ig,
        /https?:[^\s'"<>]+\.(?:mp4|mpd)[^\s'"<>]*/ig,
        /(?:file|src|url|source)\s*:\s*["']([^"']+\.(?:m3u8|mp4|mpd)(?:\?[^"']*)?)["']/ig,
      ]) {
        while ((m = re.exec(text)) !== null) {
          const raw = m[1] || m[0]
          try { urls.add(new URL(raw, pageUrl).toString()) } catch { urls.add(raw) }
        }
      }
      // jwplayer-like sources array
      try {
        const sb = text.match(/sources\s*:\s*\[([\s\S]*?)\]/i)
        if (sb) {
          const block = sb[1]
          let m2: RegExpExecArray | null
          const re2 = /file\s*:\s*["']([^"']+)["']/ig
          while ((m2 = re2.exec(block)) !== null) {
            const u = m2[1]
            try { urls.add(new URL(u, pageUrl).toString()) } catch { urls.add(u) }
          }
        }
      } catch {}
    }
    // 1) Decode atob payloads in the main HTML
    const a64s = Array.from(html.matchAll(/atob\(["']([A-Za-z0-9_\-\/=+]+)["']\)/g))
    for (const m of a64s) {
      const decoded = decodeB64(m[1])
      if (decoded) scanForUrls(decoded)
    }
    // 2) Follow nested iframes up to depth 2
    if (urls.size === 0) {
      const iframes = Array.from(html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/ig)).map(m => {
        try { return new URL(m[1], baseUrl).toString() } catch { return '' }
      }).filter(Boolean).slice(0, 2)
      for (const src of iframes) {
        try {
          if (debug) console.info(`[resolve] Vidmoly: nested iframe ${src}`)
          const r = await fetch(src, { headers, redirect: 'follow' })
          if (!r.ok) continue
          const t = await r.text()
          scanForUrls(t)
          const embeds = Array.from(t.matchAll(/src=["']([^"']+\.(?:m3u8|mp4|mpd)[^"']*)["']/ig))
          for (const em of embeds) { urls.add(em[1]) }
          if (urls.size > 0) break
        } catch {}
      }
    }
    // 3) Fetch up to 5 external scripts and scan
    if (urls.size === 0) {
      const scriptSrcs = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+)["']/ig)).map(m => {
        try { return new URL(m[1], baseUrl).toString() } catch { return '' }
      }).filter(Boolean)
      const unique = Array.from(new Set(scriptSrcs)).slice(0, 5)
      for (const src of unique) {
        try {
          if (debug) console.info(`[resolve] Vidmoly: fetching script ${src}`)
          const sres = await fetch(src, { headers, redirect: 'follow' })
          if (!sres.ok) continue
          const st = await sres.text()
          scanForUrls(st)
          const encs = Array.from(st.matchAll(/atob\(["']([A-Za-z0-9_\-\/=+]+)["']\)/g))
          for (const m of encs) {
            const decoded = decodeB64(m[1])
            if (decoded) scanForUrls(decoded)
          }
          if (urls.size > 0) break
        } catch {}
      }
    }

    // 4) Probe vidmoly dl?op= endpoints referenced by page/scripts
    if (urls.size === 0) {
      const dlCandidates = [
        ...Array.from(html.matchAll(/https?:[^\s'"<>]+\/dl\?[^\s'"<>]+/ig)).map(m => m[0])
      ]
      const uniqueDl = Array.from(new Set(dlCandidates)).filter(u => /vidmoly\./i.test(u)).slice(0, 3)
      for (const apiUrl of uniqueDl) {
        try {
          if (debug) console.info(`[resolve] Vidmoly: probing API ${apiUrl}`)
          const r = await fetch(apiUrl, { headers, redirect: 'follow' })
          if (!r.ok) continue
          const ct = r.headers.get('content-type') || ''
          const body = await r.text()
          // Try JSON parse first
          if (/json/i.test(ct) || /^[{\[]/.test(body.trim())) {
            try {
              const j = JSON.parse(body)
              const tryPick = (obj: any) => {
                if (!obj) return
                for (const k of ['file','src','source','url']) {
                  const v = (obj as any)[k]
                  if (typeof v === 'string' && /^https?:\/\//i.test(v) && /(m3u8|mp4|mpd)(?:$|\?)/i.test(v)) urls.add(v)
                }
              }
              if (Array.isArray(j)) j.forEach(tryPick)
              else if (typeof j === 'object') {
                tryPick(j)
                for (const v of Object.values(j)) if (v && typeof v === 'object') tryPick(v)
              }
            } catch {}
          }
          // Always scan raw body too (re-use local helper)
          scanForUrls(body)
          if (urls.size > 0) break
        } catch {}
      }
    }
  }

  if (urls.size === 0) {
    if (debug) console.info('[resolve] No media URL found')
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

  if (debug) console.info(`[resolve] Resolved ${results.length} URL(s). Types: ${results.map(r=>r.type).join(', ')}`)
  return { ok: true, urls: results }
})
