import type { SearchResponse } from '#shared/types/searchResponse'
import { parseAnimeResults } from '#shared/utils/parsers'
import { cachedApiCall, generateSearchCacheKey, REDIS_CACHE_TTL } from '~/server/utils/redis-cache'
import axios from 'axios'
import https from 'https'

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
})

export default defineEventHandler(async (event): Promise<SearchResponse> => {
    const query = getQuery(event)

    if (!query.title || typeof query.title !== 'string')
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Missing title query parameter'
        })

    // Generate cache key for this search query
    const cacheKey = generateSearchCacheKey(query.title)

    // Use Redis caching with background refresh
    return cachedApiCall(cacheKey, async () => {
        return performSearch(query.title as string)
    }, REDIS_CACHE_TTL.SEARCH)
})

// Extract the actual search logic into a separate function
async function performSearch(title: string): Promise<SearchResponse> {
    const config = useRuntimeConfig()
    const searchApiUrl = config.searchApiUrl as string

    console.log(`[SEARCH_API] Searching for: "${title}" using URL: ${searchApiUrl}`)

    try {
        const response = await axiosInstance.post(searchApiUrl, "query=" + encodeURIComponent(title), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        console.log(`[SEARCH_API] Response status: ${response.status}, data length: ${response.data?.length || 0}`)

        const html = response.data
        // Extract base URL from searchApiUrl for parsing
        const baseUrl = searchApiUrl.replace('/template-php/defaut/fetch.php', '')
        const results = parseAnimeResults(html, baseUrl)

        console.log(`[SEARCH_API] Parsed ${results.length} results for "${title}"`)

        return results
    } catch (error: any) {
        console.error(`[SEARCH_API] Search failed for "${title}":`, error.message)
        throw error
    }
}
