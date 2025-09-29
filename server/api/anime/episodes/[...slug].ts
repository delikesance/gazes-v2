import { preferNonBlacklisted, isBlacklisted, hostnameOf } from '~/shared/utils/hosts'
import { defineEventHandler, getQuery, createError } from 'h3'
import { cachedFetch, CACHE_TTL } from '~/server/utils/cache'
// Function to scrape episode titles from anime-sama main page
async function scrapeEpisodeTitlesFromMainPage(animeId: string, season: string, lang: string): Promise<Record<number, string>> {
    console.log('Starting title scraping for:', animeId, season, lang)

    // For films/movies, we need to scrape titles from newSPF() calls
    const isFilm = season.toLowerCase().includes('film') || season.toLowerCase().includes('movie')

    // For regular episodes, skip expensive scraping since they rarely have real titles
    if (!isFilm) {
        console.log('Skipping title scraping for regular episodes (not a film)')
        return {}
    }

    const titles: Record<number, string> = {}

    // For films, only fetch the language-specific page where newSPF() calls are located
    console.log('Fetching film titles from lang page:', `https://anime-sama.fr/catalogue/${encodeURIComponent(animeId)}/${encodeURIComponent(season)}/${encodeURIComponent(lang)}/`)
    const titlesCacheKey = `anime-episodes-titles:${animeId}:${season}:${lang}`

    const langPageRes = await cachedFetch(titlesCacheKey, async () => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 4000) // 4 second timeout

        const res = await fetch(`https://anime-sama.fr/catalogue/${encodeURIComponent(animeId)}/${encodeURIComponent(season)}/${encodeURIComponent(lang)}/`, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
            },
            redirect: 'follow',
            referrerPolicy: 'strict-origin-when-cross-origin',
            signal: controller.signal
        })

        clearTimeout(timeoutId)
        return res
    }, 60 * 1000) // 1 minute TTL for titles

    if (langPageRes.ok) {
        const langPageHtml = await langPageRes.text()
        console.log('Film page HTML length:', langPageHtml.length)

        // For films, only look for newSPF() calls - much simpler and faster
        const newSPFMatches = langPageHtml.match(/newSPF\("([^"]+)"\)/gi)
        if (newSPFMatches) {
            newSPFMatches.forEach((match, index) => {
                const titleMatch = match.match(/newSPF\("([^"]+)"\)/)
                if (titleMatch && titleMatch[1]) {
                    const title = (titleMatch[1] as string).trim()
                    if (title && title.length >= 3 && title.length <= 200) {
                        const episodeNum = index + 1
                        titles[episodeNum] = title
                    }
                }
            })
        }
        console.log('Found film titles:', Object.keys(titles).length, titles)
        console.log('Found film titles:', Object.keys(titles).length, titles)
    }
    return titles
}

// Function to extract episode titles from HTML content
function extractEpisodeTitles(html: string): Record<number, string> {
    console.log('extractEpisodeTitles called with HTML length:', html.length)
    console.log('HTML contains newSPF:', html.includes('newSPF'))
    const titles: Record<number, string> = {}

    try {
        // Special handling for newSPF() function calls (films on anime-sama) - run this first
        const newSPFMatches = html.match(/newSPF\("([^"]+)"\)/gi)
        if (newSPFMatches) {
            newSPFMatches.forEach((match, index) => {
                const titleMatch = match.match(/newSPF\("([^"]+)"\)/)
                if (titleMatch && titleMatch[1]) {
                    const title = (titleMatch[1] as string).trim()
                    if (title && title.length >= 3 && title.length <= 200) {
                        const episodeNum = index + 1
                        // Clean up the title
                        let cleanTitle = title
                            .replace(/\s+/g, ' ') // normalize whitespace
                            .replace(/&nbsp;/g, ' ') // replace HTML entities
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'")
                            .replace(/\s*\([^)]*\)\s*$/, '') // remove trailing parentheses
                            .replace(/\s*\[[^\]]*\]\s*$/, '') // remove trailing brackets
                            .replace(/\s*(vostfr|vf|french|english|sub|dub)\s*$/i, '') // remove language indicators

                        // Set the title (newSPF takes priority)
                        titles[episodeNum] = cleanTitle
                    }
                }
            })
        }

        // Enhanced patterns for anime-sama specific structures
        const episodePatterns: RegExp[] = [
            // Pattern for anime-sama episode lists in HTML
            /<div[^>]*class="[^"]*episode[^"]*"[^>]*>[\s\S]*?(\d+)[\s\S]*?[-:]\s*([^<>]+?)(?:<|$)/gi,
            // Pattern for "Episode X - Title" or "Episode X: Title"
            /(?:Episode|Épisode)\s*(\d+)\s*[-:]\s*([^\n\r<>]{3,}?)(?:\n|<|$)/gi,
            // Pattern for numbered lists "X - Title" or "X. Title"
            /(?:^|\n)\s*(\d+)\s*[-\.]\s*([^\n\r<>]{3,}?)(?:\n|<|$)/gm,
            // Pattern for HTML select options
            /<option[^>]*>(?:Episode\s*)?(\d+)[^<>]*[-:]\s*([^<>]{3,}?)<\/option>/gi,
            // Pattern for list items
            /<li[^>]*>(?:Episode\s*)?(\d+)[^<>]*[-:]\s*([^<>]{3,}?)<\/li>/gi,
            // Pattern for table rows or divs with episode data
            /<(?:tr|div)[^>]*>[\s\S]*?(?:Episode\s*)?(\d+)[\s\S]*?[-:]\s*([^<>]{3,}?)(?:<\/(?:tr|div)|$)/gi,
            // Pattern for span or p elements with episode titles
            /<(?:span|p)[^>]*>(?:Episode\s*)?(\d+)[^<>]*[-:]\s*([^<>]{3,}?)<\/(?:span|p)>/gi,
            // Pattern for anime-sama specific episode links or buttons
            /<a[^>]*>[\s\S]*?(?:Episode\s*)?(\d+)[\s\S]*?[-:]\s*([^<>]{3,}?)[\s\S]*?<\/a>/gi,
            // Pattern for episode titles in comments or meta descriptions
            /<!--[\s\S]*?(?:Episode\s*)?(\d+)[\s\S]*?[-:]\s*([^-]{3,}?)[\s\S]*?-->/gi
        ]

        for (const pattern of episodePatterns) {
            let match
            while ((match = pattern.exec(html)) !== null) {
                if (!match[1] || !match[2]) continue
                const episodeNum = parseInt(match[1])
                let title = match[2].trim()
                    .replace(/\s+/g, ' ') // normalize whitespace
                    .replace(/^[-:\s\u00A0]+|[-:\s\u00A0]+$/g, '') // trim separators and nbsp
                    .replace(/&nbsp;/g, ' ') // replace HTML entities
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")

                // Clean up common unwanted text
                title = title
                    .replace(/\s*\([^)]*\)\s*$/, '') // remove trailing parentheses
                    .replace(/\s*\[[^\]]*\]\s*$/, '') // remove trailing brackets
                    .replace(/^(Episode|Épisode)\s*\d+\s*[-:]?\s*/i, '') // remove episode prefix
                    .replace(/\s*(vostfr|vf|french|english|sub|dub)\s*$/i, '') // remove language indicators
                    .replace(/\s*-\s*$/, '') // remove trailing dash

                if (episodeNum > 0 && title && title.length >= 3 && title.length <= 200) {
                    // Skip obvious garbage titles (very short, only symbols, etc.)
                    const isGarbage = title.length < 5 ||
                                     /^[^a-zA-Z]*$/.test(title) || // no letters at all
                                     /^[0-9\s\-\.]+$/.test(title) || // only numbers, spaces, dashes, dots
                                     /^[^\w\s]*$/.test(title) // only symbols
                    
                    if (!isGarbage) {
                        // Only set if we don't already have a newSPF title (newSPF takes absolute priority)
                        // Also only allow reasonable episode numbers (1-1000)
                        if (episodeNum <= 1000 && !titles[episodeNum]) {
                            titles[episodeNum] = title
                        }
                    }
                }
            }
        }

        // Pattern for JavaScript arrays or objects with episode titles
        const jsPatterns = [
            /(?:var|let|const)\s+(?:titles?|episodes?|names?|eps_titles?)\s*=\s*\[([\s\S]*?)\]/gi,
            /(?:titles?|episodes?|names?|eps_titles?)\s*:\s*\[([\s\S]*?)\]/gi,
            // Pattern for anime-sama specific title arrays
            /eps_titles\s*=\s*\[([\s\S]*?)\]/gi
        ]

        for (const jsPattern of jsPatterns) {
            let jsMatch
            while ((jsMatch = jsPattern.exec(html)) !== null) {
                const content = jsMatch[1]
                if (!content) continue
                const titleMatches = content.match(/["']([^"']{3,100}?)["']/g)
                if (titleMatches) {
                    titleMatches.forEach((match, index) => {
                        const title = match.slice(1, -1).trim() // remove quotes
                        if (title &&
                            !title.match(/^https?:\/\//) &&
                            !title.match(/^\d+$/) &&
                            !title.match(/^(var|let|const|function)/) &&
                            title.length >= 3) {
                            const episodeNum = index + 1
                            if (!titles[episodeNum] || titles[episodeNum].length < title.length) {
                                titles[episodeNum] = title
                            }
                        }
                    })
                }
            }
        }

        // Look for structured data or meta information
        const metaPatterns = [
            /<meta[^>]*(?:name|property)=["'](?:description|episode)["'][^>]*content=["']([^"']*(?:Episode|Épisode)\s*\d+[^"']*)["']/gi,
            /"name":\s*"([^"]*(?:Episode|Épisode)\s*\d+[^"]*)"[^}]*"episodeNumber":\s*(\d+)/gi,
            // Pattern for JSON-LD structured data
            /"episode":\s*\[[\s\S]*?"name":\s*"([^"]+)"[\s\S]*?"episodeNumber":\s*(\d+)/gi
        ]

        for (const metaPattern of metaPatterns) {
            let metaMatch
            while ((metaMatch = metaPattern.exec(html)) !== null) {
                const content = metaMatch[1]
                if (!content) continue
                const episodeMatch = content.match(/(?:Episode|Épisode)\s*(\d+)[-:\s]*(.+)/i)
                if (episodeMatch && episodeMatch[1] && episodeMatch[2]) {
                    const episodeNum = parseInt(episodeMatch[1])
                    const title = episodeMatch[2].trim()
                    if (episodeNum > 0 && title && title.length >= 3) {
                        if (!titles[episodeNum] || titles[episodeNum].length < title.length) {
                            titles[episodeNum] = title
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.warn('Error extracting episode titles:', error)
    }

    return titles
}

// Generate a simple fallback title when none is found
function generateFallbackTitle(animeId: string, season: string, episodeNum: number): string | undefined {
    // For films/movies, generate movie-style titles
    if (season.toLowerCase().includes('film') || season.toLowerCase().includes('movie')) {
        const animeNameFormatted = animeId
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        return `${animeNameFormatted} - Film ${episodeNum}`
    }

    // For OVA/Specials
    if (season.toLowerCase().includes('ova') || season.toLowerCase().includes('special')) {
        const animeNameFormatted = animeId
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        return `${animeNameFormatted} - OVA ${episodeNum}`
    }

    // For regular episodes, generate a meaningful title using the anime name
    const animeNameFormatted = animeId
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    return `${animeNameFormatted} - Episode ${episodeNum}`
}

export default defineEventHandler(async (event) => {
    const params = event.context.params as Record<string, string | string[]>
    const slugString = params.slug as string
    const slug = slugString.split('/')
    console.log('Slug parameter:', slug)
    const query = getQuery(event)
    const debug = query.debug === 'true'

    // Parse the slug: [id, season, lang]
    if (!slug || slug.length !== 3) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: `Invalid path. Expected format: /api/anime/episodes/[id]/[season]/[lang]. Got slug: ${JSON.stringify(slug)}`
        })
    }

    const [id, season, lang] = slug

    if (!id || !season || !lang) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Missing required parameters: id, season, and lang are required'
        })
    }

    // Convert season number to anime-sama format (1 -> saison1, film -> film, etc.)
    const seasonFormatted = /^\d+$/.test(season) ? `saison${season}` : season

    // Scrape episode titles from anime-sama main page
    const episodeTitles = await scrapeEpisodeTitlesFromMainPage(id, seasonFormatted, lang)

    // First, try to fetch episode lists from the episodes.js file
    const jsUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(id)}/${encodeURIComponent(seasonFormatted)}/${encodeURIComponent(lang)}/episodes.js`
    let sourceText = ''
    const jsCacheKey = `anime-episodes-js:${id}:${seasonFormatted}:${lang}`

    try {
        const jsRes = await cachedFetch(jsCacheKey, async () => {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout

            const res = await fetch(jsUrl, {
                headers: {
                    'Accept': '*/*',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
                },
                redirect: 'follow',
                referrerPolicy: 'strict-origin-when-cross-origin',
                signal: controller.signal
            })

            clearTimeout(timeoutId)
            return res
        }, 60 * 1000) // 1 minute TTL

        if (jsRes.ok) {
            const jsText = await jsRes.text()
            if (jsText && jsText.trim()) {
                sourceText = jsText
            }
        }
    } catch {}

    // If episodes.js didn't work, try the main season page
    if (!sourceText) {
        const seasonUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(id)}/${encodeURIComponent(seasonFormatted)}/${encodeURIComponent(lang)}/`
        const seasonCacheKey = `anime-episodes-page:${id}:${seasonFormatted}:${lang}`

        try {
            const res = await cachedFetch(seasonCacheKey, async () => {
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 4000) // 4 second timeout

                const response = await fetch(seasonUrl, {
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
                    },
                    redirect: 'follow',
                    referrerPolicy: 'strict-origin-when-cross-origin',
                    signal: controller.signal
                })

                clearTimeout(timeoutId)
                return response
            }, 60 * 1000) // 1 minute TTL

            if (res.ok) {
                sourceText = await res.text()
            }
        } catch {}
    }

    if (!sourceText) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Not Found',
            message: `Unable to fetch episode data for ${id}/${seasonFormatted}/${lang}`
        })
    }

    // Parse episodes from JavaScript arrays
    // Split by 'var eps' to get each array definition
    const epsBlocks = sourceText.split(/var\s+eps/).slice(1) // slice(1) to skip the first empty part
    const matches = []

    for (const block of epsBlocks) {
        // Extract the array content between [ and ] (multiline)
        const arrayMatch = block.match(/=\s*\[([\s\S]*?)\]/)
        if (arrayMatch) {
            matches.push(arrayMatch[1])
        }
    }

    let episodes: any[] = []

    if (matches.length > 0) {
        // Parse each eps array (eps1, eps2, eps3, etc.)
        const epsArrays: string[][] = matches.map(arrayContent => 
            arrayContent ? arrayContent.split(',').map(url => url.trim().replace(/['"]/g, '')).filter(url => url.length > 0) : []
        )

        // Create episodes using sequential numbering
        // Combine URLs from all providers for each episode
        const maxEpisodes = Math.max(...epsArrays.map(arr => arr.length))

        for (let episodeNum = 1; episodeNum <= maxEpisodes; episodeNum++) {
            const urls: string[] = []

            // Collect URLs from all eps arrays for this episode
            epsArrays.forEach(epsArray => {
                if (epsArray[episodeNum - 1]) {
                    urls.push(epsArray[episodeNum - 1] as string)
                }
            })

            if (urls.length > 0) {
                // Filter out blacklisted URLs
                const nonBlacklisted = urls.filter(url => !isBlacklisted(url))
                const providers = Array.from(new Set(urls.map(hostnameOf)))
                const primary = preferNonBlacklisted(urls)
                const urlsToUse = nonBlacklisted.length > 0 ? nonBlacklisted : urls

                // Get episode title if available
                const title = episodeTitles[episodeNum] || generateFallbackTitle(id, season, episodeNum)

                episodes.push({
                    episode: episodeNum,
                    title,
                    url: primary,
                    urls: urlsToUse,
                    providers
                })
            }
        }
    } else {
        // Fallback: treat as single array
        const arrayMatch = sourceText.match(/\[([^\]]+)\]/)
        if (!arrayMatch || !arrayMatch[1]) {
            throw createError({ statusCode: 502, statusMessage: 'Bad Gateway', message: 'No eps arrays found in source' })
        }

        const urls = arrayMatch[1]
            .split(',')
            .map(url => url.trim().replace(/['"]/g, ''))
            .filter(url => url.length > 0)

        const n = urls.length
        const mirrors = Math.max(1, Math.floor(n / 12))

        episodes = Array.from({ length: Math.ceil(n / mirrors) }, (_, i) => {
            const episodeNum = i + 1
            const group = urls.slice(i * mirrors, (i + 1) * mirrors)
            const nonBlacklisted = group.filter(url => !isBlacklisted(url))
            const providers = Array.from(new Set(group.map(hostnameOf)))
            const primary = preferNonBlacklisted(group)
            const urlsToUse = nonBlacklisted.length > 0 ? nonBlacklisted : group

            // Get episode title if available
            const title = episodeTitles[episodeNum] || generateFallbackTitle(id, season, episodeNum)

            return {
                episode: episodeNum,
                title,
                url: primary,
                urls: urlsToUse,
                providers
            }
        })

    }

    const payload: any = { episodes }
    return payload
})