import { parseAnimePage, parseAnimeResults } from '#shared/utils/parsers'
import axios from 'axios'
import https from 'https'

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
})

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"

interface AniSkipResponse {
  found: boolean
  results: Array<{
    interval: {
      startTime: number
      endTime: number
    }
    skipType: 'op' | 'ed'
    skipId: string
    episodeLength: number
  }>
  message?: string
  statusCode?: number
}

async function getAnimeById(animeId: string): Promise<{ title: string } | null> {
  console.log(`⏭️ [API] Fetching anime info for ID/slug: ${animeId}`)

  // Try to fetch directly first (if it's a numeric ID)
  let response = await axiosInstance.get(`https://179.43.149.218/catalogue/${animeId}/`, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': USER_AGENT,
    }
  })

  // If direct fetch fails, try to search for the anime (slug-based lookup)
  if (response.status < 200 || response.status >= 300) {
    console.log(`⏭️ [API] Direct fetch failed, trying search for slug: ${animeId}`)
    const searchTerm = animeId.replace(/[-_]/g, ' ')

    const searchResponse = await axiosInstance.post("https://179.43.149.218/template-php/defaut/fetch.php", "query=" + encodeURIComponent(searchTerm), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      }
    })

    const searchResults = parseAnimeResults(searchResponse.data)

    if (searchResponse.status < 200 || searchResponse.status >= 300 || !searchResults || searchResults.length === 0) {
      console.log(`⏭️ [API] No search results found for: ${animeId}`)
      return null
    }

    // Use the first result's real ID
    if (!searchResults[0]?.id) {
      console.log(`⏭️ [API] No valid anime ID found in search results`)
      return null
    }

    const realAnimeId = searchResults[0].id
    console.log(`⏭️ [API] Found real anime ID from search: ${realAnimeId}`)

    response = await axiosInstance.get(`https://179.43.149.218/catalogue/${realAnimeId}/`, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': USER_AGENT,
      }
    })

    if (response.status < 200 || response.status >= 300) {
      console.log(`⏭️ [API] Failed to fetch anime page with real ID: ${response.status}`)
      return null
    }
  }

  const html = response.data
  const animeData = parseAnimePage(html)

  console.log(`⏭️ [API] Found anime: "${animeData.title}"`)
  return { title: animeData.title }
}

async function fetchSkipTimes(malId: string, episodeNumber: number, episodeLength?: number): Promise<{ skipTimes: Array<{ startTime: number, endTime: number, type: 'op' | 'ed' }> } | null> {
  try {
    console.log(`⏭️ [API] Fetching skip times for MAL ID ${malId}, episode ${episodeNumber}, length: ${episodeLength}`)

    let url = `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNumber}?types[]=op&types[]=ed`
    if (episodeLength) {
      url += `&episodeLength=${episodeLength}`
    }

    console.log(`⏭️ [API] AniSkip URL: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    })

    if (!response.ok) {
      console.log(`⏭️ [API] AniSkip API failed: ${response.status}`)
      return null
    }

    const data: AniSkipResponse = await response.json()
    console.log(`⏭️ [API] AniSkip response:`, data)

    if (!data.found || !data.results || data.results.length === 0) {
      console.log(`⏭️ [API] No skip times found`)
      return { skipTimes: [] }
    }

    const skipTimes = data.results.map(result => ({
      startTime: result.interval.startTime,
      endTime: result.interval.endTime,
      type: result.skipType
    }))

    console.log(`⏭️ [API] Processed ${skipTimes.length} skip times`)
    return { skipTimes }
  } catch (error) {
    console.error('⏭️ [API] Error fetching skip times:', error)
    return null
  }
}

export default defineEventHandler(async (event) => {
  try {
    const { id: animeId, episode: episodeNumber } = getRouterParams(event)
    if (!animeId || !episodeNumber) {
      throw createError({ statusCode: 400, statusMessage: 'Missing anime ID or episode number' })
    }
    const query = getQuery(event)
    const episodeLength = query.episodeLength ? parseFloat(query.episodeLength as string) : undefined

    console.log(`⏭️ [API] Skip request received - Anime ID: ${animeId}, Episode: ${episodeNumber}, Length: ${episodeLength}`)

    // Get anime info from anime-sama.fr
    const anime = await getAnimeById(animeId)
    if (!anime) {
      console.log(`⏭️ [API] Anime not found: ${animeId}`)
      throw createError({ statusCode: 404, statusMessage: 'Anime not found' })
    }

    console.log(`⏭️ [API] Found anime: "${anime.title}"`)

    // Get MAL ID
    const malId = await fetchMalId(anime.title) as string
    if (!malId) {
      console.log(`⏭️ [API] Could not find MAL ID for: "${anime.title}"`)
      throw createError({ statusCode: 404, statusMessage: 'MAL ID not found' })
    }

    console.log(`⏭️ [API] Using MAL ID: ${malId}`)

    // Fetch skip times from AniSkip
    const skipData = await fetchSkipTimes(malId, parseInt(episodeNumber), episodeLength)
    if (!skipData) {
      console.log(`⏭️ [API] No skip data found for MAL ID ${malId}, episode ${episodeNumber}`)
      return { skipTimes: [] }
    }

    console.log(`⏭️ [API] Returning skip data:`, skipData)
    return skipData

  } catch (error) {
    console.error('⏭️ [API] Error in skip endpoint:', error)
    throw error
  }
})

async function fetchMalId(animeTitle: string): Promise<string | null> {
  try {
    // Clean the title for search
    const cleanTitle = animeTitle.replace(/ \(.*\)$/g, '') // Remove parenthetical info
    const keyword = encodeURIComponent(cleanTitle)

    const searchUrl = `https://myanimelist.net/search/prefix.json?type=anime&keyword=${keyword}`
    console.log(`⏭️ [API] Searching MAL with keyword: "${cleanTitle}" -> URL: ${searchUrl}`)
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    })

    if (!response.ok) {
      console.error(`⏭️ [API] MAL search failed: ${response.status}`)
      return null
    }

    const data = await response.json()
    console.log(`⏭️ [API] MAL search returned ${data.categories?.[0]?.items?.length || 0} results`)

    if (!data.categories || !data.categories[0] || !data.categories[0].items || data.categories[0].items.length === 0) {
      console.log(`⏭️ [API] No MAL results found`)
      return null
    }

    // Find the best match - prefer TV series over movies/specials
    const items = data.categories[0].items

    // First, try exact title match
    let bestMatch = items.find((item: any) =>
      item.name.toLowerCase() === cleanTitle.toLowerCase()
    )

    // If no exact match, prefer TV series (exclude films, specials, etc.)
    if (!bestMatch) {
      const tvSeries = items.filter((item: any) =>
        !item.name.toLowerCase().includes('film') &&
        !item.name.toLowerCase().includes('movie') &&
        !item.name.toLowerCase().includes('special') &&
        !item.name.toLowerCase().includes('ova') &&
        !item.name.toLowerCase().includes('rewrite') &&
        !item.name.toLowerCase().includes('relight')
      )

      bestMatch = tvSeries.find((item: any) =>
        item.name.toLowerCase().includes(cleanTitle.toLowerCase().split(' ')[0])
      ) || tvSeries[0] || items[0]
    }

    console.log(`⏭️ [API] Selected MAL entry: "${bestMatch.name}" (ID: ${bestMatch.id})`)
    return bestMatch.id.toString()

  } catch (error) {
    console.error('⏭️ [API] Error fetching MAL ID:', error)
    return null
  }
}