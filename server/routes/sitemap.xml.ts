import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    // Get database credentials
    const config = useRuntimeConfig()
    const supabaseUrl = config.supabaseUrl as string
    const supabaseKey = config.supabaseKey as string

    if (!supabaseUrl || !supabaseKey) {
      console.error('[SITEMAP] Supabase credentials not available')
      throw new Error('Database credentials not available')
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch all anime IDs
    const { data: animeData, error } = await supabase
      .from('anime_metadata')
      .select('id, last_updated')
      .order('last_updated', { ascending: false })
      .limit(10000)

    if (error) {
      console.error('[SITEMAP] Database error:', error)
      throw error
    }

    const animeList = animeData || []
    console.log(`[SITEMAP] Generating sitemap with ${animeList.length} anime entries`)

    // Get base URL
    const siteUrl = config.public.siteUrl || 'https://gazes-v2.vercel.app'
    const currentDate = new Date().toISOString()

    // Define static routes
    const staticRoutes = [
      { url: '/', changefreq: 'daily', priority: 1.0, lastmod: currentDate },
      { url: '/catalogue', changefreq: 'daily', priority: 0.9, lastmod: currentDate },
      { url: '/movies', changefreq: 'weekly', priority: 0.8, lastmod: currentDate },
      { url: '/series', changefreq: 'weekly', priority: 0.8, lastmod: currentDate },
      { url: '/login', changefreq: 'monthly', priority: 0.3, lastmod: currentDate },
      { url: '/register', changefreq: 'monthly', priority: 0.3, lastmod: currentDate }
    ]

    // Generate anime routes
    const animeRoutes = animeList.map((anime: any) => ({
      url: `/anime/${anime.id}`,
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: anime.last_updated || currentDate
    }))

    // Combine all routes
    const allRoutes = [...staticRoutes, ...animeRoutes]

    // Generate XML sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${allRoutes.map(route => `  <url>
    <loc>${siteUrl}${route.url}</loc>
    <lastmod>${route.lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n')}
</urlset>`

    // Set appropriate headers
    setHeader(event, 'Content-Type', 'application/xml')
    setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')

    return sitemap
  } catch (error) {
    console.error('[SITEMAP] Error generating sitemap:', error)
    
    // Return minimal sitemap on error
    const config = useRuntimeConfig()
    const siteUrl = config.public.siteUrl || 'https://gazes-v2.vercel.app'
    const currentDate = new Date().toISOString()
    
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`

    setHeader(event, 'Content-Type', 'application/xml')
    return fallbackSitemap
  }
})
