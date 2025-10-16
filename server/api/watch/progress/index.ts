import { AuthService } from '~/server/utils/auth'
import { DatabaseService } from '~/server/utils/database'

export default defineEventHandler(async (event) => {

  try {
    // Get authenticated user
    const user = await AuthService.getUserFromRequest(event)
    if (!user) {
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