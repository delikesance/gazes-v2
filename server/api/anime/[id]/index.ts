import { parseAnimePage, parseAnimeResults } from '#shared/utils/parsers'

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"

export default defineEventHandler(async (event) => {
    const id = event.context.params?.id

    if (!id || typeof id !== 'string')
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Missing or invalid id parameter'
        })

    // Try to fetch directly first
    let response = await fetch(`https://anime-sama.fr/catalogue/${id}/`, {
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': USER_AGENT,
        },
        redirect: 'follow',
    })

    // If direct fetch fails, try to search for the anime
    if (!response.ok) {
        const searchTerm = id.replace(/[-_]/g, ' ')
        
        const searchResponse = await fetch("https://anime-sama.fr/template-php/defaut/fetch.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest"
            },
            body: "query=" + encodeURIComponent(searchTerm),
        })

        const searchResults = parseAnimeResults(await searchResponse.text())

        if (!searchResponse.ok || !searchResults || searchResults.length === 0) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Not Found',
                message: `No anime found for id: ${id}`
            })
        }

        // Use the first result's real ID
        const realAnimeId = searchResults[0].id
        response = await fetch(`https://anime-sama.fr/catalogue/${realAnimeId}/`, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': USER_AGENT,
            },
            redirect: 'follow',
        })

        if (!response.ok) {
            throw createError({
                statusCode: response.status,
                statusMessage: response.statusText,
                message: `Failed to fetch anime details for id: ${id}`
            })
        }
    }

    const html = await response.text()
    const animeData = parseAnimePage(html)

    // Scrape language flags from the first available season
    if (animeData.seasons && animeData.seasons.length > 0) {
        const firstSeason = animeData.seasons[0]
        let seasonUrl = firstSeason.url
        
        if (seasonUrl.startsWith('/')) {
            seasonUrl = `https://anime-sama.fr/catalogue${seasonUrl}`
        } else if (!seasonUrl.startsWith('http')) {
            seasonUrl = `https://anime-sama.fr/catalogue/${id}/${seasonUrl}`
        }

        try {
            const seasonResponse = await fetch(seasonUrl, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': USER_AGENT,
                },
                redirect: 'follow',
            })

            if (seasonResponse.ok) {
                const seasonHtml = await seasonResponse.text()
                const languageFlags = parseLanguageFlags(seasonHtml)
                return { ...animeData, languageFlags }
            }
        } catch (error) {
            // Silent fail for language flags
        }
    }

    return animeData
})

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
        const emoji = flagToEmoji[flagCode] || '🏳️'
        
        if (langCode && flagCode) {
            flags[langCode] = emoji
        }
    }

    return flags
}