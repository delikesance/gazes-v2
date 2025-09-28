import { AuthService } from '~/server/utils/auth'
import { DatabaseService } from '~/server/utils/database'

export default defineEventHandler(async (event) => {
  const method = event.node.req.method

  if (method === 'GET') {
    // GET: Load progress for a specific anime
    console.log('📺 [LOAD_PROGRESS] GET request received')

    try {
      // Get authenticated user
      const user = await AuthService.getUserFromRequest(event)
      if (!user) {
        console.log('❌ [LOAD_PROGRESS] No authenticated user')
        throw createError({
          statusCode: 401,
          statusMessage: 'Non authentifié'
        })
      }

      const animeId = getRouterParam(event, 'animeId')
      if (!animeId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Anime ID manquant'
        })
      }

      // Get progress for this specific anime
      const db = DatabaseService.getInstance()
      const result = await db.getUserContinueWatching(user.id, 1000, 0) // Get all for filtering
      const animeProgress = result.items.filter((p: any) => p.animeId === animeId)

      console.log('✅ [LOAD_PROGRESS] Found', animeProgress.length, 'progress items for anime:', animeId)
      return {
        success: true,
        progress: animeProgress
      }
    } catch (error) {
      console.error('❌ [LOAD_PROGRESS] Error occurred:', error)
      throw error
    }
  } else if (method === 'POST') {
    // POST: Save progress for a specific anime
    console.log('📺 [SAVE_PROGRESS] POST request received')

    try {
      // Get authenticated user
      const user = await AuthService.getUserFromRequest(event)
      if (!user) {
        console.log('❌ [SAVE_PROGRESS] No authenticated user')
        throw createError({
          statusCode: 401,
          statusMessage: 'Non authentifié'
        })
      }

      const animeId = getRouterParam(event, 'animeId')
      const body = await readBody(event)
      const { season, episode, currentTime, duration } = body

      console.log('📺 [SAVE_PROGRESS] Saving progress:', { userId: user.id, animeId, season, episode, currentTime, duration })

      // Validate input
      if (!animeId || season === undefined || episode === undefined || currentTime === undefined || duration === undefined) {
        console.log('❌ [SAVE_PROGRESS] Missing required fields')
        throw createError({
          statusCode: 400,
          statusMessage: 'Champs requis manquants'
        })
      }

      // Save progress
      const db = DatabaseService.getInstance()
      const progress = await db.saveWatchingProgress(user.id, animeId, season, episode, currentTime, duration)

      console.log('✅ [SAVE_PROGRESS] Progress saved successfully for user:', user.username)
      return {
        success: true,
        progress
      }
    } catch (error) {
      console.error('❌ [SAVE_PROGRESS] Error occurred:', error)
      throw error
    }
   } else if (method === 'DELETE') {
     // DELETE: Remove progress for a specific anime episode
     console.log('🗑️ [DELETE_PROGRESS] DELETE request received')

     try {
       // Get authenticated user
       const user = await AuthService.getUserFromRequest(event)
       if (!user) {
         console.log('❌ [DELETE_PROGRESS] No authenticated user')
         throw createError({
           statusCode: 401,
           statusMessage: 'Non authentifié'
         })
       }

       const animeId = getRouterParam(event, 'animeId')
       const body = await readBody(event)
       const { season, episode } = body

       console.log('🗑️ [DELETE_PROGRESS] Deleting progress:', { userId: user.id, animeId, season, episode })

       // Validate input
       if (!animeId || season === undefined || episode === undefined) {
         console.log('❌ [DELETE_PROGRESS] Missing required fields')
         throw createError({
           statusCode: 400,
           statusMessage: 'Champs requis manquants'
         })
       }

       // Delete progress
       const db = DatabaseService.getInstance()
       await db.deleteWatchingProgress(user.id, animeId, season, episode)

       console.log('✅ [DELETE_PROGRESS] Progress deleted successfully for user:', user.username)
       return {
         success: true
       }
     } catch (error) {
       console.error('❌ [DELETE_PROGRESS] Error occurred:', error)
       throw error
     }
   } else {
     throw createError({
       statusCode: 405,
       statusMessage: 'Méthode non autorisée'
     })
   }
})