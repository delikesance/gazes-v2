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

    // Get continue watching progress
    const db = DatabaseService.getInstance()
    const progress = await db.getUserContinueWatching(user.id)

    console.log('✅ [WATCH_PROGRESS] Found', progress.length, 'continue watching items for user:', user.username)
    return {
      success: true,
      progress
    }
  } catch (error) {
    console.error('❌ [WATCH_PROGRESS] Error occurred:', error)
    throw error
  }
})