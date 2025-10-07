// Redis-based distributed caching for server-side use
import { createClient, RedisClientType } from 'redis'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class RedisCache {
  private client: RedisClientType | null = null
  private isConnected = false
  private isRedisAvailable = false
  private connectionAttempted = false
  private lastErrorLog = 0

  constructor() {
    // Don't auto-connect, wait for first use
  }

  private async initClient(): Promise<boolean> {
    if (this.connectionAttempted && !this.isRedisAvailable) {
      // Already tried and failed, don't retry
      return false
    }

    if (this.client && this.isConnected) {
      return true
    }

    this.connectionAttempted = true

    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000 // Shorter timeout
        }
      })

      // Only log connection errors once every 5 minutes to avoid spam
      this.client.on('error', (err) => {
        const now = Date.now()
        if (now - this.lastErrorLog > 5 * 60 * 1000) { // 5 minutes
          console.warn('⚠️ Redis unavailable (this warning shown once every 5 minutes):', err.message)
          this.lastErrorLog = now
        }
        this.isConnected = false
        this.isRedisAvailable = false
      })

      this.client.on('connect', () => {
        console.log('✅ Redis connected')
        this.isConnected = true
        this.isRedisAvailable = true
      })

      this.client.on('disconnect', () => {
        console.log('📡 Redis disconnected')
        this.isConnected = false
      })

      await this.client.connect()
      return true
    } catch (error) {
      this.isRedisAvailable = false
      // Only log initialization errors once
      if (!this.lastErrorLog) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn('⚠️ Redis not available, caching disabled:', message)
        this.lastErrorLog = Date.now()
      }
      return false
    }
  }

  private async ensureConnection(): Promise<boolean> {
    if (!this.isRedisAvailable && this.connectionAttempted) {
      return false
    }

    if (!this.client) {
      return await this.initClient()
    }

    if (!this.isConnected) {
      try {
        await this.client.connect()
        return true
      } catch (error) {
        this.isRedisAvailable = false
        return false
      }
    }

    return true
  }

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    if (!this.isRedisAvailable) {
      return // Silently skip if Redis is not available
    }

    if (!await this.ensureConnection() || !this.client) {
      return
    }

    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlMs
      }

      await this.client.setEx(key, Math.ceil(ttlMs / 1000), JSON.stringify(entry))
      console.log(`💾 Cached data in Redis: ${key}`)
    } catch (error) {
      console.error('❌ Redis set error:', error)
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isRedisAvailable) {
      return null // Silently return null if Redis is not available
    }

    if (!await this.ensureConnection() || !this.client) {
      return null
    }

    try {
      const data = await this.client.get(key)
      if (!data) return null

      const entry: CacheEntry<T> = JSON.parse(data)
      const now = Date.now()

      // Check if entry has expired
      if (now > entry.timestamp + entry.ttl) {
        await this.delete(key)
        return null
      }

      console.log(`📦 Redis cache hit: ${key}`)
      return entry.data
    } catch (error) {
      console.error('❌ Redis get error:', error)
      return null
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.isRedisAvailable) {
      return false
    }

    if (!await this.ensureConnection() || !this.client) {
      return false
    }

    try {
      const exists = await this.client.exists(key)
      return exists === 1
    } catch (error) {
      console.error('❌ Redis exists error:', error)
      return false
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.isRedisAvailable) {
      return false
    }

    if (!await this.ensureConnection() || !this.client) {
      return false
    }

    try {
      const result = await this.client.del(key)
      console.log(`🗑️ Removed from Redis cache: ${key}`)
      return result > 0
    } catch (error) {
      console.error('❌ Redis delete error:', error)
      return false
    }
  }

  async clear(): Promise<void> {
    if (!this.isRedisAvailable) {
      return
    }

    if (!await this.ensureConnection() || !this.client) {
      return
    }

    try {
      await this.client.flushAll()
      console.log('🧹 Cleared Redis cache')
    } catch (error) {
      console.error('❌ Redis clear error:', error)
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect()
        this.isConnected = false
        console.log('📡 Redis disconnected')
      } catch (error) {
        console.error('❌ Redis disconnect error:', error)
      }
    }
  }

  getStats(): Promise<{ connected: boolean; info?: any }> {
    return new Promise(async (resolve) => {
      if (!await this.ensureConnection() || !this.client) {
        resolve({ connected: false })
        return
      }

      try {
        const info = await this.client.info()
        resolve({ connected: true, info })
      } catch (error) {
        console.error('❌ Redis info error:', error)
        resolve({ connected: false })
      }
    })
  }
}

// Global Redis cache instance
let redisCache: RedisCache | null = null

export function getRedisCache(): RedisCache {
  if (!redisCache) {
    redisCache = new RedisCache()
  }
  return redisCache
}

export function clearRedisCache(): Promise<void> {
  if (redisCache) {
    return redisCache.clear()
  }
  return Promise.resolve()
}

// Smart cache with background refresh
export async function cachedApiCall<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number,
  staleWhileRevalidate: number = ttl / 4
): Promise<T> {
  const cache = getRedisCache()

  // Check cache first (only if Redis is available)
  const cached = await cache.get<T>(key)
  if (cached !== null) {
    console.log(`📦 Redis cache hit for key: ${key}`)

    // Background refresh if near expiry (only if Redis is available)
    if (cache['isRedisAvailable']) {
      const entryKey = `ttl:${key}`
      const ttlRemaining = await cache.get<number>(entryKey)
      if (ttlRemaining && ttlRemaining < staleWhileRevalidate) {
        fetchFn().then(async result => {
          await cache.set(key, result, ttl)
          await cache.set(entryKey, ttl, ttl) // Store TTL for checking
        }).catch(console.error)
      }
    }

    return cached
  }

  console.log(`🌐 Redis cache miss for key: ${key}, fetching...`)

  // Fetch fresh data
  const result = await fetchFn()

  // Cache result only if Redis is available
  if (cache['isRedisAvailable']) {
    await cache.set(key, result, ttl)
    await cache.set(`ttl:${key}`, ttl, ttl)
    console.log(`💾 Cached data in Redis for key: ${key}`)
  }

  return result
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

export function generateAnimeCacheKey(id: string): string {
  return `anime:${id}`
}

// Cache TTL constants (in milliseconds)
export const REDIS_CACHE_TTL = {
  CATALOGUE: 10 * 60 * 1000, // 10 minutes
  SEARCH: 15 * 60 * 1000,    // 15 minutes
  ANIME_DETAILS: 30 * 60 * 1000, // 30 minutes
  USER_DATA: 5 * 60 * 1000,  // 5 minutes
  GENERAL: 5 * 60 * 1000     // 5 minutes
}