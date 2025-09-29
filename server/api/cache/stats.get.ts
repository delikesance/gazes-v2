import { getVideoCache } from '~/server/utils/videoCache'

export default defineEventHandler(async (event) => {
  // Only allow GET requests
  if (getMethod(event) !== 'GET') {
    setResponseStatus(event, 405)
    return { error: 'Method not allowed' }
  }

  const videoCache = getVideoCache()
  const stats = videoCache.getStats()

  // Get detailed cache entries for monitoring
  const entries = Array.from(videoCache['cache'].entries()).map(([key, entry]) => ({
    key,
    url: entry.url,
    size: entry.size,
    contentType: entry.contentType,
    isHls: entry.isHls,
    providerReliability: entry.providerReliability,
    accessCount: entry.accessCount,
    lastAccessed: new Date(entry.lastAccessed).toISOString(),
    expiresAt: entry.expiresAt ? new Date(entry.expiresAt).toISOString() : null,
    ttl: entry.ttl,
    age: Date.now() - entry.timestamp
  }))

  return {
    cache: {
      ...stats,
      entries: entries.slice(0, 100), // Limit to first 100 entries for performance
      totalEntries: entries.length
    },
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    }
  }
})