// Simple in-memory cache with TTL for server-side use

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.store.delete(key)
      }
    }
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    })
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now > entry.timestamp + entry.ttl) {
      this.store.delete(key)
      return null
    }

    return entry.data
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): boolean {
    return this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  size(): number {
    return this.store.size
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.store.clear()
  }
}

// Global cache instance
let cache: MemoryCache | null = null

export function getCache(): MemoryCache {
  if (!cache) {
    cache = new MemoryCache()
  }
  return cache
}

export function clearGlobalCache(): void {
  if (cache) {
    cache.clear()
    cache.destroy()
    cache = null
  }
}

// Cache key generators
export function generateCatalogueCacheKey(params: {
  genres: string[]
  search: string
  page?: string
  random?: string
  categories: string[]
}): string {
  const { genres, search, page, random, categories } = params
  return `catalogue:${genres.sort().join(',')}:${search}:${page || ''}:${random || ''}:${categories.sort().join(',')}`
}

export function generateSearchCacheKey(query: string): string {
  return `search:${query}`
}

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  CATALOGUE: 10 * 60 * 1000, // 10 minutes
  SEARCH: 15 * 60 * 1000,    // 15 minutes
  USER_DATA: 5 * 60 * 1000,  // 5 minutes
  GENERAL: 5 * 60 * 1000     // 5 minutes
}

// In-flight requests tracker for deduplication
const inFlightRequests = new Map<string, Promise<any>>()

// Cached fetch wrapper with request deduplication
export async function cachedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number
): Promise<T> {
  const cache = getCache()

  // Check cache first
  const cached = cache.get<T>(key)
  if (cached !== null) {
    console.log(`📦 Cache hit for key: ${key}`)
    return cached
  }

  // Check if request is already in flight
  const inFlight = inFlightRequests.get(key)
  if (inFlight) {
    console.log(`⏳ Request deduplication: waiting for in-flight request for key: ${key}`)
    return inFlight
  }

  console.log(`🌐 Cache miss for key: ${key}, fetching...`)

  // Create the fetch promise and store it
  const fetchPromise = (async () => {
    try {
      const data = await fetchFn()
      cache.set(key, data, ttl)
      console.log(`💾 Cached data for key: ${key}`)
      return data
    } catch (error) {
      console.error(`❌ Failed to fetch and cache for key: ${key}`, error)
      throw error
    } finally {
      // Remove from in-flight requests
      inFlightRequests.delete(key)
    }
  })()

  // Store the promise to deduplicate concurrent requests
  inFlightRequests.set(key, fetchPromise)

  return fetchPromise
}
