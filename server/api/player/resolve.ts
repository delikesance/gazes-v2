// Resolve direct media URL(s) from an external player page and return a proxied URL to avoid CORS.
// Usage: /api/player/resolve?url=<pageOrEmbedUrl>&referer=<optional>&ua=<optional>

type ResolvedMedia = {
  type: 'hls' | 'mp4' | 'webm' | 'mkv' | 'dash' | 'unknown'
  url: string
  proxiedUrl: string
  quality?: string
}

export default defineEventHandler(async (event) => {
  // Set CORS headers early
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle preflight requests
  if (getMethod(event) === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }

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
    } catch (e) {
      if (debug) console.warn('[resolve] atob decode failed:', e)
    }
    try {
      const B: any = (globalThis as any).Buffer
      if (B?.from) return B.from(base64, 'base64').toString('utf8')
    } catch (e) {
      if (debug) console.warn('[resolve] Buffer decode failed:', e)
    }
    return input
  }

  let pageUrl = ''
  if (typeof query.u64 === 'string' && query.u64) {
    pageUrl = b64urlDecodeToUtf8(query.u64)
  } else if (typeof query.url === 'string') {
    pageUrl = query.url
  }
  
  // Always log the incoming request for debugging
  console.info(`[resolve] Request: u64=${query.u64}, url=${query.url}, decoded=${pageUrl}`)
  
  if (!pageUrl) {
    setResponseStatus(event, 400)
    return { ok: false, urls: [], message: 'Missing url query parameter' }
  }

  let baseUrl: URL
  try {
    baseUrl = new URL(pageUrl)
  } catch (error) {
    if (debug) console.warn('[resolve] Invalid URL:', pageUrl, error)
    setResponseStatus(event, 400)
    return { ok: false, urls: [], message: 'Invalid url' }
  }
  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    setResponseStatus(event, 400)
    return { ok: false, urls: [], message: 'Only http/https URLs are allowed' }
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
  
  // Always log basic info about the fetched content
  console.info(`[resolve] Fetched ${html.length} bytes from ${baseUrl.hostname}`)
  
  const host = baseUrl.hostname.toLowerCase()
  const isVidmoly = /(^|\.)vidmoly\./i.test(host)

  // Try to extract direct media URLs via comprehensive heuristics
  // 1) Look for video/source tags with various attributes
  const urls = new Set<string>()
  for (const re of [
    /<source[^>]+src=["']([^"']+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^"']*)?)["'][^>]*>/ig,
    /<video[^>]+src=["']([^"']+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^"']*)?)["'][^>]*>/ig,
    /<video[^>]*data-src=["']([^"']+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^"']*)?)["'][^>]*>/ig,
    /<source[^>]*data-src=["']([^"']+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^"']*)?)["'][^>]*>/ig,
  ]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      try { urls.add(new URL(m[1], pageUrl).toString()) } catch {}
    }
  }

  // 2) Common JS config patterns and variable assignments
  for (const re of [
    /(?:file|src|url|source|video|stream|link)\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^"']*)?)["']/ig,
    /(?:playlist|hlsUrl|videoUrl|streamUrl|mediaUrl)\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^"']*)?)["']/ig,
    /jwplayer\([^)]*\)\.setup\([^)]*file\s*:\s*["']([^"']+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^"']*)?)["']/ig,
    /videojs\([^)]*\)\.src\(\s*["']([^"']+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^"']*)?)["']/ig,
  ]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      try { urls.add(new URL(m[1], pageUrl).toString()) } catch {}
    }
  }

  // 3) Look for URLs in JSON-like structures
  for (const re of [
    /"(?:file|src|url|source|video|stream|link)"\s*:\s*"([^"]+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^"]*)?)"/ig,
    /"(?:playlist|hlsUrl|videoUrl|streamUrl|mediaUrl)"\s*:\s*"([^"]+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^"]*)?)"/ig,
  ]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      try { urls.add(new URL(m[1], pageUrl).toString()) } catch {}
    }
  }

  // 4) Direct URL patterns without quotes (for URLs embedded in JS)
  for (const re of [
    /https?:\/\/[^\s'"<>]+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^\s'"<>]*)?/ig,
  ]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      urls.add(m[0])
    }
  }

  // 5) Look for base64 encoded URLs that might contain video links
  const base64Matches = html.match(/atob\(["']([A-Za-z0-9+/=]+)["']\)/g)
  if (base64Matches) {
    for (const match of base64Matches) {
      try {
        const b64 = match.match(/["']([A-Za-z0-9+/=]+)["']/)?.[1]
        if (b64) {
          const decoded = atob(b64)
          // Look for video URLs in decoded content
          const videoUrlMatch = decoded.match(/https?:\/\/[^\s'"<>]+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^\s'"<>]*)?/i)
          if (videoUrlMatch) {
            urls.add(videoUrlMatch[0])
          }
        }
      } catch {}
    }
  }
  
  // 6) Mivalyo-specific patterns in raw HTML (before obfuscation processing)
  if (html.includes('mivalyo') || html.includes('vidhide')) {
    // Look for URLs in common CDN patterns used by mivalyo
    const mivalyoPatterns = [
      /https?:\/\/[^\s'"<>]*(?:\.ovaltinecdn\.|\.fghjkjhgfdsdfghjkl\.|\.mivalyo\.)[^\s'"<>]*\.(?:m3u8|mp4)/ig,
      /https?:\/\/[^\s'"<>]*\.(?:m3u8|mp4)\?[^\s'"<>]*(?:token|sig|expires)/ig,
      /"(\/[^"]*\.(?:m3u8|mp4)[^"]*)"[^}]*"1[ebc]"/ig, // Patterns like "1e", "1b", "1c" in source objects
    ]
    
    for (const pattern of mivalyoPatterns) {
      let m: RegExpExecArray | null
      while ((m = pattern.exec(html)) !== null) {
        const url = m[1] || m[0]
        try {
          urls.add(new URL(url, pageUrl).toString())
        } catch {
          if (/^https?:\/\//.test(url)) urls.add(url)
        }
      }
    }
  }

  // If nothing found yet, try additional extraction methods before checking host-specific logic
  if (urls.size === 0) {
    if (debug) console.info('[resolve] No direct URLs found, trying additional extraction methods')
    
    // Look for dynamically loaded content in script tags
    const scriptBlocks = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || []
    for (const script of scriptBlocks) {
      // Remove the script tags and scan content
      const content = script.replace(/<\/?script[^>]*>/gi, '')
      
      // Look for video URLs in the script content
      const scriptUrls = content.match(/https?:\/\/[^\s'"<>()]+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^\s'"<>()]*)?/gi)
      if (scriptUrls) {
        scriptUrls.forEach(url => urls.add(url))
      }
      
      // Look for JSON.parse or eval patterns that might contain URLs
      const jsonMatches = content.match(/JSON\.parse\(["']([^"']+)["']\)/g)
      if (jsonMatches) {
        for (const match of jsonMatches) {
          try {
            const jsonStr = match.match(/["']([^"']+)["']/)?.[1]
            if (jsonStr) {
              const parsed = JSON.parse(jsonStr.replace(/\\"/g, '"'))
              const extractFromObj = (obj: any) => {
                if (typeof obj === 'string' && /\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)/.test(obj)) {
                  try { urls.add(new URL(obj, pageUrl).toString()) } catch { urls.add(obj) }
                } else if (typeof obj === 'object' && obj) {
                  Object.values(obj).forEach(extractFromObj)
                }
              }
              extractFromObj(parsed)
            }
          } catch {}
        }
      }
    }
  }

  // Host-specific deeper extraction for common embed providers
  if (urls.size === 0) {
    const host = baseUrl.hostname.toLowerCase()
    const isVidmoly = /(^|\.)vidmoly\./i.test(host)
    const isStreamtape = /(^|\.)streamtape\./i.test(host)
    const isDoodstream = /(^|\.)doodstream\./i.test(host)
    const isUqload = /(^|\.)uqload\./i.test(host)
    const isStreamlare = /(^|\.)streamlare\./i.test(host)
    const isMivalyo = /(^|\.)mivalyo\./i.test(host) || html.includes('mivalyo') || html.includes('vidhide')
    
    console.info(`[resolve] Host analysis: ${host}, isVidmoly=${isVidmoly}, isMivalyo=${isMivalyo}`)
    
    if (debug) console.info(`[resolve] ${host}: attempting provider-specific extraction`)
    
    const decodeB64 = (s: string) => {
      try {
        const base64 = s.replace(/-/g, '+').replace(/_/g, '/')
        const padded = base64 + '==='.slice((base64.length + 3) % 4)
        const B: any = (globalThis as any).Buffer
        if (B?.from) return B.from(padded, 'base64').toString('utf8')
        return atob(padded)
      } catch {}
      return ''
    }
    
    // JavaScript deobfuscation function for packed code
    const deobfuscateJavaScript = (obfuscatedCode: string): string => {
      try {
        console.info('[resolve] Deobfuscating code snippet:', obfuscatedCode.substring(0, 100))
        
        // Multiple patterns to handle different obfuscation formats
        const patterns = [
          // Pattern 1: eval(function(p,a,c,k,e,d){...return p}('encoded',base,count,'keywords'.split('|')))
          /eval\(function\(p,a,c,k,e,d\)\{.*?return p\}.*?\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)[^)]*\)\)/s,
          // Pattern 2: eval(function(p,a,c,k,e,d){...}('encoded',base,count,'keywords'.split('|')))
          /eval\(function\(p,a,c,k,e,d\)\{[^}]+\}\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)\)\)/s,
          // Pattern 3: More flexible pattern
          /eval\(function\([^)]+\)\{[^}]+\}\([^)]*'([^']+)'[^)]*,(\d+),(\d+),[^)]*'([^']+)'\.split\([^)]+\)[^)]*\)\)/s,
          // Pattern 4: Even more flexible
          /eval\([^)]+\('([^']+)',(\d+),(\d+),'([^']+)'[^)]*\)/s
        ]
        
        for (let i = 0; i < patterns.length; i++) {
          const pattern = patterns[i]
          const match = obfuscatedCode.match(pattern)
          
          if (match) {
            console.info(`[resolve] Matched deobfuscation pattern ${i + 1}`)
            const [, p, a, c, k] = match
            const radix = parseInt(a)
            const count = parseInt(c)
            const keywords = k.split('|')
            
            console.info(`[resolve] Deobfuscation params: p=${p.length}chars, radix=${radix}, count=${count}, keywords=${keywords.length}`)
            return deobfuscateWithParams(p, radix, count, keywords)
          }
        }
        
        console.warn('[resolve] No matching eval pattern found in:', obfuscatedCode.substring(0, 200))
        return ''
      } catch (e) {
        console.warn('[resolve] JavaScript deobfuscation failed:', e)
        return ''
      }
    }
    
    const deobfuscateWithParams = (p: string, radix: number, count: number, keywords: string[]): string => {
      console.info(`[resolve] Deobfuscating: radix=${radix}, count=${count}, keywords=${keywords.length}`)
      console.info(`[resolve] Input string length: ${p.length}`)
      
      if (!p || radix < 2 || count < 1 || keywords.length === 0) {
        console.warn('[resolve] Invalid deobfuscation parameters')
        return ''
      }
      
      // Reconstruct the original code by replacing numbered placeholders with keywords
      let result = p
      let replacements = 0
      
      for (let i = count - 1; i >= 0; i--) {
        if (keywords[i]) {
          const placeholder = i.toString(radix)
          const regex = new RegExp('\\b' + placeholder + '\\b', 'g')
          const matches = (result.match(regex) || []).length
          if (matches > 0) {
            result = result.replace(regex, keywords[i])
            replacements += matches
          }
        }
      }
      
      console.info(`[resolve] Made ${replacements} replacements, result length: ${result.length}`)
      if (result.length < 1000) {
        console.info(`[resolve] Deobfuscated result:`, result.substring(0, 500))
      }
      return result
    }
    
    const scanForUrls = (text: string, context: string = '') => {
      if (debug && context) console.info(`[resolve] Scanning ${context}`)
      
      // Generic URL scans with expanded patterns
      let m: RegExpExecArray | null
      for (const re of [
        /https?:\/\/[^\s'"<>()]+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^\s'"<>()]*)?/ig,
        /(?:file|src|url|source|video|stream|link|playlist|hlsUrl|videoUrl|streamUrl|mediaUrl)\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^"']*)?)["']/ig,
        /"(?:file|src|url|source|video|stream|link|playlist|hlsUrl|videoUrl|streamUrl|mediaUrl)"\s*:\s*"([^"]+\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:\?[^"]*)?)"/ig,
      ]) {
        while ((m = re.exec(text)) !== null) {
          const raw = m[1] || m[0]
          try { urls.add(new URL(raw, pageUrl).toString()) } catch { 
            if (/^https?:\/\//.test(raw)) urls.add(raw)
          }
        }
      }
      
      // JWPlayer-like sources array
      try {
        const sourcesMatch = text.match(/sources\s*:\s*\[([\s\S]*?)\]/i)
        if (sourcesMatch) {
          const sourcesBlock = sourcesMatch[1]
          let m2: RegExpExecArray | null
          const re2 = /(?:file|src)\s*:\s*["']([^"']+)["']/ig
          while ((m2 = re2.exec(sourcesBlock)) !== null) {
            const u = m2[1]
            try { urls.add(new URL(u, pageUrl).toString()) } catch { 
              if (/^https?:\/\//.test(u)) urls.add(u)
            }
          }
        }
      } catch {}
      
      // Video.js source configurations
      try {
        const videoJsMatch = text.match(/videojs\([^)]*\)\.src\(\s*(\[[\s\S]*?\]|\{[\s\S]*?\})/i)
        if (videoJsMatch) {
          try {
            const srcConfig = JSON.parse(videoJsMatch[1])
            const extractVideoJsUrls = (obj: any) => {
              if (typeof obj === 'string' && /\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)/.test(obj)) {
                try { urls.add(new URL(obj, pageUrl).toString()) } catch { urls.add(obj) }
              } else if (Array.isArray(obj)) {
                obj.forEach(extractVideoJsUrls)
              } else if (typeof obj === 'object' && obj) {
                Object.values(obj).forEach(extractVideoJsUrls)
              }
            }
            extractVideoJsUrls(srcConfig)
          } catch {}
        }
      } catch {}
    }
    
    // Mivalyo-specific deobfuscation
    if (isMivalyo) {
      console.info('[resolve] Mivalyo: starting specialized extraction')
      if (debug) console.info('[resolve] Mivalyo: attempting deobfuscation')
      
      // Log some content samples for debugging
      console.info('[resolve] Mivalyo: HTML contains eval?', html.includes('eval'))
      console.info('[resolve] Mivalyo: HTML contains jwplayer?', html.includes('jwplayer'))
      console.info('[resolve] Mivalyo: HTML contains var o?', /var\s+o\s*=/.test(html))
      console.info('[resolve] Mivalyo: HTML contains sources?', html.includes('sources'))
      
      // Look for any video-like URLs first
      const anyVideoUrls = html.match(/https?:\/\/[^\s'"<>]*\.(?:m3u8|mp4|webm)[^\s'"<>]*/gi)
      if (anyVideoUrls) {
        console.info('[resolve] Mivalyo: found potential video URLs:', anyVideoUrls.length)
        anyVideoUrls.forEach(url => {
          urls.add(url)
          console.info('[resolve] Mivalyo: added video URL:', url)
        })
      } else {
        console.info('[resolve] Mivalyo: no obvious video URLs found in HTML')
      }
      
      // First, look for any obvious video URLs in the raw HTML
      const rawUrlPatterns = [
        /https?:\/\/[^\s'"<>]*(?:ovaltinecdn|stream|cdn)[^\s'"<>]*\.(?:m3u8|mp4)[^\s'"<>]*/ig,
        /"(https?:\/\/[^"]*\.(?:m3u8|mp4)[^"]*)"/ig,
        /'(https?:\/\/[^']*\.(?:m3u8|mp4)[^']*)'/ig,
      ]
      
      for (const pattern of rawUrlPatterns) {
        let m: RegExpExecArray | null
        while ((m = pattern.exec(html)) !== null) {
          const url = m[1] || m[0]
          urls.add(url)
          if (debug) console.info('[resolve] Mivalyo: found raw URL:', url)
        }
      }
      
      // Look for the obfuscated eval function
      const evalMatch = html.match(/eval\(function\(p,a,c,k,e,d\)\{[^}]+\}.*?\)\)/s)
      if (evalMatch) {
        console.info('[resolve] Mivalyo: found eval function, length:', evalMatch[0].length)
        try {
          const obfuscatedCode = evalMatch[0]
          if (debug) console.info('[resolve] Mivalyo: found obfuscated eval code, length:', obfuscatedCode.length)
          
          // Try to deobfuscate
          const deobfuscated = deobfuscateJavaScript(obfuscatedCode)
          if (deobfuscated) {
            console.info('[resolve] Mivalyo: deobfuscated successfully, length:', deobfuscated.length)
            if (debug) console.info('[resolve] Mivalyo: deobfuscated successfully, scanning for URLs')
            scanForUrls(deobfuscated, 'mivalyo deobfuscated')
            
            // Look specifically for the video source object in deobfuscated code
            const sourceObjPatterns = [
              /var\s+o\s*=\s*\{[^}]*(?:"1e"|"1b"|"1c"|hls4|hls3|hls2)[^}]*\}/gi,
              /sources\s*:\s*\[[^\]]*file\s*:[^\]]*\]/gi,
              /file\s*:\s*["']([^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
            ]
            
            for (const pattern of sourceObjPatterns) {
              let match: RegExpExecArray | null
              while ((match = pattern.exec(deobfuscated)) !== null) {
                console.info('[resolve] Mivalyo: found source pattern in deobfuscated code')
                if (debug) console.info('[resolve] Mivalyo: found source pattern:', match[0].substring(0, 100))
                scanForUrls(match[0], 'mivalyo source pattern')
                
                // Extract URLs from this specific match
                const urlMatches = match[0].match(/"(https?:\/\/[^"]*\.(?:m3u8|mp4)[^"]*)"/g)
                if (urlMatches) {
                  urlMatches.forEach(urlMatch => {
                    const cleanUrl = urlMatch.replace(/"/g, '')
                    urls.add(cleanUrl)
                    console.info('[resolve] Mivalyo: extracted URL from pattern:', cleanUrl)
                    if (debug) console.info('[resolve] Mivalyo: extracted URL:', cleanUrl)
                  })
                }
              }
            }
          } else {
            console.info('[resolve] Mivalyo: deobfuscation returned empty result')
            if (debug) console.warn('[resolve] Mivalyo: deobfuscation returned empty result')
          }
        } catch (e) {
          console.warn('[resolve] Mivalyo deobfuscation failed:', e)
          if (debug) console.warn('[resolve] Mivalyo deobfuscation failed:', e)
        }
      } else {
        console.info('[resolve] Mivalyo: no obfuscated eval function found')
        if (debug) console.info('[resolve] Mivalyo: no obfuscated eval function found')
        
        // If no eval found, try other JavaScript patterns
        const scriptPatterns = [
          /var\s+\w+\s*=\s*"[^"]*\.(?:m3u8|mp4)[^"]*"/gi,
          /['"]https?:\/\/[^'"]*\.(?:m3u8|mp4)[^'"]*['"]/gi,
          /source:\s*['"]([^'"]*\.(?:m3u8|mp4)[^'"]*)['"]/gi,
          /src:\s*['"]([^'"]*\.(?:m3u8|mp4)[^'"]*)['"]/gi,
          /file:\s*['"]([^'"]*\.(?:m3u8|mp4)[^'"]*)['"]/gi,
          /url:\s*['"]([^'"]*\.(?:m3u8|mp4)[^'"]*)['"]/gi,
        ]
        
        for (const pattern of scriptPatterns) {
          const matches = html.match(pattern)
          if (matches) {
            console.info(`[resolve] Mivalyo: found ${matches.length} potential URLs with fallback pattern`)
            matches.forEach(match => {
              const urlMatch = match.match(/https?:\/\/[^'"]*\.(?:m3u8|mp4)[^'"]*/)
              if (urlMatch) {
                urls.add(urlMatch[0])
                console.info('[resolve] Mivalyo: extracted URL from fallback pattern:', urlMatch[0])
              }
            })
          }
        }
        
        // Also try to find any script tags with potential URLs
        const scriptTags = html.match(/<script[^>]*>(.*?)<\/script>/gis)
        if (scriptTags) {
          console.info(`[resolve] Mivalyo: found ${scriptTags.length} script tags to analyze`)
          scriptTags.forEach((script, index) => {
            if (script.includes('.m3u8') || script.includes('.mp4')) {
              console.info(`[resolve] Mivalyo: script tag ${index} contains video references`)
              scanForUrls(script, `mivalyo script tag ${index}`)
            }
          })
        }
      }
      
      // Look for direct source object pattern in the original HTML (sometimes not obfuscated)
      const directSourcePatterns = [
        /var\s+o\s*=\s*\{[^}]*"1e"\s*:\s*"([^"]*)"[^}]*\}/gi,
        /var\s+o\s*=\s*\{[^}]*"1b"\s*:\s*"([^"]*)"[^}]*\}/gi,
        /var\s+o\s*=\s*\{[^}]*"1c"\s*:\s*"([^"]*)"[^}]*\}/gi,
        /["']1e["']\s*:\s*["']([^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
        /["']1b["']\s*:\s*["']([^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
        /["']1c["']\s*:\s*["']([^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
        /["']hls4["']\s*:\s*["']([^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
        /["']file["']\s*:\s*["']([^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
      ]
      
      for (const pattern of directSourcePatterns) {
        let match: RegExpExecArray | null
        while ((match = pattern.exec(html)) !== null) {
          let url = match[1]
          if (url && url.length > 5) { // Basic validation
            // Handle relative URLs that might start with /
            if (url.startsWith('/')) {
              url = `${baseUrl.origin}${url}`
            }
            // Handle URLs that might need .m3u8 extension
            if (!url.includes('.') && url.includes('/')) {
              // Could be a path-based URL, try adding .m3u8
              const testUrl = `${url}.m3u8`
              urls.add(testUrl)
              if (debug) console.info('[resolve] Mivalyo: added .m3u8 extension to:', testUrl)
            }
            
            try {
              const fullUrl = new URL(url, pageUrl).toString()
              urls.add(fullUrl)
              if (debug) console.info('[resolve] Mivalyo: extracted direct URL:', fullUrl)
            } catch {
              if (/^https?:\/\//.test(url)) {
                urls.add(url)
                if (debug) console.info('[resolve] Mivalyo: extracted absolute URL:', url)
              }
            }
          }
        }
      }
      
      // Look for jwplayer.setup configurations
      const jwPlayerMatch = html.match(/jwplayer\([^)]*\)\.setup\(\s*\{[^}]*sources?\s*:\s*\[[^\]]*\][^}]*\}/gi)
      if (jwPlayerMatch) {
        jwPlayerMatch.forEach(match => {
          if (debug) console.info('[resolve] Mivalyo: found jwplayer setup')
          scanForUrls(match, 'mivalyo jwplayer setup')
        })
      }
      
      // Additional mivalyo patterns based on common structures
      const additionalPatterns = [
        /playlist\s*:\s*["']([^"']*\.m3u8[^"']*)["']/gi,
        /videoUrl\s*:\s*["']([^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
        /streamUrl\s*:\s*["']([^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
      ]
      
      for (const pattern of additionalPatterns) {
        let match: RegExpExecArray | null
        while ((match = pattern.exec(html)) !== null) {
          const url = match[1]
          try {
            urls.add(new URL(url, pageUrl).toString())
            if (debug) console.info('[resolve] Mivalyo: extracted additional URL:', url)
          } catch {
            if (/^https?:\/\//.test(url)) urls.add(url)
          }
        }
      }
      
      if (debug) console.info(`[resolve] Mivalyo: total URLs found: ${urls.size}`)
    }
    // 1) Decode atob payloads in the main HTML
    const base64Matches = Array.from(html.matchAll(/atob\(["']([A-Za-z0-9_\-\/=+]+)["']\)/g))
    for (const m of base64Matches) {
      const decoded = decodeB64(m[1])
      if (decoded) scanForUrls(decoded, 'base64 payload')
    }
    
    // 2) Follow nested iframes and extract their content (but not display them)
    const iframes = Array.from(html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/ig)).map(m => {
      try { return new URL(m[1], baseUrl).toString() } catch { return '' }
    }).filter(Boolean).slice(0, 3) // Limit to 3 iframes
    
    for (const src of iframes) {
      try {
        if (debug) console.info(`[resolve] Extracting from nested iframe: ${src}`)
        const ctrl2 = new AbortController()
        const t2 = setTimeout(() => ctrl2.abort(), 8000)
        const r = await fetch(src, { headers, redirect: 'follow', signal: ctrl2.signal as any })
        clearTimeout(t2)
        if (!r.ok) continue
        const iframeContent = await r.text()
        scanForUrls(iframeContent, `iframe ${src}`)
        
        // Also scan for more base64 content in iframe
        const iframeBase64 = Array.from(iframeContent.matchAll(/atob\(["']([A-Za-z0-9_\-\/=+]+)["']\)/g))
        for (const m of iframeBase64) {
          const decoded = decodeB64(m[1])
          if (decoded) scanForUrls(decoded, 'iframe base64')
        }
        
        if (urls.size > 0) break
      } catch (e) {
        if (debug) console.warn(`[resolve] Iframe extraction failed:`, e)
      }
    }
    
    // 3) Fetch and scan external scripts (more comprehensive)
    if (urls.size === 0) {
      const scriptSrcs = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+)["']/ig)).map(m => {
        try { return new URL(m[1], baseUrl).toString() } catch { return '' }
      }).filter(Boolean)
      
      // Prioritize scripts that might contain video URLs
      const priorityScripts = scriptSrcs.filter(src => 
        /(?:player|video|stream|embed|jwplayer|videojs)/i.test(src)
      ).slice(0, 3)
      const otherScripts = scriptSrcs.filter(src => 
        !/(?:player|video|stream|embed|jwplayer|videojs)/i.test(src)
      ).slice(0, 2)
      
      const scriptsToCheck = [...priorityScripts, ...otherScripts]
      
      for (const src of scriptsToCheck) {
        try {
          if (debug) console.info(`[resolve] Fetching script: ${src}`)
          const ctrl3 = new AbortController()
          const t3 = setTimeout(() => ctrl3.abort(), 8000)
          const sres = await fetch(src, { headers, redirect: 'follow', signal: ctrl3.signal as any })
          clearTimeout(t3)
          if (!sres.ok) continue
          const scriptText = await sres.text()
          scanForUrls(scriptText, `script ${src}`)
          
          // Decode any base64 content in scripts
          const scriptBase64 = Array.from(scriptText.matchAll(/atob\(["']([A-Za-z0-9_\-\/=+]+)["']\)/g))
          for (const m of scriptBase64) {
            const decoded = decodeB64(m[1])
            if (decoded) scanForUrls(decoded, 'script base64')
          }
          
          if (urls.size > 0) break
        } catch (e) {
          if (debug) console.warn(`[resolve] Script fetch failed:`, e)
        }
      }
    }

    // 4) Probe common API endpoints for video URLs
    if (urls.size === 0) {
      const apiCandidates = [
        // Extract any existing API endpoints from page/scripts
        ...Array.from(html.matchAll(/https?:[^\s'"<>]+\/(?:dl|api|ajax|get|video|stream|embed)\?[^\s'"<>]+/ig)).map(m => m[0]),
        // Common API patterns for different providers
        ...(isVidmoly ? [`${baseUrl.origin}/dl?op=download_orig&id=${baseUrl.pathname.split('/').pop()}`] : []),
        ...(isStreamtape ? [`${baseUrl.origin}/get_video?id=${baseUrl.pathname.split('/').pop()}`] : []),
        ...(isDoodstream ? [`${baseUrl.origin}/pass_md5/${baseUrl.pathname.split('/').pop()}`] : []),
        ...(isUqload ? [`${baseUrl.origin}/api/embed/${baseUrl.pathname.split('/').pop()}`] : []),
      ]
      
      const uniqueApis = Array.from(new Set(apiCandidates)).filter(u => 
        new URL(u).hostname === baseUrl.hostname
      ).slice(0, 4)
      
      for (const apiUrl of uniqueApis) {
        try {
          if (debug) console.info(`[resolve] Probing API: ${apiUrl}`)
          const ctrl4 = new AbortController()
          const t4 = setTimeout(() => ctrl4.abort(), 8000)
          const r = await fetch(apiUrl, { headers, redirect: 'follow', signal: ctrl4.signal as any })
          clearTimeout(t4)
          if (!r.ok) continue
          
          const ct = r.headers.get('content-type') || ''
          const body = await r.text()
          
          // Try JSON parse first
          if (/json/i.test(ct) || /^[{\[]/.test(body.trim())) {
            try {
              const j = JSON.parse(body)
              const extractFromJson = (obj: any) => {
                if (typeof obj === 'string' && /\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:$|\?)/.test(obj)) {
                  try { urls.add(new URL(obj, apiUrl).toString()) } catch { 
                    if (/^https?:\/\//.test(obj)) urls.add(obj)
                  }
                } else if (Array.isArray(obj)) {
                  obj.forEach(extractFromJson)
                } else if (typeof obj === 'object' && obj) {
                  Object.values(obj).forEach(extractFromJson)
                }
              }
              extractFromJson(j)
            } catch {}
          }
          
          // Always scan raw body too
          scanForUrls(body, `API ${apiUrl}`)
          if (urls.size > 0) break
        } catch (e) {
          if (debug) console.warn(`[resolve] API probe failed:`, e)
        }
      }
    }
  }

  if (urls.size === 0) {
    if (debug) console.info('[resolve] No media URL found')
    console.info(`[resolve] No URLs found for ${baseUrl.hostname} after all extraction methods`)
    return { ok: false, urls: [], message: 'No media URL found' }
  }

  const results: ResolvedMedia[] = []
  for (const u of urls) {
    let type: ResolvedMedia['type'] = 'unknown'
    let quality: string | undefined
    
    // Determine format type
    if (/\.m3u8($|\?)/i.test(u)) type = 'hls'
    else if (/\.(mp4)($|\?)/i.test(u)) type = 'mp4'
    else if (/\.(webm)($|\?)/i.test(u)) type = 'webm'
    else if (/\.(mkv|avi|mov)($|\?)/i.test(u)) type = 'mkv'
    else if (/\.mpd($|\?)/i.test(u)) type = 'dash'
    
    // Try to extract quality information
    const qualityMatch = u.match(/(?:_|\b)(\d{3,4}p?)(?:_|\b)/i)
    if (qualityMatch) quality = qualityMatch[1]

    const params = new URLSearchParams({ url: u })
    if (referer) params.set('referer', referer)
    params.set('rewrite', '1') // enable playlist rewrite by default
    const proxiedUrl = `/api/proxy?${params.toString()}`

    results.push({ type, url: u, proxiedUrl, ...(quality ? { quality } : {}) })
  }

  // Prefer HLS first, then MP4, then WebM, then others
  results.sort((a, b) => {
    const order = (t: ResolvedMedia['type']) => 
      t === 'hls' ? 0 : t === 'mp4' ? 1 : t === 'webm' ? 2 : t === 'dash' ? 3 : t === 'mkv' ? 4 : 5
    const typeOrder = order(a.type) - order(b.type)
    if (typeOrder !== 0) return typeOrder
    
    // Within same type, prefer higher quality
    if (a.quality && b.quality) {
      const aRes = parseInt(a.quality.replace('p', ''))
      const bRes = parseInt(b.quality.replace('p', ''))
      return bRes - aRes // Higher resolution first
    }
    return 0
  })

  if (debug) console.info(`[resolve] Resolved ${results.length} URL(s). Types: ${results.map(r=>r.type).join(', ')}`)
  return { ok: true, urls: results }
})
