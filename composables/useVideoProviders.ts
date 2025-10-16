// Frontend utility for managing video providers and source selection
export interface VideoProvider {
  hostname: string
  reliability: number
  description: string
}

export interface VideoSource {
  type: 'hls' | 'mp4' | 'unknown'
  url: string
  proxiedUrl: string
  quality?: string
  provider?: VideoProvider
}

// Get the best video source from a list based on provider reliability
export function getBestVideoSource(sources: VideoSource[]): VideoSource | null {
  if (!sources || sources.length === 0) return null

  // Sort by provider reliability (highest first), then by type preference (MP4 > HLS > unknown)
  const sorted = [...sources].sort((a, b) => {
    // First priority: provider reliability
    const reliabilityA = a.provider?.reliability || 0
    const reliabilityB = b.provider?.reliability || 0
    if (reliabilityA !== reliabilityB) {
      return reliabilityB - reliabilityA
    }

    // Second priority: video type preference
    const typeScoreA = getTypeScore(a.type)
    const typeScoreB = getTypeScore(b.type)
    return typeScoreB - typeScoreA
  })

  return sorted[0] || null
}

// Score video types by preference (higher is better)
function getTypeScore(type: string): number {
  switch (type) {
    case 'mp4': return 3
    case 'hls': return 2
    case 'unknown': return 1
    default: return 0
  }
}

// Group sources by provider reliability categories
export function categorizeVideoSources(sources: VideoSource[]): {
  excellent: VideoSource[] // reliability >= 9
  good: VideoSource[] // reliability 7-8
  medium: VideoSource[] // reliability 4-6
  poor: VideoSource[] // reliability 1-3
  unknown: VideoSource[] // no provider info
} {
  const result = {
    excellent: [] as VideoSource[],
    good: [] as VideoSource[],
    medium: [] as VideoSource[],
    poor: [] as VideoSource[],
    unknown: [] as VideoSource[]
  }

  sources.forEach(source => {
    const reliability = source.provider?.reliability || 0
    if (reliability >= 9) result.excellent.push(source)
    else if (reliability >= 7) result.good.push(source)
    else if (reliability >= 4) result.medium.push(source)
    else if (reliability >= 1) result.poor.push(source)
    else result.unknown.push(source)
  })

  return result
}

// Get fallback sources in order of preference
export function getFallbackSources(sources: VideoSource[], excludeReliabilityBelow = 4): VideoSource[] {
  return sources
    .filter(source => (source.provider?.reliability || 0) >= excludeReliabilityBelow)
    .sort((a, b) => {
      const reliabilityA = a.provider?.reliability || 0
      const reliabilityB = b.provider?.reliability || 0
      return reliabilityB - reliabilityA
    })
}

// Check if a provider is considered reliable (reliability >= 7)
export function isReliableProvider(source: VideoSource): boolean {
  return (source.provider?.reliability || 0) >= 7
}

// Get provider hostname from URL
export function getProviderHostname(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

// Format provider info for display
export function formatProviderInfo(provider: VideoProvider | undefined): string {
  if (!provider) return 'Unknown provider'
  return `${provider.hostname} (${provider.reliability}/10)`
}

// Debug helper to log source selection process
export function debugSourceSelection(sources: VideoSource[], selectedSource: VideoSource | null): void {
  // Only log in development mode (client-side check)
  if (typeof window !== 'undefined' && window.location?.search?.includes('debug=1')) {
    console.group('🎯 Video Source Selection Debug')
    
    sources.forEach((source, index) => {
      const provider = source.provider
      const isSelected = source === selectedSource
        `${isSelected ? '✅' : '  '} ${index + 1}. ${source.type.toUpperCase()} - ${
          provider ? `${provider.hostname} (${provider.reliability}/10)` : 'Unknown provider'
        }`
      )
    })
    
    if (selectedSource) {
    } else {
    }
    
    console.groupEnd()
  }
}