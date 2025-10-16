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
    const { animeId, season, episode } = query

    if (!animeId || !season || !episode) {
      throw createError({
        statusCode: 400,
        statusMessage: 'animeId, season, and episode are required'
      })
    }

    const db = DatabaseService.getInstance()
    const isWatched = await db.isEpisodeWatched(user.id, animeId as string, season as string, parseInt(episode as string))

    return {
      success: true,
      isWatched
    }
  } catch (error) {
    console.error('❌ [EPISODE_WATCHED] Error occurred:', error)
    throw error
  }
})