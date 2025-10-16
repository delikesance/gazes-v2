import { AuthService } from '~/server/utils/auth'
import { DatabaseService } from '~/server/utils/database'
import axios from 'axios'
import https from 'https'

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
})

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

    // Get aggregated series progress from database (more efficient)
    const db = DatabaseService.getInstance()
    const aggregatedProgress = await db.getAggregatedUserSeriesProgress(user.id)

    console.log(`[SERIES_PROCESS] Found ${aggregatedProgress.length} series in progress for user ${user.id}`)
    if (aggregatedProgress.length > 0) {
      console.log(`[SERIES_PROCESS] Sample series data:`, aggregatedProgress[0])
    }

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
        console.log(`[SERIES_PROCESS] Anime data for ${seriesData.anime_id}:`, {
          title: animeData.title,
          seasonsCount: animeData.seasons?.length || 0,
          seasons: animeData.seasons?.map((s: any) => ({ name: s.name, url: s.url }))
        })

        // Get total episodes with caching
        const totalEpisodes = await getTotalEpisodesCached(animeData, seriesData.anime_id)

        // Use aggregated data from database
        const watchedEpisodes = seriesData.total_episodes_watched || 0
        const completedEpisodes = seriesData.completed_episodes || 0

        // Fallback: if we can't determine total episodes, use watched episodes as minimum
        const effectiveTotalEpisodes = totalEpisodes > 0 ? totalEpisodes : Math.max(watchedEpisodes, 1)

        const overallProgress = effectiveTotalEpisodes > 0 ? (completedEpisodes / effectiveTotalEpisodes) * 100 : 0

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
          totalEpisodes: effectiveTotalEpisodes,
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
    console.warn(`[EPISODE_COUNT] No seasons found for anime ${animeId}`)
    return 0
  }

  console.log(`[EPISODE_COUNT] Found ${animeData.seasons.length} seasons for anime ${animeId}`)

  let totalEpisodes = 0

  for (const season of animeData.seasons) {
    // Count episodes in this season
    try {
      const episodeCount = await countEpisodesInSeasonCached(animeId, season)
      console.log(`[EPISODE_COUNT] Season ${season.name}: ${episodeCount} episodes`)
      totalEpisodes += episodeCount
    } catch (error) {
      console.warn(`Failed to count episodes for season ${season.name}:`, error)
    }
  }

  console.log(`[EPISODE_COUNT] Total episodes for ${animeId}: ${totalEpisodes}`)
  return totalEpisodes
}

// Helper function to count episodes in a season with caching
async function countEpisodesInSeasonCached(animeId: string, season: any): Promise<number> {
  // Construct season URL properly
  let seasonUrl = season.url

  console.log(`[SEASON_URL] Original season URL for ${season.name}: ${seasonUrl}`)

  // Try different URL constructions
  const possibleUrls = []

  if (seasonUrl.startsWith('/')) {
    possibleUrls.push(`https://179.43.149.218/catalogue${seasonUrl}`)
  } else if (!seasonUrl.startsWith('http')) {
    // Try with animeId
    possibleUrls.push(`https://179.43.149.218/catalogue/${animeId}/${seasonUrl}`)
    // Try without animeId
    possibleUrls.push(`https://179.43.149.218/catalogue/${seasonUrl}`)
  } else {
    possibleUrls.push(seasonUrl)
  }

  for (const url of possibleUrls) {
    let testUrl = url
    if (!testUrl.endsWith('/')) {
      testUrl += '/'
    }

    console.log(`[SEASON_URL] Trying URL: ${testUrl}`)

    try {
      // First try to get episodes from the episodes.js file
      const episodesJsUrl = `${testUrl}episodes.js`
      console.log(`[SEASON_URL] Trying episodes.js URL: ${episodesJsUrl}`)

      const jsResponse = await axiosInstance.get(episodesJsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
        }
      })

      if (jsResponse.status >= 200 && jsResponse.status < 300) {
        const jsContent = jsResponse.data
        const episodeCount = countEpisodesInJs(jsContent)
        if (episodeCount > 0) {
          console.log(`[EPISODE_COUNT] Found ${episodeCount} episodes in JS file for ${season.name} at ${testUrl}`)
          return episodeCount
        }
      } else {
        console.log(`[SEASON_URL] episodes.js not found at ${episodesJsUrl} (status: ${jsResponse.status})`)
      }

      // Fallback to HTML parsing
      console.log(`[SEASON_URL] Falling back to HTML parsing for: ${testUrl}`)
      const response = await axiosInstance.get(testUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
        }
      })

      if (response.status >= 200 && response.status < 300) {
        const html = response.data
        const episodeCount = countEpisodesInSeason(html)
        if (episodeCount > 0) {
          console.log(`[EPISODE_COUNT] Found ${episodeCount} episodes in HTML for ${season.name} at ${testUrl}`)
          return episodeCount
        }
      } else {
        console.log(`[SEASON_URL] Season page not accessible at ${testUrl} (status: ${response.status})`)
      }
    } catch (error) {
      console.warn(`Failed to fetch from ${testUrl}:`, error)
    }
  }

  console.log(`[EPISODE_COUNT] No episodes found for ${season.name} after trying all URLs`)
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

  // Look for numbered episode links
  const episodeLinkPattern = /href="[^"]*\/(\d+)[^"]*"/g
  let match
  while ((match = episodeLinkPattern.exec(html)) !== null) {
    const num = parseInt(match[1])
    if (num > 0 && num < 1000) { // Reasonable episode number
      maxEpisode = Math.max(maxEpisode, num)
    }
  }

  console.log(`[EPISODE_COUNT_HTML] Max episode found: ${maxEpisode}`)
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

    console.log(`[EPISODE_COUNT_JS] Season ${seasonNum}: ${episodeCount} episodes in array`)

    // For now, just return the count from the first array we find
    // In the future, we might want to handle multiple seasons
    if (episodeCount > 0) {
      return episodeCount
    }
  }

  // Also try other patterns
  const altPatterns = [
    /eps\d*\s*=\s*\[([^\]]+)\]/g,
    /var\s+\w+\s*=\s*\[([^\]]+)\]/g
  ]

  for (const pattern of altPatterns) {
    let match
    while ((match = pattern.exec(jsContent)) !== null) {
      const urlsString = match[1]
      const urls = urlsString.split(',').filter(url => url.trim() && url.trim() !== '')
      const count = urls.length
      if (count > 0) {
        console.log(`[EPISODE_COUNT_JS] Found ${count} episodes with alt pattern`)
        return count
      }
    }
  }

  console.log(`[EPISODE_COUNT_JS] No episodes found in JS content`)
  return maxEpisode
}