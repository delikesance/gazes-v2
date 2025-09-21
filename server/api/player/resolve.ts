// Resolve direct media URL(s) from an external player page and return a proxied URL to avoid CORS.
// Usage: /api/player/resolve?url=<pageOrEmbedUrl>&referer=<optional>&ua=<optional>

import { b64urlDecodeToUtf8, getMediaType, extractQuality, validateProxyUrl } from '~/server/utils/videoResolver'
import { ProviderFactory } from '~/server/utils/videoProviders'
import { videoCache, VideoCache } from '~/server/utils/videoCache'
import { fetchWithTimeout, probeApiEndpoints } from '~/server/utils/fetchUtils'
import { createLogger } from '~/server/utils/logger'

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
  const logger = createLogger('resolve', debug)

  // Parse input URL
  let pageUrl = ''
  if (typeof query.u64 === 'string' && query.u64) {
    pageUrl = b64urlDecodeToUtf8(query.u64, debug)
  } else if (typeof query.url === 'string' && query.url) {
    pageUrl = query.url
  } else {
    logger.warn('Missing url query parameter')
    return { ok: false, urls: [], message: 'Missing url query parameter' }
  }

  logger.info(`Request: u64=${typeof query.u64}, url=${pageUrl.substring(0, 50)}${pageUrl.length > 50 ? '...' : ''}, decoded=${pageUrl.substring(0, 50)}${pageUrl.length > 50 ? '...' : ''}`)

  // Check cache first
  const cacheKey = VideoCache.generateKey(pageUrl, { debug })
  const cached = videoCache.get(cacheKey)
  if (cached) {
    logger.info('Cache hit')
    return cached
  }

  try {
    const baseUrl = new URL(pageUrl)
    const host = baseUrl.hostname.toLowerCase()
    
    // Optional custom headers
    const referer = typeof query.referer === 'string' ? query.referer : `${baseUrl.protocol}//${baseUrl.hostname}/`
    const userAgent = typeof query.ua === 'string' ? query.ua : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

    logger.info(`GET ${pageUrl} referer=${referer} ua=${userAgent.substring(0, 50)}...`)

    const endTiming = logger.time('fetch page')
    
    // Fetch the player page with optimized fetch
    const fetchResult = await fetchWithTimeout(pageUrl, {
      timeout: 15000,
      retries: 1,
      headers: {
        'Referer': referer,
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      }
    })

    endTiming()

    if (!fetchResult.ok) {
      logger.error(`ERROR fetch ${pageUrl} -> ${fetchResult.error}`)
      return { ok: false, urls: [], message: `Failed to fetch player page: ${fetchResult.error}` }
    }

    const html = fetchResult.text
    logger.info(`Fetched OK (${html.length} bytes)`)
    logger.info(`Fetched ${html.length} bytes from ${host}`)

    const extractTiming = logger.time('URL extraction')
    
    // Use provider factory to get appropriate extractor
    const provider = ProviderFactory.getProvider(html, host)
    logger.info(`Using provider: ${provider.name}`)
    
    const urls = provider.extract(html, debug)

    // If no URLs found with primary extraction, try API probing
    if (urls.size === 0) {
      logger.info('No direct URLs found, trying API endpoints')
      
      const apiEndpoints = [
        `/api/source`,
        `/api/video`,
        `/source`,
        `/video`,
        `/api/embed/source`,
        `/embed/source`,
        `/api/player/source`,
      ]
      
      const apiUrls = await probeApiEndpoints(baseUrl, apiEndpoints, {
        timeout: 5000,
        headers: { 'Referer': referer, 'User-Agent': userAgent }
      })
      
      apiUrls.forEach(url => urls.add(url))
    }

    extractTiming()

    if (urls.size === 0) {
      logger.info('No media URL found')
      logger.always(`No URLs found for ${host} after all extraction methods`)
      const result = { ok: false, urls: [], message: 'No media URL found' }
      
      // Cache negative results for shorter time
      videoCache.set(cacheKey, result, 2 * 60 * 1000) // 2 minutes
      return result
    }

    // Process found URLs
    const results: ResolvedMedia[] = []
    for (const url of urls) {
      // Validate and sanitize URL before creating proxy URL
      const validation = validateProxyUrl(url)
      
      if (!validation.isValid) {
        logger.warn(`Skipping invalid URL: ${url} - ${validation.error}`)
        continue
      }
      
      const sanitizedUrl = validation.sanitizedUrl!
      const type = getMediaType(sanitizedUrl)
      const quality = extractQuality(sanitizedUrl)
      
      // Create proxied URL only after successful validation
      const proxiedUrl = `/api/proxy?url=${encodeURIComponent(sanitizedUrl)}&rewrite=1`
      
      results.push({
        type,
        url: sanitizedUrl,
        proxiedUrl,
        quality
      })
    }

    // Check if any valid URLs remain after validation
    if (results.length === 0) {
      const message = urls.size > 0 
        ? 'No valid URLs found after security validation' 
        : 'No media URL found'
      
      logger.info(message)
      logger.always(`No valid URLs found for ${host} after validation`)
      
      const result = { ok: false, urls: [], message }
      
      // Cache negative results for shorter time
      videoCache.set(cacheKey, result, 2 * 60 * 1000) // 2 minutes
      return result
    }

    const response = {
      ok: true,
      urls: results
    }

    // Cache successful results
    videoCache.set(cacheKey, response, 5 * 60 * 1000) // 5 minutes
    
    logger.info(`Resolved ${results.length} URL(s). Types: ${results.map(r => r.type).join(', ')}`)
    return response

  } catch (error: any) {
    logger.error(`Unexpected error: ${error.message}`)
    const errorResult = { ok: false, urls: [], message: error.message }
    
    // Cache errors for shorter time
    videoCache.set(cacheKey, errorResult, 30 * 1000) // 30 seconds
    return errorResult
  }
})