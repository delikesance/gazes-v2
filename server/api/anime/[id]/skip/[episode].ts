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
  const config = useRuntimeConfig()
  const catalogueApiUrl = config.catalogueApiUrl as string
  const searchApiUrl = config.searchApiUrl as string

  // Try to fetch directly first (if it's a numeric ID)
  let response = await axiosInstance.get(`${catalogueApiUrl}/catalogue/${animeId}/`, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': USER_AGENT,
    }
  })

  // If direct fetch fails, try to search for the anime (slug-based lookup)
  if (response.status < 200 || response.status >= 300) {
    const searchTerm = animeId.replace(/[-_]/g, ' ')

    const searchResponse = await axiosInstance.post(searchApiUrl, "query=" + encodeURIComponent(searchTerm), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      }
    })

    const searchResults = parseAnimeResults(searchResponse.data, catalogueApiUrl)

    if (searchResponse.status < 200 || searchResponse.status >= 300 || !searchResults || searchResults.length === 0) {
      return null
    }

    // Use the first result's real ID
    if (!searchResults[0]?.id) {
      return null
    }

    const realAnimeId = searchResults[0].id

    response = await axiosInstance.get(`${catalogueApiUrl}/catalogue/${realAnimeId}/`, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': USER_AGENT,
      }
    })

    if (response.status < 200 || response.status >= 300) {
      return null
    }
  }

  const html = response.data
  const animeData = parseAnimePage(html)

  return { title: animeData.title }
}

async function fetchSkipTimes(malId: string, episodeNumber: number, episodeLength?: number): Promise<{ skipTimes: Array<{ startTime: number, endTime: number, type: 'op' | 'ed' }> } | null> {
  try {

    let url = `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNumber}?types[]=op&types[]=ed`
    if (episodeLength) {
      url += `&episodeLength=${episodeLength}`
    }


    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    })

    if (!response.ok) {
      return null
    }

    const data: AniSkipResponse = await response.json()

    if (!data.found || !data.results || data.results.length === 0) {
      return { skipTimes: [] }
    }

    const skipTimes = data.results.map(result => ({
      startTime: result.interval.startTime,
      endTime: result.interval.endTime,
      type: result.skipType
    }))

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


    // Get anime info from anime-sama.fr
    const anime = await getAnimeById(animeId)
    if (!anime) {
      throw createError({ statusCode: 404, statusMessage: 'Anime not found' })
    }


    // Get MAL ID
    const malId = await fetchMalId(anime.title) as string
    if (!malId) {
      throw createError({ statusCode: 404, statusMessage: 'MAL ID not found' })
    }


    // Fetch skip times from AniSkip
    const skipData = await fetchSkipTimes(malId, parseInt(episodeNumber), episodeLength)
    if (!skipData) {
      return { skipTimes: [] }
    }

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

    if (!data.categories || !data.categories[0] || !data.categories[0].items || data.categories[0].items.length === 0) {
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

    return bestMatch.id.toString()

  } catch (error) {
    console.error('⏭️ [API] Error fetching MAL ID:', error)
    return null
  }
}