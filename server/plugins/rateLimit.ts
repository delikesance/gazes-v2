import { createRateLimitMiddleware, rateLimitConfigs } from '~/server/utils/rateLimit'

export default defineNitroPlugin((nitroApp) => {
  // Apply rate limiting to API routes
  nitroApp.hooks.hook('request', async (event) => {
    const url = getRequestURL(event)
    const path = url.pathname

    // Skip rate limiting for static assets and non-API routes
    if (!path.startsWith('/api/') ||
        path.startsWith('/api/_nuxt/') ||
        path.includes('.')) {
      return
    }

    let config = rateLimitConfigs.default

    // Apply specific limits based on route patterns
    if (path.startsWith('/api/auth/')) {
      config = rateLimitConfigs.auth
    } else if (path.startsWith('/api/catalogue') || path.startsWith('/api/search')) {
      config = rateLimitConfigs.catalogue
    } else if (path.startsWith('/api/watch/')) {
      config = rateLimitConfigs.watch
    }

    // Apply rate limiting
    const middleware = createRateLimitMiddleware(config)
    await middleware(event)
  })
})