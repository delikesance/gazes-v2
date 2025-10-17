import { DatabaseService } from '~/server/utils/database'

export default defineEventHandler(async (event) => {
  try {
    const db = DatabaseService.getInstance()
    const animeList = await db.getAllAnimeMetadata(10000, 0)

    // Return only the IDs for sitemap generation
    const animeIds = animeList.map((anime: any) => anime.id)

    return {
      success: true,
      count: animeIds.length,
      ids: animeIds
    }
  } catch (error) {
    console.error('[API_SITEMAP] Error fetching anime IDs:', error)
    return {
      success: false,
      count: 0,
      ids: [],
      error: 'Failed to fetch anime IDs'
    }
  }
})