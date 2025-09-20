import { parseCataloguePage } from '#shared/utils/parsers'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)

  // Accept: genre as string or string[], search as string, page as number
  let genres: string[] = []
  const genre = q.genre
  if (Array.isArray(genre)) genres = genre as string[]
  else if (typeof genre === 'string' && genre) genres = [genre]

  const search = typeof q.search === 'string' ? q.search : ''
  const page = typeof q.page === 'string' ? q.page : undefined
  const random = q.random === '1' || q.random === 'true' ? '1' : undefined

  const debug = q.debug === '1' || q.debug === 'true'

  const buildUrl = (base: string, key: 'genre[]' | 'genres[]') => {
    const u = new URL(base)
    for (const g of genres) u.searchParams.append(key, g)
    // Always include search, even if empty, to satisfy upstream filter behavior
    u.searchParams.set('search', search)
    if (page) u.searchParams.set('page', page)
    if (random) u.searchParams.set('random', random)
    return u
  }

  // Per requirement, request must be: https://anime-sama.fr/catalogue/?genre[]=Action&search=
  const candidates = [
    { base: 'https://anime-sama.fr/catalogue/', key: 'genre[]' as const, referer: 'https://anime-sama.fr/catalogue/' },
  ]

  const tried: Array<{ url: string; status: number; count: number }> = []

  for (const c of candidates) {
    const url = buildUrl(c.base, c.key)
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
          'Referer': c.referer,
          'Upgrade-Insecure-Requests': '1'
        },
        redirect: 'follow'
      })
      const html = await res.text()
      const items = parseCataloguePage(html)
      tried.push({ url: url.toString(), status: res.status, count: items.length })
      // If we found items or no genre filter was requested, return immediately
      if (items.length > 0 || genres.length === 0) {
        const base = { items, count: items.length, status: res.status }
        return debug ? { ...base, _debug: { tried } } : base
      }

      // Fallback: if a genre was requested but yielded 0 items, try using search=<genre>
      if (genres.length > 0) {
        const searchUrl = new URL(c.base)
        searchUrl.searchParams.set('search', genres[0])
        if (page) searchUrl.searchParams.set('page', page)
        const res2 = await fetch(searchUrl.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
            'Referer': c.referer,
            'Upgrade-Insecure-Requests': '1'
          },
          redirect: 'follow'
        })
        const html2 = await res2.text()
        const items2 = parseCataloguePage(html2)
        tried.push({ url: searchUrl.toString(), status: res2.status, count: items2.length })
        if (items2.length > 0) {
          const base = { items: items2, count: items2.length, status: res2.status }
          return debug ? { ...base, _debug: { tried } } : base
        }
      }
    } catch {
      tried.push({ url: url.toString(), status: 0, count: 0 })
      // try next candidate
    }
  }

  // If all attempts failed, return empty with debug info
  const fallback = { items: [] as ReturnType<typeof parseCataloguePage>, count: 0, status: 0 }
  return debug ? { ...fallback, _debug: { tried } } : fallback
})
