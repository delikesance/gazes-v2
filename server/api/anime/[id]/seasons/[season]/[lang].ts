export default defineEventHandler(async (event) => {
    const { id, season, lang } = event.context.params as { id?: string; season?: string; lang?: string }

    if (!id || typeof id !== 'string')
        throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Missing or invalid id parameter' })
    if (!season || typeof season !== 'string')
        throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Missing or invalid season parameter' })
    if (!lang || typeof lang !== 'string' || (lang !== 'vostfr' && lang !== 'vf'))
        throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Missing or invalid lang parameter' })

    const baseUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(lang)}`

    // Prefer episodes.js when available
    let sourceText: string | null = null
    try {
        const jsRes = await fetch(`${baseUrl}/episodes.js`, {
            headers: {
                'Accept': '*/*',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
            },
            redirect: 'follow',
            referrerPolicy: 'strict-origin-when-cross-origin',
        })
        if (jsRes.ok) sourceText = await jsRes.text()
    } catch {}

    // Fallback to the HTML page
    if (!sourceText) {
        const res = await fetch(baseUrl, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
            },
            redirect: 'follow',
            referrerPolicy: 'strict-origin-when-cross-origin',
        })
        if (!res.ok) {
            throw createError({ statusCode: res.status, statusMessage: res.statusText, message: `Failed to fetch season page: ${baseUrl}` })
        }
        sourceText = await res.text()
    }

    // Extract eps1 array from the source text
    const m = sourceText.match(/var\s+eps1\s*=\s*\[([\s\S]*?)\];/)
    if (!m) {
        throw createError({ statusCode: 502, statusMessage: 'Bad Gateway', message: 'eps1 array not found in source' })
    }
    const inner = m[1]
    const urls = Array.from(inner.matchAll(/['"]([^'"\s]+)['"]/g)).map(x => x[1])
    const seen = new Set<string>()
        const eps1 = urls
            .filter(u => /^https?:\/\//i.test(u))
            .filter(u => (seen.has(u) ? false : (seen.add(u), true)))

        const episodes = eps1.map((url, idx) => ({ episode: idx + 1, url }))

    return { episodes }
})