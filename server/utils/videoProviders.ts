// Video provider reliability management
export interface VideoProvider {
  hostname: string
  reliability: number // 1-10 scale, 10 being most reliable
  description: string
  extractionPatterns?: string[] // Common patterns this provider uses
  knownIssues?: string[] // Known limitations or issues
}

// Re-export from shared utils
export {
  VERIFIED_PROVIDERS,
  getProviderInfo,
  getProviderReliability,
  sortUrlsByProviderReliability,
  getBestProviderUrl,
  categorizeUrlsByReliability
} from '~/shared/utils/videoProviders'

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
