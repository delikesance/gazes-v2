// Simple in-memory cache for video resolver results
interface CacheEntry {
  data: any
  timestamp: number
  ttl: number
}

export class VideoCache {
  private cache = new Map<string, CacheEntry>()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes default

  /**
   * Get cached result if still valid
   */
  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    const now = Date.now()
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  /**
   * Set cache entry with optional custom TTL
   */
  set(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    })
  }

  /**
   * Generate cache key from URL and options
   */
  static generateKey(url: string, options?: Record<string, any>): string {
    const optionsStr = options ? JSON.stringify(options) : ''
    return `${url}:${optionsStr}`
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: 0, // Would need to track this separately
      misses: 0 // Would need to track this separately
    }
  }
}

// Global cache instance
export const videoCache = new VideoCache()

// Cleanup expired entries every 10 minutes
setInterval(() => {
  videoCache.cleanup()
}, 10 * 60 * 1000)