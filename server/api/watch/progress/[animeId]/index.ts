import { AuthService } from '~/server/utils/auth'
import { DatabaseService } from '~/server/utils/database'

export default defineEventHandler(async (event) => {
  const method = event.node.req.method

  if (method === 'GET') {
    // GET: Load progress for a specific anime

    try {
      // Get authenticated user
      const user = await AuthService.getUserFromRequest(event)
      if (!user) {
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
      const allProgress = await db.getAllUserWatchingProgress(user.id)
      const animeProgress = allProgress.filter((p: any) => p.animeId === animeId)

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

    try {
      // Get authenticated user
      const user = await AuthService.getUserFromRequest(event)
      if (!user) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Non authentifié'
        })
      }

      const animeId = getRouterParam(event, 'animeId')
      const body = await readBody(event)
      const { season, episode, currentTime, duration } = body


      // Validate input
      if (!animeId || season === undefined || episode === undefined || currentTime === undefined || duration === undefined) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Champs requis manquants'
        })
      }

      // Save progress
      const db = DatabaseService.getInstance()
      const progress = await db.saveWatchingProgress(user.id, animeId, season, episode, currentTime, duration)

      return {
        success: true,
        progress
      }
    } catch (error) {
      console.error('❌ [SAVE_PROGRESS] Error occurred:', error)
      throw error
    }
   } else if (method === 'DELETE') {
     // DELETE: Remove progress for a specific anime episode or entire series

     try {
       // Get authenticated user
       const user = await AuthService.getUserFromRequest(event)
       if (!user) {
         throw createError({
           statusCode: 401,
           statusMessage: 'Non authentifié'
         })
       }

       const animeId = getRouterParam(event, 'animeId')
       const body = await readBody(event).catch(() => ({})) // Handle cases where no body is provided
       const { season, episode } = body || {}


       // Validate input
       if (!animeId) {
         throw createError({
           statusCode: 400,
           statusMessage: 'Anime ID manquant'
         })
       }

       const db = DatabaseService.getInstance()

       if (season !== undefined && episode !== undefined) {
         // Delete specific episode progress
         await db.deleteWatchingProgress(user.id, animeId, season, episode)
       } else {
         // Delete all progress for this anime series
         const allProgress = await db.getAllUserWatchingProgress(user.id)
         const animeProgress = allProgress.filter((p: any) => p.animeId === animeId)

         for (const progress of animeProgress) {
           await db.deleteWatchingProgress(user.id, animeId, progress.season, progress.episode)
         }

       }

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