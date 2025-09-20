import { preferNonBlacklisted, isBlacklisted, hostnameOf } from '~/shared/utils/hosts'
export default defineEventHandler(async (event) => {
    const { id, season, lang } = event.context.params as { id?: string; season?: string; lang?: string }
    const q = getQuery(event)
    const debug = q.debug === '1' || q.debug === 'true'

    if (!id || typeof id !== 'string')
        throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Missing or invalid id parameter' })
    if (!season || typeof season !== 'string')
        throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Missing or invalid season parameter' })
    if (!lang || typeof lang !== 'string' || (lang !== 'vostfr' && lang !== 'vf'))
        throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Missing or invalid lang parameter' })

    const baseUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(lang)}`

    const dbg: any = { baseUrl, source: undefined as undefined | 'episodes.js' | 'html', jsTried: false, jsOk: false, htmlTried: false, htmlOk: false, length: 0 }

    // Prefer episodes.js when available
    let sourceText: string | null = null
    try {
        dbg.jsTried = true
        const jsRes = await fetch(`${baseUrl}/episodes.js`, {
            headers: {
                'Accept': '*/*',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
            },
            redirect: 'follow',
            referrerPolicy: 'strict-origin-when-cross-origin',
        })
        if (debug) console.info(`[episodes] GET ${baseUrl}/episodes.js -> ${jsRes.status}`)
        if (jsRes.ok) {
            sourceText = await jsRes.text()
            dbg.jsOk = true
            dbg.source = 'episodes.js'
        }
    } catch {}

    // Fallback to the HTML page
    if (!sourceText) {
        dbg.htmlTried = true
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
        dbg.htmlOk = true
        dbg.source = dbg.source || 'html'
    }

    // Extract eps arrays (eps1, eps2, eps3, ...) and aggregate providers per episode
    dbg.length = sourceText.length
    const arrays: string[][] = []
    try {
        const re = /(var|let|const)\s+eps(\d+)\s*=\s*\[([\s\S]*?)\];/g
        let m: RegExpExecArray | null
        while ((m = re.exec(sourceText)) !== null) {
            const inner = m[3]
            const list = Array.from(inner.matchAll(/["']([^"'\s]+)["']/g))
                .map(x => x[1])
                .filter(u => /^https?:\/\//i.test(u))
            if (list.length > 0) arrays.push(list)
        }
    } catch {}

    let episodes: Array<{ episode: number; url: string; urls: string[] }>

    if (arrays.length > 0) {
        // Merge by episode index across all provider arrays
        const maxLen = Math.max(...arrays.map(a => a.length))
        episodes = Array.from({ length: maxLen }, (_, idx) => {
            const groupRaw = arrays.map(a => a[idx]).filter((u): u is string => !!u)
            // Dedupe while preserving order
            const seen = new Set<string>()
            const uniq = groupRaw.filter(u => (seen.has(u) ? false : (seen.add(u), true)))
            const providers = uniq.map(u => ({ url: u, host: hostnameOf(u), blacklisted: isBlacklisted(u) }))
            const nonBlacklisted = providers.filter(p => !p.blacklisted).map(p => p.url)
            const primary = preferNonBlacklisted(uniq) || uniq[0]
            const urls = nonBlacklisted.length > 0 ? nonBlacklisted : uniq
            return { episode: idx + 1, url: primary, urls, providers }
        })
        if (debug) console.info(`[episodes] Found ${arrays.length} provider arrays; built ${episodes.length} episodes`)
    } else {
        // Fallback: try single eps1 array and apply legacy grouping heuristic
        const m1 = sourceText.match(/(var|let|const)\s+eps1\s*=\s*\[([\s\S]*?)\];/)
        if (!m1) {
            if (debug) {
                const snippet = sourceText.slice(0, 4000)
                console.info(`[episodes] No eps arrays found for ${id}/${season}/${lang}. Source=${dbg.source} length=${sourceText.length}. First 4000 chars:\n` + snippet)
            }
            throw createError({ statusCode: 502, statusMessage: 'Bad Gateway', message: 'No eps arrays found in source (enable ?debug=1 to log HTML)' })
        }
        const inner = m1[2]
        const list = Array.from(inner.matchAll(/["']([^"'\s]+)["']/g)).map(x => x[1])
        const seen = new Set<string>()
        const all = list
            .filter(u => /^https?:\/\//i.test(u))
            .filter(u => (seen.has(u) ? false : (seen.add(u), true)))

        const n = all.length
        let mirrors = 1
        for (const m of [4,3,2]) { if (n % m === 0) { mirrors = m; break } }
        episodes = Array.from({ length: Math.ceil(n / mirrors) }, (_, idx) => {
            const group = all.slice(idx * mirrors, (idx + 1) * mirrors)
            const providers = group.map(u => ({ url: u, host: hostnameOf(u), blacklisted: isBlacklisted(u) }))
            const nonBlacklisted = providers.filter(p => !p.blacklisted).map(p => p.url)
            const primary = preferNonBlacklisted(group) || group[0]
            const urls = nonBlacklisted.length > 0 ? nonBlacklisted : group
            return { episode: idx + 1, url: primary, urls, providers }
        })
        if (debug) console.info(`[episodes] Fallback parsing: 1 array with ${n} urls -> mirrors=${mirrors} => ${episodes.length} episodes`)
    }

    const payload: any = { episodes }
    if (debug) {
        const snippet = (sourceText || '').slice(0, 1000)
        payload.debug = { ...dbg, snippet }
        console.info(`[episodes] Parsed ${episodes.length} episodes for ${id}/${season}/${lang} from ${dbg.source} length=${dbg.length}`)
    }
    return payload
})