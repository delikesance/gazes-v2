import { AuthService } from '~/server/utils/auth'
import { DatabaseService } from '~/server/utils/database'

export default defineEventHandler(async (event) => {
  console.log('📺 [WATCH_PROGRESS] Get request received')

  try {
    // Get authenticated user
    const user = await AuthService.getUserFromRequest(event)
    if (!user) {
      console.log('❌ [WATCH_PROGRESS] No authenticated user')
      throw createError({
        statusCode: 401,
        statusMessage: 'Non authentifié'
      })
    }

    const query = getQuery(event)
    const limit = Math.min(parseInt(query.limit as string) || 20, 100) // Max 100 items
    const offset = Math.max(parseInt(query.offset as string) || 0, 0)

    // Get continue watching progress with pagination
    const db = DatabaseService.getInstance()
    const result = await db.getUserContinueWatching(user.id, limit, offset)

    console.log('✅ [WATCH_PROGRESS] Found', result.items.length, 'continue watching items for user:', user.username)
    return {
      success: true,
      progress: result.items,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total
      }
    }
  } catch (error) {
    console.error('❌ [WATCH_PROGRESS] Error occurred:', error)
    throw error
  }
})