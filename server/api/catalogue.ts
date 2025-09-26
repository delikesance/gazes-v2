import { parseCataloguePage } from '#shared/utils/parsers'
import { parseAnimeResults } from '#shared/utils/parsers'

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

  // If there's a search query, use the search API which has better results
  if (search && search.trim()) {
    try {
      // Read configuration from runtime config with sensible defaults
      const config = useRuntimeConfig()
      const searchApiUrl = config.searchApiUrl || "https://anime-sama.fr/template-php/defaut/fetch.php"
      const timeoutMs = parseInt(config.searchApiTimeoutMs || "10000", 10)
      
      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, timeoutMs)
      
      try {
        const searchResponse = await fetch(searchApiUrl, {
          method: "POST",
          headers: {
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Priority": "u=3, i",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
            "X-Requested-With": "XMLHttpRequest"
          },
          body: "query=" + encodeURIComponent(search),
          mode: "cors",
          redirect: "follow",
          signal: controller.signal
        });
        
        // Clear timeout on successful response
        clearTimeout(timeoutId)
        
        const searchHtml = await searchResponse.text()
        const searchResults = parseAnimeResults(searchHtml)
        
        // Convert search results to catalogue format and filter out mangas
        const items = searchResults.map(item => ({
          id: item.id,
          title: item.title,
          image: item.image,
          type: 'Anime' // Search results are typically anime
        }))
        
        return { items, count: items.length, status: searchResponse.status }
        
      } catch (fetchError: any) {
        // Clear timeout on error
        clearTimeout(timeoutId)
        
        // Handle different types of errors
        if (fetchError.name === 'AbortError') {
          console.warn(`Search API request timed out after ${timeoutMs}ms, falling back to catalogue search`)
          throw new Error(`Search API timeout after ${timeoutMs}ms`)
        } else {
          console.warn('Search API fetch failed:', fetchError.message)
          throw fetchError
        }
      }
      
    } catch (error: any) {
      // Fall back to catalogue search if search API fails
      console.warn('Search API failed, falling back to catalogue search:', {
        error: error.message,
        search: search,
        timestamp: new Date().toISOString()
      })
    }
  }

  // To exclude mangas, we filter them out in parseCataloguePage
  let categories: string[] = []
  const categoryParam = q.type || q.categorie || q.category
  if (Array.isArray(categoryParam)) categories = categoryParam as string[]
  else if (typeof categoryParam === 'string' && categoryParam) categories = [categoryParam]

  const buildUrl = (base: string, genreKey: 'genre[]' | 'genres[]', categorieKey: 'categorie[]' | 'type[]') => {
    const u = new URL(base)
    for (const g of genres) u.searchParams.append(genreKey, g)
    for (const c of categories) u.searchParams.append(categorieKey, c)
    // Always include search, even if empty, to satisfy upstream filter behavior
    u.searchParams.set('search', search)
    if (page) u.searchParams.set('page', page)
    if (random) u.searchParams.set('random', random)
    return u
  }

  // Per requirement, request must be: https://anime-sama.fr/catalogue/?genre[]=Action&search=
  const candidates = [
    { base: 'https://anime-sama.fr/catalogue/', genreKey: 'genre[]' as const, categorieKey: 'categorie[]' as const, referer: 'https://anime-sama.fr/catalogue/' },
  ]

  const tried: Array<{ url: string; status: number; count: number }> = []

  for (const c of candidates) {
    const url = buildUrl(c.base, c.genreKey, c.categorieKey)
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
      // Filter out mangas (Scans) after parsing
      const filteredItems = items.filter(item => item.type !== 'Scans')
      tried.push({ url: url.toString(), status: res.status, count: filteredItems.length })
      // If we found items or no genre filter was requested, return immediately
      if (filteredItems.length > 0 || genres.length === 0) {
        const base = { items: filteredItems, count: filteredItems.length, status: res.status }
        return debug ? { ...base, _debug: { tried } } : base
      }

      // Fallback: if a genre was requested but yielded 0 items, try using search=<genre>
      if (genres.length > 0 && genres[0]) {
        const searchUrl = new URL(c.base)
        searchUrl.searchParams.set('search', genres[0])
        for (const cat of categories) searchUrl.searchParams.append('categorie[]', cat)
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
        const filteredItems2 = items2.filter(item => item.type !== 'Scans')
        tried.push({ url: searchUrl.toString(), status: res2.status, count: filteredItems2.length })
        if (filteredItems2.length > 0) {
          const base = { items: filteredItems2, count: filteredItems2.length, status: res2.status }
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
