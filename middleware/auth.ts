import { AuthService } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Skip auth for auth routes
  if (event.node.req.url?.startsWith('/api/auth')) {
    return
  }

  // Skip auth for public API routes
  const publicRoutes = ['/api/search', '/api/catalogue', '/api/anime', '/api/providers', '/api/proxy']
  if (publicRoutes.some(route => event.node.req.url?.startsWith(route))) {
    return
  }

  // Check authentication for protected routes
  const user = await AuthService.getUserFromRequest(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }

  // Add user to event context for use in handlers
  event.context.user = user
})