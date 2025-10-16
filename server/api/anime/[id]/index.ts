import { parseAnimePage, parseAnimeResults } from '#shared/utils/parsers'
import { cachedApiCall, REDIS_CACHE_TTL } from '~/server/utils/redis-cache'
import axios from 'axios'
import https from 'https'

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
})

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"

export default defineEventHandler(async (event) => {
    const id = event.context.params?.id

    if (!id || typeof id !== 'string')
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Missing or invalid id parameter'
        })

    // Generate cache key for this anime
    const cacheKey = `anime:detail:${id}`

    // Use Redis caching with background refresh
    return cachedApiCall(cacheKey, async () => {
        return fetchAnimeDetails(id)
    }, REDIS_CACHE_TTL.ANIME_DETAILS)
})

// Extract the actual anime fetching logic into a separate function
async function fetchAnimeDetails(id: string) {

    const config = useRuntimeConfig()
    const catalogueApiUrl = config.catalogueApiUrl as string
    const searchApiUrl = config.searchApiUrl as string

    // Try to fetch directly first
    let response = await axiosInstance.get(`${catalogueApiUrl}/catalogue/${id}/`, {
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': USER_AGENT,
        }
    })

    // If direct fetch fails, try to search for the anime
    if (response.status < 200 || response.status >= 300) {
        const searchTerm = id.replace(/[-_]/g, ' ')

        const searchResponse = await axiosInstance.post(searchApiUrl, "query=" + encodeURIComponent(searchTerm), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest"
            }
        })

        const searchResults = parseAnimeResults(searchResponse.data, catalogueApiUrl)

        if (searchResponse.status < 200 || searchResponse.status >= 300 || !searchResults || searchResults.length === 0) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Not Found',
                message: `No anime found for id: ${id}`
            })
        }

        // Use the first result's real ID
        if (!searchResults[0]?.id) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Not Found',
                message: `No valid anime found for id: ${id}`
            })
        }
        const realAnimeId = searchResults[0].id
        response = await axiosInstance.get(`${catalogueApiUrl}/catalogue/${realAnimeId}/`, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': USER_AGENT,
            }
        })

        if (response.status < 200 || response.status >= 300) {
            throw createError({
                statusCode: response.status,
                statusMessage: response.statusText,
                message: `Failed to fetch anime details for id: ${id}`
            })
        }
    }

    const html = response.data
    const animeData = parseAnimePage(html)

    // Scrape language flags from the first available season (with timeout for speed)
    if (animeData.seasons && animeData.seasons.length > 0) {
        const firstSeason = animeData.seasons[0]
        if (!firstSeason?.url) {
            return animeData
        }
        let seasonUrl = firstSeason.url

        if (seasonUrl.startsWith('/')) {
            seasonUrl = `${catalogueApiUrl}/catalogue${seasonUrl}`
        } else if (!seasonUrl.startsWith('http')) {
            seasonUrl = `${catalogueApiUrl}/catalogue/${id}/${seasonUrl}`
        }

        try {
            // Add timeout for language flags scraping to avoid slow loading
            const seasonResponse = await axiosInstance.get(seasonUrl, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': USER_AGENT,
                },
                timeout: 3000
            })

            if (seasonResponse.status >= 200 && seasonResponse.status < 300) {
                const seasonHtml = seasonResponse.data
                const languageFlags = parseLanguageFlags(seasonHtml)
                return { ...animeData, languageFlags }
            }
        } catch (error) {
            // Silent fail for language flags - don't let this slow down the main response
        }
    }

    return animeData
}

// Function to parse language flags from season page HTML
function parseLanguageFlags(html: string): Record<string, string> {
    const flags: Record<string, string> = {}

    // Simplified flag mapping for common anime languages
    const flagToEmoji: Record<string, string> = {
        'cn': '🇨🇳',
        'jp': '🇯🇵',
        'kr': '🇰🇷',
        'fr': '🇫🇷',
        'en': '🇺🇸',
        'us': '🇺🇸',
        'qc': '🇨🇦',
        'ar': '🇸🇦',
        'x': '🇯🇵', // Original version
    }

    // Extract language buttons
    const buttonRegex = /<a\s+href="\.\.\/([^"]+)"[^>]*id="switch[^"]*"[^>]*>[\s\S]*?<img[^>]*src="[^"]*flag_([^"\.]+)\.png"[^>]*>[\s\S]*?<\/a>/gi
    let match

    while ((match = buttonRegex.exec(html)) !== null) {
        const langCode = match[1]
        const flagCode = match[2]?.toLowerCase()
        const emoji = flagCode ? (flagToEmoji[flagCode] || '🏳️') : '🏳️'
        
        if (langCode && flagCode) {
            flags[langCode] = emoji
        }
    }

    return flags
}