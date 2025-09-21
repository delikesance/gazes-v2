// Video provider reliability management
export interface VideoProvider {
  hostname: string
  reliability: number // 1-10 scale, 10 being most reliable
  description: string
  extractionPatterns?: string[] // Common patterns this provider uses
  knownIssues?: string[] // Known limitations or issues
}

// Verified providers configuration - ordered by reliability
export const VERIFIED_PROVIDERS: VideoProvider[] = [
  {
    hostname: 'sendvid.com',
    reliability: 10,
    description: 'SendVid - Direct MP4 URLs with reliable extraction',
    extractionPatterns: ['MP4 direct links in HTML'],
    knownIssues: []
  },
  {
    hostname: 'streamtape.com', 
    reliability: 8,
    description: 'StreamTape - Good MP4 extraction',
    extractionPatterns: ['MP4 via JavaScript variables'],
    knownIssues: ['Sometimes requires referer header']
  },
  {
    hostname: 'vidmoly.to',
    reliability: 7,
    description: 'Vidmoly - Standard video hosting with good extraction',
    extractionPatterns: ['MP4/M3U8 in script tags'],
    knownIssues: []
  },
  {
    hostname: 'uqload.com',
    reliability: 5,
    description: 'UQLoad - Standard extraction patterns',
    extractionPatterns: ['MP4 in JavaScript'],
    knownIssues: ['Variable extraction success']
  },
  {
    hostname: 'doodstream.com',
    reliability: 4,
    description: 'DoodStream - Medium reliability',
    extractionPatterns: ['Obfuscated JavaScript'],
    knownIssues: ['Often requires token-based access']
  },
  {
    hostname: 'www.myvi.top',
    reliability: 3,
    description: 'MyVi - Requires advanced JavaScript extraction',
    extractionPatterns: ['Dynamic JavaScript loading'],
    knownIssues: ['Complex obfuscation', 'No direct URLs found yet']
  }
]

// Helper function to get provider info by hostname
export function getProviderInfo(url: string): VideoProvider | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return VERIFIED_PROVIDERS.find(p => 
      hostname === p.hostname || 
      hostname.includes(p.hostname.split('.')[0]) ||
      p.hostname.includes(hostname.split('.').slice(-2).join('.'))
    ) || null
  } catch {
    return null
  }
}

// Helper function to get provider reliability score
export function getProviderReliability(url: string): number {
  const provider = getProviderInfo(url)
  return provider?.reliability || 0 // Unknown providers get lowest priority
}

// Helper function to sort URLs by provider reliability
export function sortUrlsByProviderReliability(urls: string[]): string[] {
  return [...urls].sort((a, b) => {
    const reliabilityA = getProviderReliability(a)
    const reliabilityB = getProviderReliability(b)
    return reliabilityB - reliabilityA // Higher reliability first
  })
}

// Helper function to get the best provider URL from a list
export function getBestProviderUrl(urls: string[]): string | null {
  const sorted = sortUrlsByProviderReliability(urls)
  return sorted.length > 0 ? sorted[0] : null
}

// Helper function to categorize URLs by provider reliability
export function categorizeUrlsByReliability(urls: string[]): {
  excellent: string[] // reliability >= 9
  good: string[] // reliability 7-8  
  medium: string[] // reliability 4-6
  poor: string[] // reliability 1-3
  unknown: string[] // reliability 0
} {
  const result: {
    excellent: string[]
    good: string[]
    medium: string[]
    poor: string[]
    unknown: string[]
  } = {
    excellent: [],
    good: [],
    medium: [],
    poor: [],
    unknown: []
  }

  urls.forEach(url => {
    const reliability = getProviderReliability(url)
    if (reliability >= 9) result.excellent.push(url)
    else if (reliability >= 7) result.good.push(url)
    else if (reliability >= 4) result.medium.push(url)
    else if (reliability >= 1) result.poor.push(url)
    else result.unknown.push(url)
  })

  return result
}

// Export provider statistics
export function getProviderStats(): {
  totalProviders: number
  averageReliability: number
  reliabilityDistribution: Record<string, number>
} {
  const reliabilities = VERIFIED_PROVIDERS.map(p => p.reliability)
  const distribution: Record<string, number> = {}
  
  reliabilities.forEach(r => {
    const bracket = Math.floor(r / 2) * 2 // Group by 2s: 0-1, 2-3, 4-5, etc.
    const key = `${bracket}-${bracket + 1}`
    distribution[key] = (distribution[key] || 0) + 1
  })

  return {
    totalProviders: VERIFIED_PROVIDERS.length,
    averageReliability: reliabilities.reduce((a, b) => a + b, 0) / reliabilities.length,
    reliabilityDistribution: distribution
  }
}