import type { SearchResponse } from '#shared/types/searchResponse'
import { parseAnimeResults } from '#shared/utils/parsers'

export default defineEventHandler(async (event): Promise<SearchResponse> => {
    const query = getQuery(event)

    if (!query.title || typeof query.title !== 'string')
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Missing title query parameter'
        })

    const response = await fetch("https://anime-sama.fr/template-php/defaut/fetch.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
        },
        body: "query=" + encodeURIComponent(query.title),
        credentials: "include",
        mode: "cors"
    });

    const html = await response.text()
    return parseAnimeResults(html)
})
