import { getProviderInfo, getProviderReliability } from '~/server/utils/videoProviders'
import { REDIS_CACHE_TTL } from '~/server/utils/redis-cache'

// Cache TTL constants (in milliseconds) - imported from redis-cache.ts

// Video cache entry with size tracking and content type
interface VideoCacheEntry {
  data: Buffer | string // Buffer for binary content, string for text (like m3u8)
  contentType: string
  size: number // Size in bytes
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
  url: string
  isHls: boolean
  providerReliability: number
  expiresAt?: number // For URLs with expiration
}

// Smart video cache with size limits and LRU eviction
export class VideoCache {
  private cache = new Map<string, VideoCacheEntry>()
  private maxSize: number // Maximum cache size in bytes (default 1GB)
  private currentSize = 0
  private cleanupInterval: NodeJS.Timeout
  private accessLog = new Map<string, number>() // For LRU tracking

  constructor(maxSizeBytes = 1024 * 1024 * 1024) { // 1GB default
    this.maxSize = maxSizeBytes

    // Clean up expired entries every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 30 * 1000)
  }

  // Generate cache key for video URLs
  private generateKey(url: string): string {
    return `video:${url}`
  }

  // Detect if URL has expiration parameters
  private detectExpiration(url: string): number | null {
    try {
      const urlObj = new URL(url)
      const expires = urlObj.searchParams.get('expires') ||
                     urlObj.searchParams.get('exp') ||
                     urlObj.searchParams.get('e')

      if (expires) {
        // Try to parse as timestamp
        const timestamp = parseInt(expires)
        if (!isNaN(timestamp)) {
          // If it's a reasonable timestamp (not too far in past/future)
          const now = Date.now() / 1000
          if (timestamp > now - 3600 && timestamp < now + 24 * 3600) {
            return timestamp * 1000 // Convert to milliseconds
          }
        }
      }
    } catch (error) {
      // Invalid URL, ignore
    }
    return null
  }

  // Calculate TTL based on provider reliability and URL expiration
  private calculateTTL(url: string, contentType: string): number {
    const provider = getProviderInfo(url)
    const reliability = provider?.reliability || 5
    const expiresAt = this.detectExpiration(url)

    // Base TTL based on content type
    let baseTTL = contentType.includes('mpegurl') ? REDIS_CACHE_TTL.GENERAL : REDIS_CACHE_TTL.USER_DATA

    // Adjust TTL based on provider reliability
    // More reliable providers get longer cache times
    const reliabilityMultiplier = Math.max(0.5, reliability / 10)
    baseTTL = Math.floor(baseTTL * reliabilityMultiplier)

    // If URL has expiration, use that but cap at our max TTL
    if (expiresAt) {
      const timeToExpiry = expiresAt - Date.now()
      if (timeToExpiry > 0) {
        // Use 80% of the time to expiry to be safe
        baseTTL = Math.min(baseTTL, Math.floor(timeToExpiry * 0.8))
      }
    }

    return Math.max(60000, baseTTL) // Minimum 1 minute
  }

  // Check if content should be cached based on size and type
  private shouldCache(url: string, contentType: string, size: number): boolean {
    // Don't cache very large files (>100MB)
    if (size > 100 * 1024 * 1024) {
      return false
    }

    // Always cache HLS playlists (small text files)
    if (contentType.includes('mpegurl') || url.includes('.m3u8')) {
      return true
    }

    // Cache MP4 and other video files if they're not too large
    if (contentType.includes('video') || url.includes('.mp4') || url.includes('.webm')) {
      return size <= 50 * 1024 * 1024 // Max 50MB for video files
    }

    // Don't cache other content types
    return false
  }

  // LRU eviction to make room for new entries
  private evictLRU(targetSize: number): void {
    if (this.currentSize + targetSize <= this.maxSize) {
      return // No need to evict
    }

    // Sort entries by last access time (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)

    let freedSize = 0
    const toRemove: string[] = []

    for (const [key, entry] of entries) {
      if (this.currentSize + targetSize - freedSize <= this.maxSize) {
        break
      }

      toRemove.push(key)
      freedSize += entry.size
    }

    // Remove evicted entries
    for (const key of toRemove) {
      this.cache.delete(key)
    }

    this.currentSize -= freedSize
  }

  // Store video content in cache
  set(url: string, data: Buffer | string, contentType: string): void {
    const key = this.generateKey(url)
    const size = data.length
    const isHls = contentType.includes('mpegurl') || url.includes('.m3u8')
    const providerReliability = getProviderReliability(url)
    const expiresAt = this.detectExpiration(url)
    const ttl = this.calculateTTL(url, contentType)

    // Check if we should cache this content
    if (!this.shouldCache(url, contentType, size)) {
      return
    }

    // Evict if necessary
    this.evictLRU(size)

    // Remove old entry if it exists
    const existing = this.cache.get(key)
    if (existing) {
      this.currentSize -= existing.size
    }

    // Add new entry
    const entry: VideoCacheEntry = {
      data,
      contentType,
      size,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
      url,
      isHls,
      providerReliability,
      expiresAt: expiresAt || undefined
    }

    this.cache.set(key, entry)
    this.currentSize += size

  }

  // Get cached video content
  get(url: string): { data: Buffer | string; contentType: string } | null {
    const key = this.generateKey(url)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    const now = Date.now()

    // Check TTL
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key)
      this.currentSize -= entry.size
      return null
    }

    // Check URL expiration
    if (entry.expiresAt && now > entry.expiresAt) {
      this.cache.delete(key)
      this.currentSize -= entry.size
      return null
    }

    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = now

    return {
      data: entry.data,
      contentType: entry.contentType
    }
  }

  // Check if URL is cached
  has(url: string): boolean {
    const key = this.generateKey(url)
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    const now = Date.now()

    // Check if expired
    if (now > entry.timestamp + entry.ttl || (entry.expiresAt && now > entry.expiresAt)) {
      this.cache.delete(key)
      this.currentSize -= entry.size
      return false
    }

    return true
  }

  // Remove specific URL from cache
  delete(url: string): boolean {
    const key = this.generateKey(url)
    const entry = this.cache.get(key)

    if (entry) {
      this.cache.delete(key)
      this.currentSize -= entry.size
      return true
    }

    return false
  }

  // Clean up expired entries
  private cleanup(): void {
    const now = Date.now()
    let removedCount = 0
    let freedSize = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl || (entry.expiresAt && now > entry.expiresAt)) {
        this.cache.delete(key)
        this.currentSize -= entry.size
        removedCount++
        freedSize += entry.size
      }
    }

    if (removedCount > 0) {
    }
  }

  // Get cache statistics
  getStats(): {
    entries: number
    totalSize: number
    maxSize: number
    utilizationPercent: number
    hitRate?: number
  } {
    const totalAccesses = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.accessCount, 0)
    const totalHits = totalAccesses // In this simple implementation, every get() is a hit

    return {
      entries: this.cache.size,
      totalSize: this.currentSize,
      maxSize: this.maxSize,
      utilizationPercent: (this.currentSize / this.maxSize) * 100,
      hitRate: totalAccesses > 0 ? (totalHits / totalAccesses) * 100 : undefined
    }
  }

  // Clear all cached content
  clear(): void {
    this.cache.clear()
    this.currentSize = 0
  }

  // Destroy the cache (stop cleanup interval)
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.clear()
  }
}

// Global video cache instance
let videoCache: VideoCache | null = null

export function getVideoCache(): VideoCache {
  if (!videoCache) {
    // Initialize with 1GB cache size
    videoCache = new VideoCache()
  }
  return videoCache
}

export function clearVideoCache(): void {
  if (videoCache) {
    videoCache.clear()
    videoCache.destroy()
    videoCache = null
  }
}

// Cache key generators for video-related data
export function generateVideoUrlCacheKey(url: string): string {
  return `video_url:${url}`
}

export function generateHlsPlaylistCacheKey(url: string): string {
  return `hls_playlist:${url}`
}

export function generateVideoContentCacheKey(url: string): string {
  return `video_content:${url}`
}