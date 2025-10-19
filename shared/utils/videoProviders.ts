// Video provider reliability management - Shared between client and server
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
    hostname: 'vidmoly.to',
    reliability: 10,
    description: 'VidMoly - Priorité élevée pour de meilleures performances',
    extractionPatterns: ['MP4/M3U8 in script tags'],
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
    hostname: 'video.sibnet.ru',
    reliability: 7,
    description: 'SibNet - Bon MP4 mais priorité réduite',
    extractionPatterns: ['MP4 relative paths in JavaScript'],
    knownIssues: ['Requires relative-to-absolute URL conversion']
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
    hostname: 'www.myvi.tv',
    reliability: 3,
    description: 'MyVi - Requires advanced JavaScript extraction',
    extractionPatterns: ['Dynamic JavaScript loading'],
    knownIssues: ['Complex obfuscation', 'Anti-bot protection']
  },
  {
    hostname: 'sendvid.com',
    reliability: 1,
    description: 'SendVid - Frequently returns 404 errors',
    extractionPatterns: ['MP4 direct links in HTML'],
    knownIssues: ['Many URLs returning 404 Not Found', 'Poor reliability']
  },
  {
    hostname: 'www.mp4upload.com',
    reliability: 6,
    description: 'MP4Upload - Good for MP4 files',
    extractionPatterns: ['Direct MP4 links'],
    knownIssues: []
  },
  {
    hostname: 'www.fembed.com',
    reliability: 5,
    description: 'Fembed - Standard video hosting',
    extractionPatterns: ['MP4/M3U8 extraction'],
    knownIssues: ['May require API calls']
  },
  {
    hostname: 'www.mixdrop.co',
    reliability: 4,
    description: 'MixDrop - Medium reliability',
    extractionPatterns: ['JavaScript-based extraction'],
    knownIssues: ['Sometimes slow loading']
  },
  {
    hostname: 'www.vidlox.tv',
    reliability: 3,
    description: 'VidLox - Basic video hosting',
    extractionPatterns: ['Standard patterns'],
    knownIssues: ['Lower reliability']
  }
]

// Helper function to get provider info by hostname
export function getProviderInfo(url: string): VideoProvider | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return VERIFIED_PROVIDERS.find(p =>
      hostname === p.hostname ||
      hostname.includes(p.hostname.split('.')[0] || '') ||
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
  return sorted.length > 0 ? (sorted[0] as string) : null
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
