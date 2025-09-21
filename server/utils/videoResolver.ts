// Video resolver utility functions

/**
 * Decode base64url encoded string to UTF-8
 */
export function b64urlDecodeToUtf8(input: string, debug = false): string {
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

/**
 * Deobfuscate packed JavaScript code
 */
export function deobfuscateJavaScript(obfuscatedCode: string, debug = false): string {
  try {
    if (debug) console.info('[resolve] Deobfuscating code snippet:', obfuscatedCode.substring(0, 100))
    
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
        if (debug) console.info(`[resolve] Matched deobfuscation pattern ${i + 1}`)
        const [, p, a, c, k] = match
        const radix = parseInt(a)
        const count = parseInt(c)
        const keywords = k.split('|')
        
        if (debug) console.info(`[resolve] Deobfuscation params: p=${p.length}chars, radix=${radix}, count=${count}, keywords=${keywords.length}`)
        return deobfuscateWithParams(p, radix, count, keywords, debug)
      }
    }
    
    if (debug) console.warn('[resolve] No matching eval pattern found in:', obfuscatedCode.substring(0, 200))
    return ''
  } catch (e) {
    if (debug) console.warn('[resolve] JavaScript deobfuscation failed:', e)
    return ''
  }
}

/**
 * Deobfuscate with specific parameters
 */
function deobfuscateWithParams(p: string, radix: number, count: number, keywords: string[], debug = false): string {
  if (debug) console.info(`[resolve] Deobfuscating: radix=${radix}, count=${count}, keywords=${keywords.length}`)
  if (debug) console.info(`[resolve] Input string length: ${p.length}`)
  
  if (!p || radix < 2 || count < 1 || keywords.length === 0) {
    if (debug) console.warn('[resolve] Invalid deobfuscation parameters')
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
  
  if (debug) console.info(`[resolve] Made ${replacements} replacements, result length: ${result.length}`)
  if (debug && result.length < 1000) {
    console.info(`[resolve] Deobfuscated result:`, result.substring(0, 500))
  }
  return result
}

/**
 * Optimized URL scanning function
 */
export function scanForUrls(text: string, context = '', debug = false): Set<string> {
  const urls = new Set<string>()
  
  if (debug && context) console.info(`[resolve] Scanning ${context}`)
  
  // Consolidated URL patterns for better performance
  const urlPatterns = [
    // HLS streams
    /https?:\/\/[^\s'"<>]*\.m3u8[^\s'"<>]*/gi,
    // MP4 videos
    /https?:\/\/[^\s'"<>]*\.mp4[^\s'"<>]*/gi,
    // Other video formats
    /https?:\/\/[^\s'"<>]*\.(?:webm|mkv|avi|mov|mpd)[^\s'"<>]*/gi,
    // Quoted URLs
    /["']https?:\/\/[^"']*\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)[^"']*["']/gi,
    // CDN patterns
    /https?:\/\/[^\s'"<>]*(?:cdn|stream|video)[^\s'"<>]*\.(?:m3u8|mp4)[^\s'"<>]*/gi
  ]
  
  for (const pattern of urlPatterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      let url = match[0]
      // Clean quotes if present
      if (url.startsWith('"') || url.startsWith("'")) {
        url = url.slice(1, -1)
      }
      
      if (url && /^https?:\/\//.test(url)) {
        urls.add(url)
        if (debug) console.info(`[resolve] Found URL in ${context}:`, url)
      }
    }
  }
  
  return urls
}

/**
 * Determine media type from URL
 */
export function getMediaType(url: string): ResolvedMedia['type'] {
  if (/\.m3u8($|\?)/i.test(url)) return 'hls'
  if (/\.mp4($|\?)/i.test(url)) return 'mp4'
  if (/\.webm($|\?)/i.test(url)) return 'webm'
  if (/\.(?:mkv|avi|mov)($|\?)/i.test(url)) return 'mkv'
  if (/\.mpd($|\?)/i.test(url)) return 'dash'
  return 'unknown'
}

/**
 * Extract quality indicator from URL
 */
export function extractQuality(url: string): string | undefined {
  const qualityMatch = url.match(/(\d+p|\d+x\d+|hd|fhd|uhd|4k|8k)/i)
  return qualityMatch?.[1]?.toLowerCase()
}

/**
 * Validate and sanitize URL for proxy usage
 */
export function validateProxyUrl(url: string): { isValid: boolean; sanitizedUrl?: string; error?: string } {
  try {
    const parsedUrl = new URL(url)
    
    // Validate scheme - only allow http and https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        isValid: false,
        error: `Invalid scheme: ${parsedUrl.protocol}. Only http and https are allowed.`
      }
    }
    
    // Validate hostname - ensure it's not empty and not localhost/internal
    if (!parsedUrl.hostname) {
      return {
        isValid: false,
        error: 'Missing hostname in URL'
      }
    }
    
    // Block internal/private networks for security
    const hostname = parsedUrl.hostname.toLowerCase()
    const blockedPatterns = [
      'localhost',
      '127.0.0.1',
      '::1',
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^169\.254\./, // Link-local
      /^224\./, // Multicast
      /^\[::1\]$/, // IPv6 localhost
      /^\[fe80::/i, // IPv6 link-local
    ]
    
    for (const pattern of blockedPatterns) {
      if (typeof pattern === 'string' ? hostname === pattern : pattern.test(hostname)) {
        return {
          isValid: false,
          error: `Blocked hostname: ${parsedUrl.hostname}`
        }
      }
    }
    
    // Additional security checks
    if (parsedUrl.username || parsedUrl.password) {
      return {
        isValid: false,
        error: 'URLs with embedded credentials are not allowed'
      }
    }
    
    return {
      isValid: true,
      sanitizedUrl: parsedUrl.toString()
    }
    
  } catch (error) {
    return {
      isValid: false,
      error: `Malformed URL: ${error instanceof Error ? error.message : 'Invalid URL format'}`
    }
  }
}

type ResolvedMedia = {
  type: 'hls' | 'mp4' | 'webm' | 'mkv' | 'dash' | 'unknown'
  url: string
  proxiedUrl: string
  quality?: string
}