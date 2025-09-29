import { AuthService } from '~/server/utils/auth'
import { DatabaseService } from '~/server/utils/database'

interface SeriesProgress {
  animeId: string
  title: string
  image: string
  lastWatchedEpisode: {
    season: string
    episode: number
    currentTime: number
    duration: number
    progressPercent: number
  }
  completedEpisodes: number // Actually represents watched episodes (episodes with progress > 0)
  totalEpisodes: number
  overallProgress: number
  lastWatchedAt: Date
  defaultLang?: string
}

// In-memory caches
const animeCache = new Map<string, any>()
const totalEpisodesCache = new Map<string, number>()

// Request deduplication for anime API calls
const pendingAnimeRequests = new Map<string, Promise<any>>()

async function getAnimeDataCached(animeId: string): Promise<any> {
  // Check cache first
  const cached = animeCache.get(animeId)
  if (cached) {
    return cached
  }

  // Check if request is already in flight
  const pending = pendingAnimeRequests.get(animeId)
  if (pending) {
    return pending
  }

  // Create and store the request
  const requestPromise = (async () => {
    try {
      const data = await $fetch(`/api/anime/${animeId}`)
      animeCache.set(animeId, data)
      return data
    } catch (error) {
      throw error
    } finally {
      pendingAnimeRequests.delete(animeId)
    }
  })()

  pendingAnimeRequests.set(animeId, requestPromise)
  return requestPromise
}

export default defineEventHandler(async (event) => {
  console.log('📺 [WATCH_PROGRESS_SERIES] Get series progress request received')

  try {
    // Get authenticated user
    const user = await AuthService.getUserFromRequest(event)
    if (!user) {
      console.log('❌ [WATCH_PROGRESS_SERIES] No authenticated user')
      throw createError({
        statusCode: 401,
        statusMessage: 'Non authentifié'
      })
    }

    const query = getQuery(event)
    const limit = Math.min(parseInt(query.limit as string) || 20, 100) // Max 100 items
    const offset = Math.max(parseInt(query.offset as string) || 0, 0)

    // Get aggregated series progress from database (more efficient)
    const db = DatabaseService.getInstance()
    const aggregatedProgress = await db.getAggregatedUserSeriesProgress(user.id)

    if (aggregatedProgress.length === 0) {
      return {
        success: true,
        series: [],
        pagination: {
          total: 0,
          limit,
          offset,
          hasMore: false
        }
      }
    }

    // Process each aggregated series with caching and batching
    const seriesPromises = aggregatedProgress.map(async (seriesData: any) => {
      try {
        // Skip if anime_id is missing
        if (!seriesData.anime_id) {
          console.warn('Skipping series with missing anime_id:', seriesData)
          return null
        }

        // Get anime data with caching and deduplication
        const animeData = await getAnimeDataCached(seriesData.anime_id)
        console.log(`📺 Processing ${seriesData.anime_id}: got anime data:`, !!animeData)

        // Get total episodes with caching
        const totalEpisodes = await getTotalEpisodesCached(animeData, seriesData.anime_id)
        console.log(`📺 ${seriesData.anime_id}: total episodes = ${totalEpisodes}`)

        // Use aggregated data from database
        const watchedEpisodes = seriesData.total_episodes_watched || 0
        const completedEpisodes = seriesData.completed_episodes || 0
        const overallProgress = totalEpisodes > 0 ? (completedEpisodes / totalEpisodes) * 100 : 0

        // Get default language
        const defaultLang = animeData.languageFlags ? Object.keys(animeData.languageFlags)[0] : 'vostfr'

        return {
          animeId: seriesData.anime_id,
          title: animeData.title || seriesData.anime_id,
          image: animeData.cover || '',
          lastWatchedEpisode: {
            season: seriesData.latest_season,
            episode: seriesData.latest_episode,
            currentTime: seriesData.latest_current_time,
            duration: seriesData.latest_duration,
            progressPercent: seriesData.latest_duration > 0 ? (seriesData.latest_current_time / seriesData.latest_duration) * 100 : 0
          },
          completedEpisodes: watchedEpisodes, // Use watched episodes for the X/Y display
          totalEpisodes,
          overallProgress,
          lastWatchedAt: new Date(seriesData.last_watched_at),
          defaultLang
        }
      } catch (error) {
        console.warn(`Failed to process series ${seriesData.anime_id}:`, error)
        return null // Skip this series if we can't get the data
      }
    })

    // Wait for all series to be processed
    const seriesResults = await Promise.all(seriesPromises)
    const seriesProgress = seriesResults.filter(result => result !== null) as SeriesProgress[]

    // Sort by last watched time (most recent first)
    seriesProgress.sort((a, b) => new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime())

    // Apply pagination
    const totalSeries = seriesProgress.length
    const paginatedSeries = seriesProgress.slice(offset, offset + limit)

    console.log('✅ [WATCH_PROGRESS_SERIES] Found', totalSeries, 'series with progress for user:', user.username)

    return {
      success: true,
      series: paginatedSeries,
      pagination: {
        total: totalSeries,
        limit,
        offset,
        hasMore: offset + limit < totalSeries
      }
    }
  } catch (error) {
    console.error('❌ [WATCH_PROGRESS_SERIES] Error occurred:', error)
    throw error
  }
})

// Helper function to get total episodes for an anime with caching
async function getTotalEpisodesCached(animeData: any, animeId: string): Promise<number> {
  if (!animeData.seasons || animeData.seasons.length === 0) {
    return 0
  }

  let totalEpisodes = 0

  for (const season of animeData.seasons) {
    // Count episodes in this season
    try {
      const episodeCount = await countEpisodesInSeasonCached(animeId, season)
      totalEpisodes += episodeCount
    } catch (error) {
      console.warn(`Failed to count episodes for season ${season.name}:`, error)
    }
  }

  return totalEpisodes
}

// Helper function to count episodes in a season with caching
async function countEpisodesInSeasonCached(animeId: string, season: any): Promise<number> {
  // Construct season URL properly
  let seasonUrl = season.url

  if (seasonUrl.startsWith('/')) {
    seasonUrl = `https://anime-sama.fr/catalogue${seasonUrl}`
  } else if (!seasonUrl.startsWith('http')) {
    seasonUrl = `https://anime-sama.fr/catalogue/${animeId}/${seasonUrl}`
  }

  // Ensure URL ends with slash
  if (!seasonUrl.endsWith('/')) {
    seasonUrl += '/'
  }

  try {
    // First try to get episodes from the episodes.js file
    const episodesJsUrl = `${seasonUrl}episodes.js`
    console.log(`🎯 Trying to fetch episodes.js: ${episodesJsUrl}`)

    const jsResponse = await fetch(episodesJsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
      }
    })

    if (jsResponse.ok) {
      const jsContent = await jsResponse.text()
      const episodeCount = countEpisodesInJs(jsContent)
      if (episodeCount > 0) {
        console.log(`✅ Found ${episodeCount} episodes in episodes.js`)
        return episodeCount
      }
    }

    // Fallback to HTML parsing
    console.log(`📄 Falling back to HTML parsing for: ${seasonUrl}`)
    const response = await fetch(seasonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
      }
    })

    if (response.ok) {
      const html = await response.text()
      return countEpisodesInSeason(html)
    }
  } catch (error) {
    console.warn(`Failed to fetch season page for ${animeId}/${season.name}:`, error)
  }

  return 0
}

// Helper function to count episodes in a season page
function countEpisodesInSeason(html: string): number {
  // Look for episode links in various formats
  const episodePatterns = [
    /href="[^"]*episode-\d+-[^"]*"/gi,  // episode-X-lang links
    /href="[^"]*ep\d+[^"]*"/gi,         // epX links
    /eps\d*\s*=\s*\[/g,                // JavaScript episode arrays
    /<option[^>]*>Episode \d+/gi,      // select options
    /<a[^>]*>Episode \d+/gi            // episode links
  ]

  let maxEpisode = 0

  for (const pattern of episodePatterns) {
    let match
    while ((match = pattern.exec(html)) !== null) {
      // Extract episode number from the match
      const episodeMatch = match[0].match(/(\d+)/)
      if (episodeMatch) {
        const episodeNum = parseInt(episodeMatch[1])
        maxEpisode = Math.max(maxEpisode, episodeNum)
      }
    }
  }

  // Also check for JavaScript arrays that define episodes
  const jsArrayMatch = html.match(/eps\d*\s*=\s*\[([^\]]+)\]/)
  if (jsArrayMatch && jsArrayMatch[1]) {
    const urls = jsArrayMatch[1].split(',').filter(url => url.trim())
    maxEpisode = Math.max(maxEpisode, urls.length)
  }

  return maxEpisode
}

// Helper function to count episodes in episodes.js file
function countEpisodesInJs(jsContent: string): number {
  // Look for episode arrays like: var eps1 = [url1, url2, ...]
  const episodeArrayPattern = /var\s+eps(\d+)\s*=\s*\[([^\]]+)\]/g

  let maxEpisode = 0
  let match

  while ((match = episodeArrayPattern.exec(jsContent)) !== null) {
    const seasonNum = parseInt(match[1])
    const urlsString = match[2]

    // Count URLs in the array
    const urls = urlsString.split(',').filter(url => url.trim() && url.trim() !== '')
    const episodeCount = urls.length

    console.log(`📊 Found eps${seasonNum} with ${episodeCount} episodes`)

    // For now, just return the count from the first array we find
    // In the future, we might want to handle multiple seasons
    if (episodeCount > 0) {
      return episodeCount
    }
  }

  return maxEpisode
}