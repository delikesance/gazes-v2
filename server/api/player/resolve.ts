// New simple resolve endpoint - test with Naruto
import { Buffer } from 'buffer'
import { getProviderInfo, getProviderReliability, sortUrlsByProviderReliability } from '~/server/utils/videoProviders'
import { Agent } from 'https'
import { getRedisCache, REDIS_CACHE_TTL } from '~/server/utils/redis-cache'

// Decode base64url encoded string to UTF-8
function decodeBase64Url(input: string): string {
  try {
    // Convert base64url to base64
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
    // Add padding if necessary
    const padded = base64 + '==='.slice((base64.length + 3) % 4)
    // Decode using Node.js Buffer (Node-safe alternative to browser's atob)
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch (error) {
    console.warn('Failed to decode base64url:', error)
    return input
  }
}

// Video URL extraction patterns configuration - optimized for performance
const VIDEO_URL_PATTERNS = [
  // High-priority patterns (most common)
  {
    regex: /https?:\/\/[^\s"'<>]*\.(?:m3u8|mp4)[^\s"'<>]*/gi,
    type: 'direct'
  },
  // Generic video URLs with common extensions
  {
    regex: /https?:\/\/[^\s"'<>]*\.(?:webm|mkv|avi|mov|flv)[^\s"'<>]*/gi,
    type: 'video'
  },
  // Quoted URLs (common in JavaScript)
  {
    regex: /["']https?:\/\/[^"']*\.(?:m3u8|mp4|webm|mkv|avi|mov|flv)[^"']*["']/gi,
    type: 'quoted'
  },
  // JavaScript variables
  {
    regex: /(?:var|const|let|window)\s+\w+\s*[:=]\s*["']https?:\/\/[^"']*\.(?:m3u8|mp4)[^"']*["']/gi,
    type: 'javascript'
  },
  // API endpoints
  {
    regex: /["']https?:\/\/[^"']*(?:api|source|video|stream|player|embed)[^"']*["']/gi,
    type: 'api'
  },
  // CDN patterns
  {
    regex: /["']https?:\/\/[^"']*\.(?:cdn|stream|video|media)\.[^"']*\.(?:mp4|m3u8)[^"']*["']/gi,
    type: 'cdn'
  },
  // VidMoly specific
  {
    regex: /["']https?:\/\/[^"']*vidmoly[^"']*\.(?:mp4|m3u8)[^"']*["']/gi,
    type: 'vidmoly'
  },
  // SibNet relative URLs
  {
    regex: /src\s*:\s*["'][^"']*\/v\/[^"']*\.mp4["']/gi,
    type: 'sibnet_relative'
  }
] as const

// Security configuration
const EXTRACTION_CONFIG = {
  MAX_HTML_SIZE: 2 * 1024 * 1024, // Reduce to 2MB limit for faster processing
  PROCESSING_TIMEOUT: 3000, // Reduce to 3 second timeout for faster extraction
  ALLOWED_PORTS: [80, 443, 8080, 8443] as number[],
  BLOCKED_HOSTS: ['localhost', '127.0.0.1', '0.0.0.0', '::1'] as string[],
  MAX_URLS_PER_TYPE: 5 // Reduce to 5 URLs per type for faster processing
} as const

// Connection pooling for video provider requests
const videoProviderAgent = new Agent({
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 5000
})

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

// Optimized single-pass URL extraction with early termination and streaming
async function* iterateMatches(html: string, patterns: typeof VIDEO_URL_PATTERNS) {
  const urlCounts = new Map<string, number>()
  const startTime = Date.now()
  let totalUrlsFound = 0
  const MAX_TOTAL_URLS = 15 // Early termination after finding enough URLs

  // Process HTML in chunks to reduce memory pressure
  const chunks = html.match(/.{1,8192}/g) || [html] // 8KB chunks

  for (const chunk of chunks) {
    // Check timeout to prevent hanging on large documents
    if (Date.now() - startTime > EXTRACTION_CONFIG.PROCESSING_TIMEOUT) {
      console.warn('⚠️ URL extraction timeout reached, stopping')
      return
    }

    // Early termination if we have enough URLs
    if (totalUrlsFound >= MAX_TOTAL_URLS) {
      return
    }

    for (const pattern of patterns) {
      // Reset regex lastIndex to ensure fresh start for each chunk
      pattern.regex.lastIndex = 0

      let match
      while ((match = pattern.regex.exec(chunk)) !== null) {
        // Limit URLs per type to prevent DoS
        const currentCount = urlCounts.get(pattern.type) || 0
        if (currentCount >= EXTRACTION_CONFIG.MAX_URLS_PER_TYPE) {
          console.warn(`⚠️ Max URLs reached for type ${pattern.type}, skipping`)
          break
        }

        const candidate = match[1] || match[0] // Use capture group if available

        // Convert relative URLs to absolute URLs for specific providers
        let processedCandidate = candidate
        if (pattern.type === 'sibnet_relative' && !candidate.startsWith('http')) {
          // Convert SibNet relative URLs to absolute
          processedCandidate = `https://video.sibnet.ru${candidate.startsWith('/') ? '' : '/'}${candidate}`
        }

        const validation = validateUrl(processedCandidate)

        if (validation.isValid && validation.url) {
          urlCounts.set(pattern.type, currentCount + 1)
          totalUrlsFound++
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

    // Allow event loop to process other operations between chunks
    if (chunks.length > 1) {
      await new Promise(resolve => setImmediate(resolve))
    }
  }
}

// Special VidMoly JavaScript analysis function
function analyzeVidMolyJavaScript(html: string): { type: string; url: string; quality?: string }[] {
  const urls: { type: string; url: string; quality?: string }[] = []

  // VidMoly often uses obfuscated JavaScript with encoded URLs
  // Look for common patterns in their obfuscated code

  // Pattern 1: Base64-like encoded strings that might contain URLs
  const base64Pattern = /[A-Za-z0-9+/=]{20,}/g
  let match
  while ((match = base64Pattern.exec(html)) !== null) {
    try {
      // Try to decode as base64 and see if it contains video URLs
      const decoded = Buffer.from(match[0], 'base64').toString('utf8')
      if (decoded.includes('.m3u8') || decoded.includes('.mp4')) {
        // Extract URLs from decoded content
        const urlMatch = decoded.match(/https?:\/\/[^\s"'<>]+\.(?:m3u8|mp4)[^\s"'<>]*/gi)
        if (urlMatch) {
          urlMatch.forEach(url => {
            if (validateUrl(url).isValid) {
              urls.push({
                type: 'vidmoly_decoded',
                url: url,
                quality: parseQuality(url)
              })
            }
          })
        }
      }
    } catch (e) {
      // Ignore decoding errors
    }
  }

  // Pattern 2: Look for JavaScript variables that might contain video URLs
  const jsVarPatterns = [
    /videoUrl\s*[:=]\s*["']([^"']+)["']/gi,
    /streamUrl\s*[:=]\s*["']([^"']+)["']/gi,
    /file\s*[:=]\s*["']([^"']+)["']/gi,
    /src\s*[:=]\s*["']([^"']+)["']/gi
  ]

  jsVarPatterns.forEach(pattern => {
    pattern.lastIndex = 0
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1]
      if ((url.includes('.m3u8') || url.includes('.mp4')) && validateUrl(url).isValid) {
        urls.push({
          type: 'vidmoly_js_var',
          url: url,
          quality: parseQuality(url)
        })
      }
    }
  })

  // Pattern 3: Look for function calls that might load videos
  const functionPatterns = [
    /loadVideo\s*\(\s*["']([^"']+)["']\s*\)/gi,
    /playVideo\s*\(\s*["']([^"']+)["']\s*\)/gi,
    /setVideo\s*\(\s*["']([^"']+)["']\s*\)/gi
  ]

  functionPatterns.forEach(pattern => {
    pattern.lastIndex = 0
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1]
      if ((url.includes('.m3u8') || url.includes('.mp4')) && validateUrl(url).isValid) {
        urls.push({
          type: 'vidmoly_function',
          url: url,
          quality: parseQuality(url)
        })
      }
    }
  })

  return urls
}

// Optimized URL extraction with early termination
async function extractVideoUrls(html: string): Promise<{ type: string; url: string; quality?: string }[]> {
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
  const startTime = Date.now()
  let totalUrlsFound = 0
  const MAX_TOTAL_URLS = 10 // Limit total URLs for performance

  try {
    // Special handling for VidMoly - analyze JavaScript first
    if (html.includes('vidmoly') || html.includes('VidMoly')) {
      console.log('🎯 VidMoly detected, applying special JavaScript analysis...')
      const vidmolyUrls = analyzeVidMolyJavaScript(html)
      vidmolyUrls.forEach(urlData => {
        if (!uniqueUrls.has(urlData.url)) {
          uniqueUrls.add(urlData.url)
          urls.push(urlData)
          totalUrlsFound++
          console.log(`✅ VidMoly URL found: ${urlData.url}`)
        }
      })
    }

    // Process patterns efficiently
    for (const pattern of VIDEO_URL_PATTERNS) {
      if (Date.now() - startTime > EXTRACTION_CONFIG.PROCESSING_TIMEOUT) {
        console.warn('⚠️ URL extraction timeout reached, stopping')
        break
      }

      if (totalUrlsFound >= MAX_TOTAL_URLS) {
        break
      }

      pattern.regex.lastIndex = 0
      let match
      let patternUrlsFound = 0
      const MAX_PER_PATTERN = 3 // Limit URLs per pattern

      while ((match = pattern.regex.exec(html)) !== null && patternUrlsFound < MAX_PER_PATTERN) {
        const candidate = match[1] || match[0]

        // Convert relative URLs to absolute URLs for specific providers
        let processedCandidate = candidate
        if (pattern.type === 'sibnet_relative' && !candidate.startsWith('http')) {
          processedCandidate = `https://video.sibnet.ru${candidate.startsWith('/') ? '' : '/'}${candidate}`
        }

        const validation = validateUrl(processedCandidate)

        if (validation.isValid && validation.url && !uniqueUrls.has(validation.url)) {
          uniqueUrls.add(validation.url)
          urls.push({
            type: pattern.type,
            url: validation.url,
            quality: parseQuality(validation.url)
          })
          totalUrlsFound++
          patternUrlsFound++
        }

        if (totalUrlsFound >= MAX_TOTAL_URLS) {
          break
        }
      }
    }
  } catch (error) {
    console.error('❌ Error during URL extraction:', error)
    return []
  }

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
    url = decodeBase64Url(query.u64)
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
    
    // Get optional referer parameter
    const referer = query.referer as string
    
    // Create cache key based on URL and referer
    const cacheKey = `resolve:${Buffer.from(url + (referer || '')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
    
    // Check cache first
    const cache = getRedisCache()
    const cachedResult = await cache.get(cacheKey)
    if (cachedResult) {
      console.log('✅ Cache hit for resolve:', url)
      return cachedResult
    }
    
    // Cache miss - perform resolution
    const resolutionResult = await performResolution(url, referer, query)
    
    // Cache successful results for 10 minutes
    if (resolutionResult.ok && resolutionResult.urls.length > 0) {
      await cache.set(cacheKey, resolutionResult, REDIS_CACHE_TTL.GENERAL)
    }
    
    return resolutionResult
    
  } catch (error: any) {
    console.error('❌ Resolve error:', error)
    return {
      ok: false,
      urls: [],
      message: `Error: ${error.message}`
    }
  }
})

// Separate function for the actual resolution logic
async function performResolution(url: string, referer: string, query: any) {
    // Fetch the URL content
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    }
    
    // Add referer if provided
    if (referer) {
      headers['Referer'] = decodeURIComponent(referer)
    }
    
    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutMs = 3000 // Reduced to 3 seconds for faster failure recovery
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, timeoutMs)
    
    try {
      // Use Node.js fetch with connection pooling for better performance
      const fetchOptions: any = { 
        headers,
        signal: controller.signal
      }
      
      // Add agent for Node.js environment (server-side)
      if (typeof globalThis !== 'undefined' && globalThis.process) {
        fetchOptions.agent = videoProviderAgent
      }
      
      const response = await fetch(url, fetchOptions)

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
      
      // Extract video URLs from HTML
      const extractedUrls = await extractVideoUrls(html)
      
      // Remove duplicates and format for frontend
      const uniqueUrls = new Map<string, any>()
      for (const urlData of extractedUrls) {
        if (!uniqueUrls.has(urlData.url)) {
          const providerInfo = getProviderInfo(urlData.url)
          uniqueUrls.set(urlData.url, {
            type: urlData.type === 'hls' ? 'hls' : urlData.type === 'mp4' ? 'mp4' : 'unknown',
            url: urlData.url,
            directUrl: urlData.url, // Direct URL for CORS-compatible sources
            proxiedUrl: `/api/proxy?url=${encodeURIComponent(urlData.url)}&referer=${encodeURIComponent(url)}&origin=${encodeURIComponent(new URL(url).origin)}&rewrite=1`,
            quality: urlData.quality,
            provider: providerInfo ? {
              hostname: providerInfo.hostname,
              reliability: providerInfo.reliability,
              description: providerInfo.description
            } : null
          })
        }
      }
      
      // Sort URLs by provider reliability (best first)
      const finalUrls = Array.from(uniqueUrls.values()).sort((a, b) => {
        const reliabilityA = a.provider?.reliability || 0
        const reliabilityB = b.provider?.reliability || 0
        return reliabilityB - reliabilityA
      })
      
      // Log provider information for debugging
      finalUrls.forEach((urlData, index) => {
        const provider = urlData.provider
        if (provider) {
        } else {
        }
      })
      
      return {
        ok: true,
        urls: finalUrls,
        message: `Fetched ${html.length} bytes. Found ${finalUrls.length} unique video URLs, sorted by provider reliability.`
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
}