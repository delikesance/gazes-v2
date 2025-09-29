import { AuthService } from '~/server/utils/auth'
import { DatabaseService } from '~/server/utils/database'

export default defineEventHandler(async (event) => {
  console.log('📺 [WATCHED_EPISODES] Watched episodes request received')

  try {
    // Get authenticated user
    const user = await AuthService.getUserFromRequest(event)
    if (!user) {
      console.log('❌ [WATCHED_EPISODES] No authenticated user')
      throw createError({
        statusCode: 401,
        statusMessage: 'Non authentifié'
      })
    }

    const method = event.node.req.method
    const query = getQuery(event)
    const body = await readBody(event).catch(() => ({}))

    const animeId = query.animeId as string
    if (!animeId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'animeId is required'
      })
    }

    const db = DatabaseService.getInstance()

    switch (method) {
      case 'GET':
        // Get all watched episodes for a series
        const watchedEpisodes = await db.getWatchedEpisodes(user.id, animeId)
        return {
          success: true,
          episodes: watchedEpisodes
        }

      case 'POST':
        // Mark an episode as watched
        const { season, episode } = body
        if (!season || !episode) {
          throw createError({
            statusCode: 400,
            statusMessage: 'season and episode are required'
          })
        }

        await db.markEpisodeWatched(user.id, animeId, season, parseInt(episode))
        return {
          success: true,
          message: 'Episode marked as watched'
        }

      case 'DELETE':
        // Unmark an episode as watched or clear all for series
        const { season: delSeason, episode: delEpisode } = query

        if (delSeason && delEpisode) {
          // Unmark specific episode
          const success = await db.unmarkEpisodeWatched(user.id, animeId, delSeason as string, parseInt(delEpisode as string))
          return {
            success,
            message: success ? 'Episode unmarked as watched' : 'Failed to unmark episode'
          }
        } else {
          // Clear all watched episodes for the series
          const success = await db.clearWatchedEpisodesForSeries(user.id, animeId)
          return {
            success,
            message: success ? 'All watched episodes cleared' : 'Failed to clear watched episodes'
          }
        }

      default:
        throw createError({
          statusCode: 405,
          statusMessage: 'Method not allowed'
        })
    }
  } catch (error) {
    console.error('❌ [WATCHED_EPISODES] Error occurred:', error)
    throw error
  }
})