import { parseAnimePage } from '#shared/utils/parsers'

export default defineEventHandler(async (event) => {
    const id = event.context.params?.id

    if (!id || typeof id !== 'string')
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Missing or invalid id parameter'
        })

    const response = await fetch("https://anime-sama.fr/catalogue/" + id + "/", {
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
    const animeData = parseAnimePage(html)

    // Scrape language flags from the first available season
    if (animeData.seasons && animeData.seasons.length > 0) {
        const firstSeason = animeData.seasons[0]
        if (!firstSeason?.url) {
            return animeData
        }
        // Build the season URL correctly - anime-sama.fr uses this format: /catalogue/anime-id/season-path
        let seasonUrl = firstSeason.url
        if (seasonUrl.startsWith('/')) {
            seasonUrl = `https://anime-sama.fr/catalogue${seasonUrl}`
        } else if (!seasonUrl.startsWith('http')) {
            seasonUrl = `https://anime-sama.fr/catalogue/${id}/${seasonUrl}`
        }

        console.log(`🔍 Scraping language flags from: ${seasonUrl}`)

        try {
            const seasonResponse = await fetch(seasonUrl, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
                },
                redirect: 'follow',
                referrerPolicy: 'strict-origin-when-cross-origin',
            })

            if (seasonResponse.ok) {
                const seasonHtml = await seasonResponse.text()
                const languageFlags = parseLanguageFlags(seasonHtml)
                console.log(`🏳️ Extracted language flags:`, languageFlags)
                return { ...animeData, languageFlags }
            } else {
                console.warn(`❌ Failed to fetch season page: ${seasonResponse.status} ${seasonResponse.statusText}`)
            }
        } catch (error) {
            console.warn('❌ Failed to scrape language flags:', error)
        }
    }

    return animeData
})

// Function to parse language flags from season page HTML
function parseLanguageFlags(html: string): Record<string, string> {
    const flags: Record<string, string> = {}

    // Dynamic flag mapping based on anime-sama.fr flag images
    const flagToEmoji: Record<string, string> = {
        'cn': '🇨🇳', // China
        'jp': '🇯🇵', // Japan  
        'kr': '🇰🇷', // Korea
        'fr': '🇫🇷', // France
        'en': '🇺🇸', // English (USA)
        'us': '🇺🇸', // USA
        'qc': '🇨🇦', // Quebec/Canada
        'sa': '🇸🇦', // Saudi Arabia (Arabic)
        'ar': '🇸🇦', // Arabic
        'de': '🇩🇪', // Germany
        'es': '🇪🇸', // Spain
        'it': '🇮🇹', // Italy
        'pt': '🇵🇹', // Portugal
        'br': '🇧🇷', // Brazil
        'ru': '🇷🇺', // Russia
        'tr': '🇹🇷', // Turkey
        'th': '🇹🇭', // Thailand
        'in': '🇮🇳', // India
        'mx': '🇲🇽', // Mexico
        'nl': '🇳🇱', // Netherlands
        'se': '🇸🇪', // Sweden
        'no': '🇳🇴', // Norway
        'dk': '🇩🇰', // Denmark
        'fi': '🇫🇮', // Finland
        'pl': '🇵🇱', // Poland
        'cz': '🇨🇿', // Czech Republic
        'hu': '🇭🇺', // Hungary
        'ro': '🇷🇴', // Romania
        'bg': '🇧🇬', // Bulgaria
        'gr': '🇬🇷', // Greece
        'il': '🇮🇱', // Israel
        'ae': '🇦🇪', // UAE
        'eg': '🇪🇬', // Egypt
        'za': '🇿🇦', // South Africa
        'ng': '🇳🇬', // Nigeria
        'au': '🇦🇺', // Australia
        'nz': '🇳🇿', // New Zealand
        'sg': '🇸🇬', // Singapore
        'my': '🇲🇾', // Malaysia
        'id': '🇮🇩', // Indonesia
        'ph': '🇵🇭', // Philippines
        'vn': '🇻🇳', // Vietnam
        'mm': '🇲🇲', // Myanmar
        'kh': '🇰🇭', // Cambodia
        'la': '🇱🇦', // Laos
    }

    // First, collect all flag images from the page, regardless of language context
    const flagImages: Record<string, string> = {}
    const flagImageRegex = /<img[^>]*src="[^"]*flag_([^"\.]+)(?:\.png|\.jpg|\.jpeg|\.gif|\.webp)"[^>]*>/gi
    let imageMatch

    while ((imageMatch = flagImageRegex.exec(html)) !== null) {
        const flagCode = imageMatch[1]?.toLowerCase() // e.g., 'cn', 'jp', 'fr', 'en', 'x'
        const emoji = flagCode ? (flagToEmoji[flagCode] || '🏳️') : '🏳️' // Use generic flag if unknown
        if (flagCode) {
            flagImages[flagCode] = emoji
        }
    }

    // Now extract language mappings from links/tabs and match them with available flags
    const langRegex = /<a href="\.\.\/([^"]+)"[^>]*id="switch[^"]*"[^>]*>/gi
    let langMatch

    while ((langMatch = langRegex.exec(html)) !== null) {
        const langCode = langMatch[1] // e.g., 'vostfr', 'vf', 'va', 'vj'
        if (!langCode) continue
        
        // For language mapping, try to find the best match from available flags
        // Priority: exact language mapping > fallback mapping > first available flag
        let assignedEmoji = '🏳️'
        
        if (langCode === 'vostfr' || langCode === 'vost') {
            // For VOSTFR, use Chinese flag if available, or first Asian flag
            assignedEmoji = flagImages['cn'] || flagImages['jp'] || flagImages['kr'] || Object.values(flagImages)[0] || '🇨🇳'
        } else if (langCode === 'vf' || langCode === 'vf1' || langCode === 'vf2') {
            assignedEmoji = flagImages['fr'] || '🇫🇷'
        } else if (langCode === 'va') {
            assignedEmoji = flagImages['us'] || flagImages['en'] || '🇺🇸'
        } else if (langCode === 'vj') {
            assignedEmoji = flagImages['jp'] || '🇯🇵'
        } else if (langCode === 'vkr') {
            assignedEmoji = flagImages['kr'] || '🇰🇷'
        } else if (langCode === 'vcn') {
            assignedEmoji = flagImages['cn'] || '🇨🇳'
        } else if (langCode === 'vqc') {
            assignedEmoji = flagImages['qc'] || '🇨🇦'
        } else if (langCode === 'var') {
            assignedEmoji = flagImages['ar'] || flagImages['sa'] || '🇸�'
        } else {
            // For unknown languages, use the first available flag or a generic one
            assignedEmoji = Object.values(flagImages)[0] || '🏳️'
        }
        
        flags[langCode] = assignedEmoji
    }

    return flags
}