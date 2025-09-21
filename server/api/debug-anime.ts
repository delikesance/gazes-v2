export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const animeId = query.id as string
  const debug = query.debug === '1' || query.debug === 'true'
  
  if (!animeId) {
    return { error: 'Missing anime ID parameter' }
  }

  // Validate anime ID format (alphanumeric with hyphens)
  if (!/^[a-zA-Z0-9-]+$/.test(animeId)) {
    return { error: 'Invalid anime ID format' }
  }
  
  console.log(`🔍 Debugging anime: ${animeId}`)
  
  try {
    // Step 1: Check if anime page exists
    const animePageUrl = `https://anime-sama.fr/catalogue/${animeId}`
    console.log(`📄 Checking anime page: ${animePageUrl}`)
    
    const animeResponse = await fetch(animePageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
      }
    })
    
    if (!animeResponse.ok) {
      return {
        error: `Anime page not found: ${animeResponse.status} ${animeResponse.statusText}`,
        url: animePageUrl
      }
    }
    
    const animeHtml = await animeResponse.text()
    console.log(`✅ Anime page loaded: ${animeHtml.length} bytes`)
    
    // Step 2: Parse seasons from anime page (two methods)
    // Method 1: Look for href links
    const seasonPattern = /href="\/catalogue\/[^"]+\/([^"\/]+)\/(vostfr|vf)"/g
    const seasons = new Set<string>()
    const languages = new Set<string>()
    
    let match
    while ((match = seasonPattern.exec(animeHtml)) !== null) {
      seasons.add(match[1])
      languages.add(match[2])
    }
    
    // Method 2: Look for panneauAnime JavaScript calls
    const panneauPattern = /panneauAnime\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/g
    let panneauMatch
    while ((panneauMatch = panneauPattern.exec(animeHtml)) !== null) {
      const path = panneauMatch[2] // e.g., "saison1/vf"
      const pathParts = path.split('/')
      if (pathParts.length === 2) {
        seasons.add(pathParts[0])
        languages.add(pathParts[1])
      }
    }
    
    console.log(`🎭 Found seasons: ${Array.from(seasons).join(', ')}`)
    console.log(`🗣️ Found languages: ${Array.from(languages).join(', ')}`)
    
    // Step 3: Check each season/language combination
    const results = {
      anime: animeId,
      animePageStatus: animeResponse.status,
      seasons: Array.from(seasons),
      languages: Array.from(languages),
      episodeData: [] as any[],
      embedTests: [] as any[],
      workingUrls: [] as any[],
      errors: [] as any[]
    }
    
    for (const season of seasons) {
      for (const lang of languages) {
        const seasonUrl = `https://anime-sama.fr/catalogue/${animeId}/${season}/${lang}`
        console.log(`🎯 Testing season: ${seasonUrl}`)
        
        try {
          // Try episodes.js first
          const episodesJsUrl = `${seasonUrl}/episodes.js`
          const jsResponse = await fetch(episodesJsUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
            }
          })
          
          let episodeSource = ''
          let sourceType = ''
          
          if (jsResponse.ok) {
            episodeSource = await jsResponse.text()
            sourceType = 'episodes.js'
            console.log(`✅ Found episodes.js: ${episodeSource.length} bytes`)
          } else {
            // Fallback to HTML page
            const htmlResponse = await fetch(seasonUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
              }
            })
            
            if (htmlResponse.ok) {
              episodeSource = await htmlResponse.text()
              sourceType = 'html'
              console.log(`✅ Found HTML page: ${episodeSource.length} bytes`)
            } else {
              console.log(`❌ Failed to load: ${htmlResponse.status} ${htmlResponse.statusText}`)
              results.errors.push({
                season,
                lang,
                error: `Failed to load season page: ${htmlResponse.status} ${htmlResponse.statusText}`,
                url: seasonUrl
              })
              continue
            }
          }
          
          // Extract episode arrays
          const episodeArrays: string[][] = []
          const arrayPattern = /(var|let|const)\s+eps(\d+)\s*=\s*\[([\s\S]*?)\];/g
          let arrayMatch
          
          while ((arrayMatch = arrayPattern.exec(episodeSource)) !== null) {
            const inner = arrayMatch[3]
            const urls = Array.from(inner.matchAll(/["']([^"'\s]+)["']/g))
              .map(x => x[1])
              .filter(u => /^https?:\/\//i.test(u))
            
            if (urls.length > 0) {
              episodeArrays.push(urls)
              console.log(`📺 Found eps${arrayMatch[2]} with ${urls.length} URLs`)
            }
          }
          
          // Store episode data
          const episodeData = {
            season,
            lang,
            sourceType,
            sourceLength: episodeSource.length,
            episodeArrays: episodeArrays.length,
            totalUrls: episodeArrays.reduce((sum, arr) => sum + arr.length, 0),
            sampleUrls: episodeArrays.length > 0 ? episodeArrays[0].slice(0, 3) : []
          }
          
          results.episodeData.push(episodeData)
          
          // Step 4: Test first few URLs from each provider
          if (episodeArrays.length > 0) {
            const firstEpisodeUrls = episodeArrays.map(arr => arr[0]).filter(Boolean)
            
            for (let i = 0; i < Math.min(firstEpisodeUrls.length, 5); i++) {
              const testUrl = firstEpisodeUrls[i]
              console.log(`🧪 Testing embed URL: ${testUrl}`)
              
              try {
                const embedResponse = await fetch(testUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
                    'Referer': 'https://anime-sama.fr/'
                  },
                  signal: AbortSignal.timeout(10000) // 10 second timeout
                })
                
                const embedResult = {
                  url: testUrl,
                  status: embedResponse.status,
                  statusText: embedResponse.statusText,
                  season,
                  lang,
                  provider: new URL(testUrl).hostname,
                  working: embedResponse.ok
                }
                
                results.embedTests.push(embedResult)
                
                if (embedResponse.ok) {
                  const embedHtml = await embedResponse.text()
                  console.log(`✅ Embed working: ${testUrl} (${embedHtml.length} bytes)`)
                  
                  // Try to extract video URLs from this embed
                  const videoPatterns = [
                    /https:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*/gi,
                    /https:\/\/[^\s"'<>]*\.mp4[^\s"'<>]*/gi,
                    /["'](https:\/\/[^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
                    /src\s*=\s*["'](https:\/\/[^"']*\.(?:m3u8|mp4)[^"']*)["']/gi
                  ]
                  
                  const foundUrls: string[] = []
                  for (const pattern of videoPatterns) {
                    pattern.lastIndex = 0
                    let videoMatch
                    while ((videoMatch = pattern.exec(embedHtml)) !== null) {
                      const videoUrl = videoMatch[1] || videoMatch[0]
                      if (videoUrl && !foundUrls.includes(videoUrl)) {
                        foundUrls.push(videoUrl)
                      }
                    }
                  }
                  
                  if (foundUrls.length > 0) {
                    console.log(`🎬 Found ${foundUrls.length} video URLs in embed`)
                    results.workingUrls.push({
                      embedUrl: testUrl,
                      videoUrls: foundUrls,
                      season,
                      lang,
                      provider: new URL(testUrl).hostname
                    })
                  }
                  
                } else {
                  console.log(`❌ Embed failed: ${testUrl} - ${embedResponse.status} ${embedResponse.statusText}`)
                }
                
              } catch (error: any) {
                console.log(`💥 Embed error: ${testUrl} - ${error.message}`)
                results.embedTests.push({
                  url: testUrl,
                  error: error.message,
                  season,
                  lang,
                  provider: new URL(testUrl).hostname,
                  working: false
                })
              }
            }
          }
          
        } catch (error: any) {
          console.log(`💥 Season error: ${season}/${lang} - ${error.message}`)
          results.errors.push({
            season,
            lang,
            error: error.message,
            url: seasonUrl
          })
        }
      }
    }
    
    // Summary
    const summary = {
      totalSeasons: results.episodeData.length,
      totalEmbedsTested: results.embedTests.length,
      workingEmbeds: results.embedTests.filter(t => t.working).length,
      failingEmbeds: results.embedTests.filter(t => !t.working).length,
      videoUrlsFound: results.workingUrls.length,
      uniqueProviders: [...new Set(results.embedTests.map(t => t.provider))],
      workingProviders: [...new Set(results.embedTests.filter(t => t.working).map(t => t.provider))],
      failingProviders: [...new Set(results.embedTests.filter(t => !t.working).map(t => t.provider))]
    }
    
    console.log(`📊 Debug Summary:`)
    console.log(`  - Seasons tested: ${summary.totalSeasons}`)
    console.log(`  - Embeds tested: ${summary.totalEmbedsTested}`)
    console.log(`  - Working embeds: ${summary.workingEmbeds}`)
    console.log(`  - Video URLs found: ${summary.videoUrlsFound}`)
    console.log(`  - Working providers: ${summary.workingProviders.join(', ')}`)
    console.log(`  - Failing providers: ${summary.failingProviders.join(', ')}`)
    
    return {
      success: true,
      summary,
      ...results
    }
    
  } catch (error: any) {
    console.error(`💥 Debug error:`, error)
    return {
      error: error.message,
      stack: debug ? error.stack : undefined
    }
  }
})