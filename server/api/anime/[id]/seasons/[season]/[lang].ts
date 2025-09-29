import { preferNonBlacklisted, isBlacklisted, hostnameOf } from '~/shared/utils/hosts'
import { defineEventHandler, getQuery, createError } from 'h3'
import { cachedFetch, CACHE_TTL } from '~/server/utils/cache'
// Function to scrape episode titles from the main anime page on anime-sama
async function scrapeEpisodeTitlesFromMainPage(animeId: string, season: string, lang: string): Promise<Record<number, string>> {
    const titles: Record<number, string> = {}

    try {
        // Try to fetch the main anime page first
        const mainPageUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(animeId)}/`
        const mainPageCacheKey = `anime-main-page:${animeId}`
        const mainPageRes = await cachedFetch(mainPageCacheKey, async () => {
            return await fetch(mainPageUrl, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
                },
                redirect: 'follow',
                referrerPolicy: 'strict-origin-when-cross-origin',
            })
        }, CACHE_TTL.GENERAL)

        if (mainPageRes.ok) {
            const mainPageHtml = await mainPageRes.text()

            // Look for episode lists in the main page - anime-sama sometimes has episode lists with real titles
            const episodeListPatterns = [
                // Pattern for episode lists in divs or sections
                /<div[^>]*class="[^"]*episode[^"]*"[^>]*>[\s\S]*?(\d+)[^<>]*[-:]\s*([^<>]{3,100}?)(?:<|$)/gi,
                // Pattern for episode titles in tables
                /<tr[^>]*>[\s\S]*?(\d+)[\s\S]*?<td[^>]*>([^<>]{3,100}?)<\/td>/gi,
                // Pattern for structured episode data
                /<(?:li|div)[^>]*episode[^>]*>[\s\S]*?(\d+)[\s\S]*?title[^>]*>([^<>]{3,100}?)</gi,
                // Pattern for JSON-like episode data
                /"episode":\s*(\d+)[^}]*"title":\s*"([^"]{3,100})"/gi,
                // Pattern for episode selectors with real titles (not just "Episode X")
                /<option[^>]*>(?:Episode\s*)?(\d+)\s*[-:]\s*([^<>]{4,100}?)(?:<\/option>|$)/gi
            ]

            for (const pattern of episodeListPatterns) {
                let match
                while ((match = pattern.exec(mainPageHtml)) !== null) {
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

                    // Only accept meaningful titles (not just numbers or generic text)
                    if (episodeNum > 0 && title && title.length >= 3 &&
                        !title.match(/^(episode|épisode|ep|e)\s*\d*$/i) &&
                        !title.match(/^\d+$/) &&
                        title.toLowerCase() !== 'episode' &&
                        title.toLowerCase() !== 'épisode') {
                        if (!titles[episodeNum] || titles[episodeNum].length < title.length) {
                            titles[episodeNum] = title
                        }
                    }
                }
            }
        }

        // Also try the specific season page URL for additional episode data
        const seasonPageUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(animeId)}/${encodeURIComponent(season)}/`
        const seasonPageCacheKey = `anime-season-page:${animeId}:${season}`
        const seasonPageRes = await cachedFetch(seasonPageCacheKey, async () => {
            return await fetch(seasonPageUrl, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
                },
                redirect: 'follow',
                referrerPolicy: 'strict-origin-when-cross-origin',
            })
        }, CACHE_TTL.GENERAL)

        if (seasonPageRes.ok) {
            const seasonPageHtml = await seasonPageRes.text()
            const seasonTitles = extractEpisodeTitles(seasonPageHtml)

            // Merge with existing titles, preferring longer/better titles
            for (const [episodeNum, title] of Object.entries(seasonTitles)) {
                const epNum = parseInt(episodeNum)
                if (!titles[epNum] || (title.length > titles[epNum].length && !title.match(/^Episode\s*\d+$/i))) {
                    titles[epNum] = title
                }
            }
        }

        // For films and special cases, also try the language-specific page where selectEpisodes might be located
        const langPageUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(animeId)}/${encodeURIComponent(season)}/${encodeURIComponent(lang)}/`
        const langPageCacheKey = `anime-lang-page:${animeId}:${season}:${lang}`
        const langPageRes = await cachedFetch(langPageCacheKey, async () => {
            return await fetch(langPageUrl, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
                },
                redirect: 'follow',
                referrerPolicy: 'strict-origin-when-cross-origin',
            })
        }, CACHE_TTL.GENERAL)

        if (langPageRes.ok) {
            const langPageHtml = await langPageRes.text()
            const langTitles = extractEpisodeTitles(langPageHtml)

            // Merge with existing titles, preferring longer/better titles
            for (const [episodeNum, title] of Object.entries(langTitles)) {
                const epNum = parseInt(episodeNum)
                if (!titles[epNum] || (title.length > titles[epNum].length && !title.match(/^Episode\s*\d+$/i))) {
                    titles[epNum] = title
                }
            }
        }
    } catch (error) {
        console.warn('Error scraping episode titles from main page:', error)
    }

    return titles
}

// Module-level constants for regex patterns
const EPISODE_PATTERNS = [
    // Pattern for anime-sama episode lists in HTML
    /<div[^>]*class="[^"]*episode[^"]*"[^>]*>[\s\S]*?(\d+)[\s\S]*?[-:]\s*([^<>]+?)(?:<|$)/gi,
    // Pattern for "Episode X - Title" or "Episode X: Title"
    /(?:Episode|Épisode)\s*(\d+)\s*[-:]\s*([^\n\r<>]{3,}?)(?:\n|<|$)/gi,
    // Pattern for numbered lists "X - Title" or "X. Title"
    /(?:^|\n)\s*(\d+)\s*[-\.]\s*([^\n\r<>]{3,}?)(?:\n|<|$)/gm,
    // Pattern for HTML select options
    /<option[^>]*>(?:Episode\s*)?(\d+)[^<>]*[-:]\s*([^<>]{3,}?)<\/option>/gi,
    // NEW: Pattern for selectEpisodes select component (films/movies without episode numbers)
    /<select[^>]*id="selectEpisodes"[^>]*>[\s\S]*?<\/select>/gi,
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

const JS_PATTERNS = [
    /(?:var|let|const)\s+(?:titles?|episodes?|names?|eps_titles?)\s*=\s*\[([\s\S]*?)\]/gi,
    /(?:titles?|episodes?|names?|eps_titles?)\s*:\s*\[([\s\S]*?)\]/gi,
    // Pattern for anime-sama specific title arrays
    /eps_titles\s*=\s*\[([\s\S]*?)\]/gi
]

const META_PATTERNS = [
    /<meta[^>]*(?:name|property)=["'](?:description|episode)["'][^>]*content=["']([^"']*(?:Episode|Épisode)\s*\d+[^"']*)["']/gi,
    /"name":\s*"([^"]*(?:Episode|Épisode)\s*\d+[^"]*)"[^}]*"episodeNumber":\s*(\d+)/gi,
    // Pattern for JSON-LD structured data
    /"episode":\s*\[[\s\S]*?"name":\s*"([^"]+)"[\s\S]*?"episodeNumber":\s*(\d+)/gi
]

// Utility function to clean and validate episode titles
function cleanEpisodeTitle(rawTitle: string): string | null {
    if (!rawTitle || typeof rawTitle !== 'string') {
        return null
    }

    let title = rawTitle.trim()
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

    // Validate the cleaned title
    if (title && title.length >= 3 && title.length <= 200) {
        return title
    }

    return null
}

// Helper function to parse HTML patterns for episode titles
function parseHtmlPatterns(html: string, titles: Record<number, string>): void {
    for (const pattern of EPISODE_PATTERNS) {
        let match
        while ((match = pattern.exec(html)) !== null) {
            if (!match[1] || !match[2]) continue
            const episodeNum = parseInt(match[1])
            const cleanedTitle = cleanEpisodeTitle(match[2])

            if (episodeNum > 0 && cleanedTitle) {
                // Don't overwrite if we already have a longer/better title
                if (!titles[episodeNum] || titles[episodeNum].length < cleanedTitle.length) {
                    titles[episodeNum] = cleanedTitle
                }
            }
        }
    }
}

// Helper function to parse selectEpisodes select component
function parseSelectEpisodes(html: string, titles: Record<number, string>): void {
    const selectEpisodesMatch = html.match(/<select[^>]*id="selectEpisodes"[^>]*>([\s\S]*?)<\/select>/i)
    if (selectEpisodesMatch) {
        const selectContent = selectEpisodesMatch[1]
        if (!selectContent) return
        const optionMatches = selectContent.match(/<option[^>]*>([^<>]+?)<\/option>/gi)
        if (optionMatches) {
            optionMatches.forEach((optionMatch, index) => {
                const optionText = optionMatch.replace(/<[^>]+>/g, '').trim()
                const cleanedTitle = cleanEpisodeTitle(optionText)

                if (cleanedTitle) {
                    const episodeNum = index + 1
                    // Only set if we don't already have a title for this episode
                    if (!titles[episodeNum]) {
                        titles[episodeNum] = cleanedTitle
                    }
                }
            })
        }
    }
}

// Helper function to parse JavaScript arrays for episode titles
function parseJsArrays(html: string, titles: Record<number, string>): void {
    for (const jsPattern of JS_PATTERNS) {
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
}

// Helper function to parse meta patterns for episode titles
function parseMetaPatterns(html: string, titles: Record<number, string>): void {
    for (const metaPattern of META_PATTERNS) {
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
}

// Function to extract episode titles from HTML content
function extractEpisodeTitles(html: string): Record<number, string> {
    const titles: Record<number, string> = {}

    try {
        // Parse HTML patterns
        parseHtmlPatterns(html, titles)

        // Parse select episodes component
        parseSelectEpisodes(html, titles)

        // Parse JavaScript arrays
        parseJsArrays(html, titles)

        // Parse meta patterns
        parseMetaPatterns(html, titles)
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

    // For regular episodes, just return undefined to use default Episode X display
    return undefined
}

export default defineEventHandler(async (event) => {
    console.log('Route hit:', event.context.params)
    const { id, season, lang } = event.context.params as { id: string, season: string, lang: string }
    const query = getQuery(event)
    const debug = query.debug === 'true'

    console.log('Parameters:', { id, season, lang })

    if (!id || !season || !lang) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: 'Missing required parameters: id, season, and lang are required'
        })
    }

    const dbg = { source: '', length: 0 }

    // Scrape episode titles from anime-sama main page
    const episodeTitles = await scrapeEpisodeTitlesFromMainPage(id, season, lang)

    if (debug) console.info(`[episodes] Scraped ${Object.keys(episodeTitles).length} episode titles from anime-sama`)
    // First, try to fetch episode lists from the episodes.js file
    const jsUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(lang)}/episodes.js`
    let sourceText = ''

    try {
        const jsCacheKey = `anime-episodes-js:${id}:${season}:${lang}`
        const jsRes = await cachedFetch(jsCacheKey, async () => {
            return await fetch(jsUrl, {
                headers: {
                    'Accept': '*/*',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
                },
                redirect: 'follow',
                referrerPolicy: 'strict-origin-when-cross-origin',
                signal: AbortSignal.timeout(10000), // 10 second timeout
            })
        }, CACHE_TTL.GENERAL)

        if (jsRes.ok) {
            const jsText = await jsRes.text()
            if (jsText && jsText.trim()) {
                sourceText = jsText
                dbg.source = jsUrl
                dbg.length = jsText.length
            }
        }
    } catch (error) {
        console.debug('Failed to fetch episodes.js:', error);
    }

    // If episodes.js didn't work, try the main season page
    if (!sourceText) {
        const seasonUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(lang)}/`
        try {
            const seasonPageCacheKey = `anime-episodes-page:${id}:${season}:${lang}`
            const res = await cachedFetch(seasonPageCacheKey, async () => {
                return await fetch(seasonUrl, {
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
                    },
                    redirect: 'follow',
                    referrerPolicy: 'strict-origin-when-cross-origin',
                })
            }, CACHE_TTL.GENERAL)

            if (res.ok) {
                sourceText = await res.text()
                dbg.source = seasonUrl
                dbg.length = sourceText.length
            }
        } catch {}
    }

    if (!sourceText) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Not Found',
            message: `Unable to fetch episode data for ${id}/${season}/${lang}`
        })
    }

    // Parse episodes from JavaScript arrays
    const regex = /eps\d*\s*=\s*\[([^\]]+)\]/g
    const matches = []
    let match

    while ((match = regex.exec(sourceText)) !== null) {
        matches.push(match[1])
    }

    if (debug) console.info(`[episodes] Found ${matches.length} eps arrays`)

    let episodes: any[] = []

    if (matches.length > 0) {
        const allUrls = matches.flatMap(arrayContent => 
            arrayContent ? arrayContent.split(',').map(url => url.trim().replace(/['"]/g, '')) : []
        )

        const grouped = allUrls.reduce((groups, url) => {
            const episodeMatch = url.match(/(?:episode?|ep|e)[-_]?(\d+)/i) || url.match(/(\d+)/)
            const episode = episodeMatch && episodeMatch[1] ? parseInt(episodeMatch[1]) : Object.keys(groups).length + 1

            if (!groups[episode]) groups[episode] = []
            groups[episode].push(url)
            return groups
        }, {} as Record<number, string[]>)

        if (debug) console.info(`[episodes] JS parsing: ${allUrls.length} urls -> groups=${Object.keys(grouped).length}`)

        episodes = Object.entries(grouped).map(([ep, urls]) => {
            const episodeNum = parseInt(ep)
            const nonBlacklisted = urls.filter(url => !isBlacklisted(url))
            const providers = Array.from(new Set(urls.map(hostnameOf)))
            const primary = preferNonBlacklisted(urls)
            const urlsToUse = nonBlacklisted.length > 0 ? nonBlacklisted : urls

            // Get episode title if available
            const title = episodeTitles[episodeNum] || generateFallbackTitle(id, season, episodeNum)

            return {
                episode: episodeNum,
                title,
                url: primary,
                urls: urlsToUse,
                providers
            }
        }).sort((a, b) => a.episode - b.episode)

        if (debug) console.info(`[episodes] JS parsing result: ${episodes.length} episodes`)
    } else {
        // Fallback: treat as single array
        const arrayMatch = sourceText.match(/\[([^\]]+)\]/)
        if (!arrayMatch || !arrayMatch[1]) {
            if (debug) {
                const snippet = sourceText.slice(0, 4000)
                console.info(`[episodes] No eps arrays found for ${id}/${season}/${lang}. Source=${dbg.source} length=${sourceText.length}. First 4000 chars:\n` + snippet)
            }
            throw createError({ statusCode: 502, statusMessage: 'Bad Gateway', message: 'No eps arrays found in source (enable ?debug=1 to log HTML)' })
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

        if (debug) console.info(`[episodes] Fallback parsing: 1 array with ${n} urls -> mirrors=${mirrors} => ${episodes.length} episodes`)
    }

    const payload: any = { episodes }
    if (debug) {
        const snippet = (sourceText || '').slice(0, 1000)
        payload.debug = { ...dbg, snippet, episodeTitlesFound: Object.keys(episodeTitles).length }
        console.info(`[episodes] Parsed ${episodes.length} episodes for ${id}/${season}/${lang} from ${dbg.source} length=${dbg.length}`)
    }
    return payload
})
