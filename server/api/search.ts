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
    const response = await axiosInstance.post("https://179.43.149.218/template-php/defaut/fetch.php", "query=" + encodeURIComponent(title), {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
        }
    });

    const html = response.data
    return parseAnimeResults(html)
}
