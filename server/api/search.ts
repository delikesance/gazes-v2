import type { SearchResponse } from '#shared/types/searchResponse'
import { parseAnimeResults } from '#shared/utils/parsers'
import { cachedApiCall, generateSearchCacheKey, REDIS_CACHE_TTL } from '~/server/utils/redis-cache'

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
    const response = await fetch("https://anime-sama.fr/template-php/defaut/fetch.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
        },
        body: "query=" + encodeURIComponent(title),
        credentials: "include",
        mode: "cors"
    });

    const html = await response.text()
    return parseAnimeResults(html)
}
