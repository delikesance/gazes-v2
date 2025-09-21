import { VERIFIED_PROVIDERS, getProviderStats, categorizeUrlsByReliability, sortUrlsByProviderReliability } from '~/server/utils/videoProviders'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const action = query.action as string

  switch (action) {
    case 'list':
      // Return list of all verified providers
      return {
        providers: VERIFIED_PROVIDERS,
        stats: getProviderStats()
      }

    case 'stats':
      // Return only statistics
      return getProviderStats()

    case 'test':
      // Test provider sorting with sample URLs
      const sampleUrls = [
        'https://www.myvi.top/embed/test123',
        'https://sendvid.com/embed/test456', 
        'https://streamtape.com/embed/test789',
        'https://unknown-provider.com/test000'
      ]
      
      const categorized = categorizeUrlsByReliability(sampleUrls)
      const sorted = sortUrlsByProviderReliability(sampleUrls)
      
      return {
        originalUrls: sampleUrls,
        categorized,
        sorted,
        message: 'Provider sorting test completed'
      }

    case 'sort':
      // Sort provided URLs by reliability
      const urls = Array.isArray(query.urls) ? query.urls as string[] : 
                   typeof query.urls === 'string' ? [query.urls] : []
      
      if (urls.length === 0) {
        return {
          error: 'No URLs provided',
          message: 'Use ?action=sort&urls[]=url1&urls[]=url2 or ?action=sort&urls=url1'
        }
      }

      const sortedUrls = sortUrlsByProviderReliability(urls)
      const categorizedUrls = categorizeUrlsByReliability(urls)
      
      return {
        originalUrls: urls,
        sortedUrls,
        categorizedUrls,
        message: `Sorted ${urls.length} URLs by provider reliability`
      }

    default:
      // Default: return provider info
      return {
        totalProviders: VERIFIED_PROVIDERS.length,
        verifiedProviders: VERIFIED_PROVIDERS.map(p => ({
          hostname: p.hostname,
          reliability: p.reliability,
          description: p.description
        })),
        usage: {
          'List all providers': '?action=list',
          'Get statistics': '?action=stats', 
          'Test sorting': '?action=test',
          'Sort URLs': '?action=sort&urls[]=url1&urls[]=url2'
        }
      }
  }
})