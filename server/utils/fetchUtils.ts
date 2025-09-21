// Optimized fetch utilities with better error handling and timeouts

export interface FetchOptions {
  timeout?: number
  retries?: number
  headers?: Record<string, string>
  signal?: AbortSignal
}

export interface FetchResult {
  ok: boolean
  status: number
  text: string
  contentType?: string
  error?: string
}

/**
 * Enhanced fetch with timeout and retry logic
 */
export async function fetchWithTimeout(
  url: string, 
  options: FetchOptions = {}
): Promise<FetchResult> {
  const {
    timeout = 10000,
    retries = 1,
    headers = {},
    signal
  } = options

  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      // Combine signals if external signal provided
      const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          ...headers
        },
        signal: combinedSignal
      })
      
      clearTimeout(timeoutId)
      
      const text = await response.text()
      const contentType = response.headers.get('content-type') || undefined
      
      return {
        ok: response.ok,
        status: response.status,
        text,
        contentType
      }
      
    } catch (error) {
      lastError = error as Error
      
      // Don't retry on abort or certain errors
      if (lastError.name === 'AbortError' || attempt === retries) {
        break
      }
      
      // Wait before retry with exponential backoff
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }
  }
  
  return {
    ok: false,
    status: 0,
    text: '',
    error: lastError?.message || 'Unknown fetch error'
  }
}

/**
 * Fetch multiple URLs in parallel with concurrency limit
 */
export async function fetchMultiple(
  urls: string[], 
  options: FetchOptions = {},
  concurrency = 3
): Promise<Map<string, FetchResult>> {
  const results = new Map<string, FetchResult>()
  
  // Process URLs in batches to limit concurrency
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    const promises = batch.map(async url => {
      const result = await fetchWithTimeout(url, options)
      return { url, result }
    })
    
    const batchResults = await Promise.allSettled(promises)
    
    for (const promiseResult of batchResults) {
      if (promiseResult.status === 'fulfilled') {
        const { url, result } = promiseResult.value
        results.set(url, result)
      } else {
        // Handle rejected promises
        const url = batch[batchResults.indexOf(promiseResult)]
        results.set(url, {
          ok: false,
          status: 0,
          text: '',
          error: promiseResult.reason?.message || 'Promise rejected'
        })
      }
    }
  }
  
  return results
}

/**
 * Probe multiple API endpoints for video URLs
 */
export async function probeApiEndpoints(
  baseUrl: URL,
  endpoints: string[],
  options: FetchOptions = {}
): Promise<Set<string>> {
  const urls = new Set<string>()
  const apiUrls = endpoints.map(endpoint => {
    try {
      return new URL(endpoint, baseUrl).toString()
    } catch {
      return null
    }
  }).filter(Boolean) as string[]
  
  if (apiUrls.length === 0) return urls
  
  const results = await fetchMultiple(apiUrls, options)
  
  for (const [apiUrl, result] of results) {
    if (!result.ok) continue
    
    const { text, contentType } = result
    
    // Try JSON parse first
    if (contentType?.includes('json') || /^[{\[]/.test(text.trim())) {
      try {
        const data = JSON.parse(text)
        extractUrlsFromJson(data, urls, apiUrl)
      } catch {
        // Fallback to text scanning
        scanTextForUrls(text, urls)
      }
    } else {
      scanTextForUrls(text, urls)
    }
  }
  
  return urls
}

/**
 * Extract URLs from JSON response
 */
function extractUrlsFromJson(obj: any, urls: Set<string>, baseUrl: string): void {
  if (typeof obj === 'string' && /\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)(?:$|\?)/.test(obj)) {
    try {
      urls.add(new URL(obj, baseUrl).toString())
    } catch {
      if (/^https?:\/\//.test(obj)) urls.add(obj)
    }
  } else if (Array.isArray(obj)) {
    obj.forEach(item => extractUrlsFromJson(item, urls, baseUrl))
  } else if (typeof obj === 'object' && obj) {
    Object.values(obj).forEach(value => extractUrlsFromJson(value, urls, baseUrl))
  }
}

/**
 * Scan text for video URLs
 */
function scanTextForUrls(text: string, urls: Set<string>): void {
  const patterns = [
    /https?:\/\/[^\s'"<>]*\.(?:m3u8|mp4|webm|mkv|avi|mov|mpd)[^\s'"<>]*/gi
  ]
  
  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      urls.add(match[0])
    }
  }
}