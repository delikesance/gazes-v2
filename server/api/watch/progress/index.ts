import { DatabaseService } from '~/server/utils/database'
import { AuthService } from '~/server/utils/auth'
import { formatSeasonDisplay } from '~/shared/utils/season'

export default defineEventHandler(async (event) => {
  // Get user from request
  const user = await AuthService.getUserFromRequest(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }

  try {
    const db = DatabaseService.getInstance()
    const progressItems = await db.getUserContinueWatching(user.id, 20)

    // Enrich with anime metadata
    const enrichedItems = await Promise.all(
      progressItems.map(async (progress) => {
        try {
          // Fetch anime metadata
          const animeResponse = await $fetch(`/api/anime/${progress.animeId}`)

          return {
            ...progress,
            seasonDisplay: formatSeasonDisplay(progress.season),
            anime: {
              id: progress.animeId,
              title: animeResponse?.title || animeResponse?.name || `Anime ${progress.animeId}`,
              image: animeResponse?.cover || '',
              banner: animeResponse?.banner || '',
              synopsis: animeResponse?.synopsis || '',
              genres: animeResponse?.genres || []
            },
            progressPercent: progress.duration > 0 ? (progress.currentTime / progress.duration) * 100 : 0
          }
        } catch (error) {
          console.warn(`Failed to fetch metadata for anime ${progress.animeId}:`, error)
          // Return progress without metadata if anime fetch fails
          return {
            ...progress,
            seasonDisplay: formatSeasonDisplay(progress.season),
            anime: {
              id: progress.animeId,
              title: `Anime ${progress.animeId}`,
              image: '',
              banner: '',
              synopsis: '',
              genres: []
            },
            progressPercent: progress.duration > 0 ? (progress.currentTime / progress.duration) * 100 : 0
          }
        }
      })
    )

    return {
      success: true,
      items: enrichedItems
    }
  } catch (error) {
    console.error('Failed to get continue watching:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get continue watching items'
    })
  }
})