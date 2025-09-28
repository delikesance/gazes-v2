interface RateLimitEntry {
  count: number
  resetTime: number
}

interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key)
      }
    }
  }

  private getKey(identifier: string, route: string): string {
    return `${identifier}:${route}`
  }

  check(identifier: string, route: string, options: RateLimitOptions): {
    allowed: boolean
    remaining: number
    resetTime: number
  } {
    const key = this.getKey(identifier, route)
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      this.store.set(key, {
        count: 1,
        resetTime: now + options.windowMs
      })
      return {
        allowed: true,
        remaining: options.maxRequests - 1,
        resetTime: now + options.windowMs
      }
    }

    if (entry.count >= options.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime
      }
    }

    entry.count++
    return {
      allowed: true,
      remaining: options.maxRequests - entry.count,
      resetTime: entry.resetTime
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.store.clear()
  }
}

// Global rate limiter instance
let rateLimiter: RateLimiter | null = null

export function getRateLimiter(): RateLimiter {
  if (!rateLimiter) {
    rateLimiter = new RateLimiter()
  }
  return rateLimiter
}

function getClientIP(event: any): string {
  // Try different headers for IP detection
  const forwarded = event.node.req.headers['x-forwarded-for']
  const realIP = event.node.req.headers['x-real-ip']
  const cfIP = event.node.req.headers['cf-connecting-ip']

  if (Array.isArray(forwarded)) {
    return forwarded[0]
  }

  return (forwarded || realIP || cfIP || event.node.req.socket?.remoteAddress || 'unknown') as string
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  return defineEventHandler(async (event) => {
    const limiter = getRateLimiter()

    // Get client identifier (IP address)
    const clientIP = getClientIP(event)

    // Get route path
    const url = getRequestURL(event)
    const route = url.pathname

    const result = limiter.check(clientIP, route, options)

    // Set rate limit headers
    setHeader(event, 'X-RateLimit-Limit', options.maxRequests.toString())
    setHeader(event, 'X-RateLimit-Remaining', result.remaining.toString())
    setHeader(event, 'X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString())

    if (!result.allowed) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Too Many Requests',
        data: {
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        }
      })
    }
  })
}

// Different rate limit configurations for different endpoints
export const rateLimitConfigs = {
  // Strict limits for auth endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5 // 5 attempts per 15 minutes
  },
  // Moderate limits for catalogue/search
  catalogue: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30 // 30 requests per minute
  },
  // Generous limits for watch progress
  watch: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60 // 60 requests per minute
  },
  // Default limits
  default: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100 // 100 requests per minute
  }
}