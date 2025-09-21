// New simple resolve endpoint - test with Naruto

// Decode base64url encoded string to UTF-8
function decodeBase64Url(input: string): string {
  try {
    // Convert base64url to base64
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
    // Add padding if necessary
    const padded = base64 + '==='.slice((base64.length + 3) % 4)
    // Decode using Node.js Buffer (Node-safe alternative to browser's atob)
    return (globalThis as any).Buffer.from(padded, 'base64').toString('utf8')
  } catch (error) {
    console.warn('Failed to decode base64url:', error)
    return input
  }
}

// Video URL extraction patterns configuration
const VIDEO_URL_PATTERNS = [
  // M3U8 HLS streams
  {
    regex: /https:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*/gi,
    type: 'hls'
  },
  // MP4 direct links
  {
    regex: /https:\/\/[^\s"'<>]*\.mp4[^\s"'<>]*/gi,
    type: 'mp4'
  },
  // Other video formats
  {
    regex: /https:\/\/[^\s"'<>]*\.(?:webm|mkv|avi|mov)[^\s"'<>]*/gi,
    type: 'video'
  },
  // Quoted URLs (common in JavaScript)
  {
    regex: /["']https:\/\/[^"']*\.(?:m3u8|mp4|webm|mkv|avi|mov)[^"']*["']/gi,
    type: 'quoted'
  },
  // Video source attributes
  {
    regex: /src\s*=\s*["'](https:\/\/[^"']*\.(?:m3u8|mp4|webm|mkv|avi|mov)[^"']*)["']/gi,
    type: 'src'
  },
  // File URLs in JavaScript
  {
    regex: /file\s*:\s*["'](https:\/\/[^"']*\.(?:m3u8|mp4|webm|mkv|avi|mov)[^"']*)["']/gi,
    type: 'file'
  },
  // JavaScript variables containing URLs
  {
    regex: /(?:var|const|let)\s+\w+\s*=\s*["'](https:\/\/[^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
    type: 'javascript'
  }
] as const

// Security configuration
const EXTRACTION_CONFIG = {
  MAX_HTML_SIZE: 5 * 1024 * 1024, // 5MB limit
  PROCESSING_TIMEOUT: 5000, // 5 second timeout for extraction
  ALLOWED_PORTS: [80, 443, 8080, 8443] as number[],
  BLOCKED_HOSTS: ['localhost', '127.0.0.1', '0.0.0.0', '::1'] as string[],
  MAX_URLS_PER_TYPE: 10 // Limit URLs per type to prevent DoS
} as const

// Helper function to safely strip quotes from URLs
function stripQuotes(url: string): string {
  return url.replace(/^["']|["']$/g, '')
}

// Helper function to parse quality information from URL
function parseQuality(url: string): string | undefined {
  const qualityMatch = url.match(/(\d+p|\d+x\d+|hd|fhd|uhd|4k|8k)/i)
  return qualityMatch?.[1]?.toLowerCase()
}

// Helper function to validate and sanitize URLs
function validateUrl(candidate: string): { isValid: boolean; url?: string; error?: string } {
  try {
    const cleanUrl = stripQuotes(candidate.trim())
    
    if (!cleanUrl || cleanUrl.length > 2048) {
      return { isValid: false, error: 'URL too long or empty' }
    }

    const url = new URL(cleanUrl)
    
    // Enforce HTTPS only for security
    if (url.protocol !== 'https:') {
      return { isValid: false, error: 'Only HTTPS URLs allowed' }
    }

    // Check for blocked hosts
    if (EXTRACTION_CONFIG.BLOCKED_HOSTS.includes(url.hostname.toLowerCase())) {
      return { isValid: false, error: 'Blocked hostname' }
    }

    // Validate port if specified
    if (url.port && !EXTRACTION_CONFIG.ALLOWED_PORTS.includes(parseInt(url.port))) {
      return { isValid: false, error: 'Port not allowed' }
    }

    // Additional hostname validation (basic)
    if (!/^[a-zA-Z0-9.-]+$/.test(url.hostname)) {
      return { isValid: false, error: 'Invalid hostname characters' }
    }

    return { isValid: true, url: cleanUrl }
  } catch (error) {
    return { isValid: false, error: `Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

// Optimized single-pass URL extraction with early termination
function* iterateMatches(html: string, patterns: typeof VIDEO_URL_PATTERNS) {
  const urlCounts = new Map<string, number>()
  const startTime = Date.now()

  for (const pattern of patterns) {
    // Reset regex lastIndex to ensure fresh start
    pattern.regex.lastIndex = 0
    
    let match
    while ((match = pattern.regex.exec(html)) !== null) {
      // Check timeout to prevent hanging on large documents
      if (Date.now() - startTime > EXTRACTION_CONFIG.PROCESSING_TIMEOUT) {
        console.warn('⚠️ URL extraction timeout reached, stopping')
        return
      }

      // Limit URLs per type to prevent DoS
      const currentCount = urlCounts.get(pattern.type) || 0
      if (currentCount >= EXTRACTION_CONFIG.MAX_URLS_PER_TYPE) {
        console.warn(`⚠️ Max URLs reached for type ${pattern.type}, skipping`)
        break
      }

      const candidate = match[1] || match[0] // Use capture group if available
      const validation = validateUrl(candidate)
      
      if (validation.isValid && validation.url) {
        urlCounts.set(pattern.type, currentCount + 1)
        yield {
          type: pattern.type,
          url: validation.url,
          quality: parseQuality(validation.url)
        }
      } else {
        console.debug(`🚫 Rejected URL: ${candidate} (${validation.error})`)
      }
    }
  }
}

// Main extraction function with size limits and security checks
function extractVideoUrls(html: string): { type: string; url: string; quality?: string }[] {
  console.log('🔍 Starting secure URL extraction...')
  
  // Early size check to prevent processing huge documents
  if (html.length > EXTRACTION_CONFIG.MAX_HTML_SIZE) {
    console.warn(`⚠️ HTML too large (${html.length} bytes), truncating to ${EXTRACTION_CONFIG.MAX_HTML_SIZE} bytes`)
    html = html.substring(0, EXTRACTION_CONFIG.MAX_HTML_SIZE)
  }

  if (html.length === 0) {
    console.warn('⚠️ Empty HTML content')
    return []
  }

  const urls: { type: string; url: string; quality?: string }[] = []
  const uniqueUrls = new Set<string>()
  
  try {
    // Single-pass extraction with iterator for memory efficiency
    for (const urlData of iterateMatches(html, VIDEO_URL_PATTERNS)) {
      // Deduplicate URLs
      if (!uniqueUrls.has(urlData.url)) {
        uniqueUrls.add(urlData.url)
        urls.push(urlData)
        console.log(`✅ Found ${urlData.type} URL: ${urlData.url}${urlData.quality ? ` (${urlData.quality})` : ''}`)
      }
    }
  } catch (error) {
    console.error('❌ Error during URL extraction:', error)
    return []
  }
  
  console.log(`🔗 Extraction complete: ${urls.length} unique URLs found`)
  return urls
}

export default defineEventHandler(async (event) => {
  // Set CORS headers
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle preflight requests
  if (getMethod(event) === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }

  const query = getQuery(event)
  
  // Handle both url and u64 parameters
  let url = ''
  if (query.u64 && typeof query.u64 === 'string') {
    console.log('📝 Decoding u64 parameter:', query.u64)
    url = decodeBase64Url(query.u64)
    console.log('🔗 Decoded URL:', url)
  } else if (query.url && typeof query.url === 'string') {
    url = query.url
  }

  if (!url) {
    return { 
      ok: false, 
      urls: [], 
      message: 'Missing url or u64 parameter' 
    }
  }

  try {
    console.log('🔍 Resolving URL:', url)
    
    // Get optional referer parameter
    const referer = query.referer as string
    
    // Fetch the URL content
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    }
    
    // Add referer if provided
    if (referer) {
      console.log('📎 Using referer:', referer)
      headers['Referer'] = decodeURIComponent(referer)
    }
    
    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutMs = 15000 // 15 second timeout
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, timeoutMs)
    
    try {
      const response = await fetch(url, { 
        headers,
        signal: controller.signal
      })

      // Clear timeout on successful response
      clearTimeout(timeoutId)

      if (!response.ok) {
        console.error('❌ Fetch failed:', response.status, response.statusText)
        return {
          ok: false,
          urls: [],
          message: `Failed to fetch: ${response.status} ${response.statusText}`
        }
      }

      const html = await response.text()
      console.log('📄 Fetched HTML length:', html.length)
      console.log('📄 First 500 chars:', html.substring(0, 500))
      
      // Extract video URLs from HTML
      const extractedUrls = extractVideoUrls(html)
      console.log('🔗 Found URLs:', extractedUrls)
      
      // Remove duplicates and format for frontend
      const uniqueUrls = new Map<string, any>()
      for (const urlData of extractedUrls) {
        if (!uniqueUrls.has(urlData.url)) {
          uniqueUrls.set(urlData.url, {
            type: urlData.type === 'hls' ? 'hls' : urlData.type === 'mp4' ? 'mp4' : 'unknown',
            url: urlData.url,
            proxiedUrl: `/api/proxy?url=${encodeURIComponent(urlData.url)}&rewrite=1`,
            quality: urlData.quality
          })
        }
      }
      
      const finalUrls = Array.from(uniqueUrls.values())
      
      return {
        ok: true,
        urls: finalUrls,
        message: `Fetched ${html.length} bytes. Found ${finalUrls.length} unique video URLs.`
      }
      
    } catch (fetchError: any) {
      // Clear timeout on error
      clearTimeout(timeoutId)
      
      // Handle different types of errors
      if (fetchError.name === 'AbortError') {
        console.error(`❌ Fetch timed out after ${timeoutMs}ms for URL:`, url)
        return {
          ok: false,
          urls: [],
          message: `Request timed out after ${timeoutMs / 1000} seconds`
        }
      } else {
        console.error('❌ Fetch error:', fetchError.message)
        return {
          ok: false,
          urls: [],
          message: `Network error: ${fetchError.message}`
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ Resolve error:', error)
    return {
      ok: false,
      urls: [],
      message: `Error: ${error.message}`
    }
  }
})
