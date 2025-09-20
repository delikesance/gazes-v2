import { parseAnimePage } from '#shared/utils/parsers'

export default defineEventHandler(async (event) => {
    const id = event.context.params?.id

    if (!id || typeof id !== 'string')
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Missing or invalid id parameter'
        })

    const response = await fetch("https://anime-sama.fr/catalogue/" + id, {
        "cache": "default",
        "credentials": "include",
        "headers": {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Priority": "u=0, i",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15"
        },
        "method": "GET",
        "mode": "cors",
        "redirect": "follow",
        "referrerPolicy": "strict-origin-when-cross-origin"
    })

    if (!response.ok) {
        throw createError({
            statusCode: response.status,
            statusMessage: response.statusText,
            message: `Failed to fetch anime details for id: ${id}`
        })
    }

    const html = await response.text()
    return parseAnimePage(html)
})