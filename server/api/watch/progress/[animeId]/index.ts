import { DatabaseService } from '~/server/utils/database'
import { AuthService } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Get user from request
  const user = await AuthService.getUserFromRequest(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }

  const animeId = getRouterParam(event, 'animeId')
  if (!animeId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Anime ID is required'
    })
  }

  const method = event.node.req.method

  if (method === 'GET') {
    // Get all progress for this anime
    try {
      const db = DatabaseService.getInstance()

      // Get all episodes progress for this anime and user
      const stmt = db.getDatabase().prepare(`
        SELECT * FROM watching_progress
        WHERE user_id = ? AND anime_id = ?
        ORDER BY season, episode
      `)

      const rows = stmt.all(user.id, animeId) as any[]

      const progress = rows.map(row => ({
        id: row.id,
        season: row.season,
        episode: row.episode,
        currentTime: row.current_time,
        duration: row.duration,
        lastWatchedAt: row.last_watched_at,
        completed: Boolean(row.completed)
      }))

      return {
        success: true,
        progress
      }
    } catch (error) {
      console.error('Failed to get watching progress:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to get watching progress'
      })
    }
  }

  if (method === 'POST') {
    // Save progress for a specific episode
    try {
      const body = await readBody(event)
      const { season, episode, currentTime, duration } = body

      if (typeof season !== 'string' || typeof episode !== 'number' || typeof currentTime !== 'number' || typeof duration !== 'number') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid request body. Required: season (string), episode (number), currentTime (number), duration (number)'
        })
      }

      const db = DatabaseService.getInstance()
      const progress = await db.saveWatchingProgress(user.id, animeId, season, episode, currentTime, duration)

      // Clean up previous episodes in the same season when watching a later episode
      // This keeps the continue watching list focused on the current watching position
      console.log(`Cleaning up previous episodes in season ${season} before episode ${episode}`)
      
      // Get all episodes in this season that are before the current episode
      const cleanupStmt = db.getDatabase().prepare(`
        SELECT id FROM watching_progress
        WHERE user_id = ? AND anime_id = ? AND season = ? AND episode < ?
      `)
      
      const episodesToDelete = cleanupStmt.all(user.id, animeId, season, episode) as { id: string }[]
      
      if (episodesToDelete.length > 0) {
        console.log(`Found ${episodesToDelete.length} previous episodes to clean up`)
        
        // Delete the previous episodes
        const deleteStmt = db.getDatabase().prepare(`
          DELETE FROM watching_progress WHERE id = ?
        `)
        
        for (const ep of episodesToDelete) {
          deleteStmt.run(ep.id)
          console.log(`Deleted previous episode progress: ${ep.id}`)
        }
      }

      return {
        success: true,
        progress
      }
    } catch (error: any) {
      if (error.statusCode) throw error

      console.error('Failed to save watching progress:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to save watching progress'
      })
    }
  }

  if (method === 'DELETE') {
    // Delete progress for a specific episode
    try {
      const body = await readBody(event)
      const { season, episode } = body

      if (typeof season !== 'string' || typeof episode !== 'number') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid request body. Required: season (string), episode (number)'
        })
      }

      const db = DatabaseService.getInstance()
      const success = await db.deleteWatchingProgress(user.id, animeId, season, episode)

      return {
        success,
        message: success ? 'Progress deleted successfully' : 'Progress not found'
      }
    } catch (error: any) {
      if (error.statusCode) throw error

      console.error('Failed to delete watching progress:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete watching progress'
      })
    }
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method not allowed'
  })
})