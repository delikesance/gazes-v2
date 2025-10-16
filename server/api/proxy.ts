// Streams remote media with Range support and optional HLS (.m3u8) playlist rewriting
// Usage: /api/proxy?url=<encodedRemoteUrl>&referer=<optional>&ua=<optional>&origin=<optional>&rewrite=1
// - If the target is an m3u8, we rewrite segment URIs and EXT-X-KEY URIs to go back through this proxy.

import { getVideoCache } from '~/server/utils/videoCache'

// Portable base64url decode without relying on Node typings
function b64urlDecodeToUtf8(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  // Try using atob if present
  try {
    // Pad base64 to length multiple of 4
    const padded = base64 + '==='.slice((base64.length + 3) % 4)
    if (typeof atob === 'function') {
      const bin = atob(padded)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return new TextDecoder().decode(bytes)
    }
  } catch {}
  // Fallback to Buffer if available at runtime (typed as any)
  try {
    const B: any = (globalThis as any).Buffer
    if (B?.from) {
      return B.from(base64, 'base64').toString('utf8')
    }
  } catch {}
  return input
}

export default defineEventHandler(async (event) => {
  // Handle CORS preflight if called cross-origin (harmless for same-origin)
  if (getMethod(event) === 'OPTIONS') {
    setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
    setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
    setResponseHeader(event, 'Access-Control-Allow-Headers', 'Range,Content-Type,Accept,Origin,Referer,User-Agent')
    setResponseStatus(event, 204)
    return ''
  }
  
  // Set CORS headers for all requests
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Expose-Headers', 'Content-Type,Content-Length,Accept-Ranges,Content-Range')
  setResponseHeader(event, 'Vary', 'Origin')
  
  const query = getQuery(event)
  // Support either `url` (URL-encoded) or `u64` (base64) to avoid breaking on '&' characters
  let rawUrl = ''
  if (typeof query.u64 === 'string' && query.u64) {
    const decoded = b64urlDecodeToUtf8(query.u64)
    if (!decoded) {
      setResponseStatus(event, 400)
      setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
      return JSON.stringify({ ok: false, message: 'Invalid base64 in u64' })
    }
    rawUrl = decoded
  } else if (typeof query.url === 'string') {
    rawUrl = query.url
  }
  if (!rawUrl) {
    setResponseStatus(event, 400)
    setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    return JSON.stringify({ ok: false, message: 'Missing url query parameter' })
  }

  // Validate target URL and restrict to http(s)
  let target: URL
  try {
    target = new URL(rawUrl)
  } catch (error) {
    console.warn('[proxy] Invalid URL:', rawUrl, error)
    setResponseStatus(event, 400)
    setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    return JSON.stringify({ ok: false, message: 'Invalid url' })
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    setResponseStatus(event, 400)
    setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    return JSON.stringify({ ok: false, message: 'Only http/https URLs are allowed' })
  }

  // If the caller forgot to encode the full URL, some query params may have been parsed as top-level keys.
  // Merge any extra top-level keys (that are not our control keys) back into the target URL.
  const controlKeys = new Set(['url', 'u64', 'referer', 'origin', 'ua', 'rewrite'])
  for (const [k, v] of Object.entries(query)) {
    if (controlKeys.has(k)) continue
    if (typeof v !== 'string') continue
    if (!v.length) continue
    if (!target.searchParams.has(k)) target.searchParams.set(k, v)
  }

  // Optional spoofed headers for hosts that require them
  let referer = typeof query.referer === 'string' ? query.referer : undefined
  const origin = typeof query.origin === 'string' ? query.origin : undefined
  const ua = typeof query.ua === 'string' ? query.ua : getHeader(event, 'user-agent') || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  const rewrite = query.rewrite !== '0'

  // Forward range requests for streaming
  const range = getHeader(event, 'range') || undefined

  // Build headers to forward
  const headers: Record<string, string> = {
    'User-Agent': ua,
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-Dest': 'empty'
  }
  if (!referer) referer = `${target.origin}/`
  if (referer) headers['Referer'] = referer
  if (origin) headers['Origin'] = origin
  if (range) headers['Range'] = range

  // Some CDNs require a sane Accept header for HLS
  if (/\.m3u8($|\?)/i.test(rawUrl)) {
    headers['Accept'] = 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*'
  }

  const controller = new AbortController()
  // Abort remote fetch if client disconnects (best-effort, only in Node)
  try {
    ;(event as any).node?.req?.on?.('close', () => controller.abort())
  } catch {}

  const videoCache = getVideoCache()
  const isM3U8 = /\.m3u8($|\?)/i.test(rawUrl)
  const isVideoContent = isM3U8 || /\.mp4($|\?)/i.test(rawUrl) || /\.webm($|\?)/i.test(rawUrl)

  // Check cache for video content (but not for range requests)
  if (isVideoContent && !range) {
    const cached = videoCache.get(rawUrl)
    if (cached) {
      setResponseHeader(event, 'Content-Type', cached.contentType)
      setResponseHeader(event, 'X-Cache-Status', 'HIT')
      setResponseStatus(event, 200)
      return cached.data
    }
  }

  let res: Response
  try {
    res = await fetch(target.toString(), { headers, redirect: 'follow', signal: controller.signal as any })
  } catch (error: any) {
    console.warn('[proxy] Fetch error for URL:', target.toString(), error)
    setResponseStatus(event, 502)
    setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    return JSON.stringify({ ok: false, message: `Failed to fetch: ${error?.message || 'Network error'}` })
  }


  // Always allow CORS for the proxied response
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Expose-Headers', 'Content-Type,Content-Length,Accept-Ranges,Content-Range')
  setResponseHeader(event, 'Vary', 'Origin')

  // Propagate useful headers
  const hopHeaders = ['Content-Type', 'Content-Length', 'Accept-Ranges', 'Content-Range', 'Cache-Control', 'Last-Modified', 'ETag']
  for (const h of hopHeaders) {
    const v = res.headers.get(h)
    if (v) setResponseHeader(event, h, v)
  }

  // Set status accordingly (200/206/3xx/4xx)
  setResponseStatus(event, res.status, res.statusText)

  // Clone the response to allow reading body multiple times if needed
  const resClone = res.clone()

  // If it's an HLS playlist and rewrite enabled, fetch as text and transform segment URIs
  const contentType = res.headers.get('Content-Type') || ''
  const isM3U8Response = /application\/(vnd\.apple\.mpegurl|x-mpegURL)|text\/plain.*\.m3u8/i.test(contentType) || /\.m3u8($|\?)/i.test(target.toString())


  // Check if we got HTML instead of media - this indicates the URL is not a valid media file
  if (!isM3U8Response && /text\/html|application\/xhtml\+xml/i.test(contentType)) {
    console.warn('[proxy] Received HTML response instead of media for URL:', target.toString(), 'Content-Type:', contentType)
    setResponseStatus(event, 502, 'Bad Gateway')
    setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    return JSON.stringify({ ok: false, message: 'Invalid media URL - received HTML instead of video content' })
  }

  if (isM3U8Response && rewrite && res.ok) {
    try {
      const playlist = await resClone.text()

      // Cache the original playlist content
      if (isVideoContent && !range) {
        videoCache.set(rawUrl, playlist, contentType)
        setResponseHeader(event, 'X-Cache-Status', 'MISS')
      }

      const base = target

      // Helper to build proxied URL preserving spoof headers
      const buildProxy = (u: string) => {
        try {
          const abs = new URL(u, base)
          const params = new URLSearchParams({ url: abs.toString() })
          if (referer) params.set('referer', referer)
          if (origin) params.set('origin', origin)
          if (ua) params.set('ua', ua)
          return `/api/proxy?${params.toString()}`
        } catch (error) {
          console.warn('[proxy] Failed to build proxy URL for:', u, error)
          return u
        }
      }

      const rewritten = playlist
        .split(/\r?\n/)
        .map((line) => {
          // Skip empty lines
          if (!line.trim()) return line

          if (line.startsWith('#')) {
            // Rewrite any URI="..." attribute in HLS tags (KEY, MAP, MEDIA, PART, PRELOAD-HINT, I-FRAME-STREAM-INF, SESSION-KEY, RENDITION-REPORT)
            return line.replace(/URI="([^"]+)"/ig, (_m, p1) => `URI="${buildProxy(p1)}"`)
          }
          // Non-comment lines are segment or playlist URIs
          return buildProxy(line)
        })
        .join('\n')

      // Update headers for the modified body
      setResponseHeader(event, 'Content-Type', 'application/vnd.apple.mpegurl')

      return rewritten
    } catch (error) {
      console.warn('[proxy] HLS rewrite failed:', error)
      // Fall back to streaming the original content
    }
  }

  // For non-HLS content, cache if it's video content and successful response
  if (isVideoContent && !range && res.ok && res.status === 200) {
    try {
      const contentLength = res.headers.get('Content-Length')
      const maxCacheSize = 50 * 1024 * 1024 // 50MB limit

      // Only cache if content length is known and reasonable
      if (contentLength && parseInt(contentLength) <= maxCacheSize) {
        const buffer = await res.arrayBuffer()
        videoCache.set(rawUrl, Buffer.from(buffer), contentType)
        setResponseHeader(event, 'X-Cache-Status', 'MISS')

        // Return the cached buffer
        return Buffer.from(buffer)
      } else {
        setResponseHeader(event, 'X-Cache-Status', 'SKIP')
      }
    } catch (error) {
      console.warn('[proxy] Failed to cache video content:', error)
      setResponseHeader(event, 'X-Cache-Status', 'ERROR')
    }
  } else if (isVideoContent) {
    setResponseHeader(event, 'X-Cache-Status', range ? 'SKIP-RANGE' : 'SKIP')
  }

  // Stream body as-is for all other content types
  const body = res.body as any
  // Note: sendStream is available from h3 runtime, but returning the Web/Node stream also works in Nitro
  return body
})
