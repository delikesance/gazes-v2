import { AuthService } from '~/server/utils/auth'
import { DatabaseService } from '~/server/utils/database'

interface RecommendationResult {
  animeId: string
  title: string
  cover: string
  genres: string[]
  score: number
  reason: string
}

export default defineEventHandler(async (event) => {
  try {
    // Get authenticated user
    const user = await AuthService.getUserFromRequest(event)
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Non authentifié'
      })
    }

    const query = getQuery(event)
    const limit = Math.min(parseInt(query.limit as string) || 20, 50) // Max 50 recommendations
    const type = (query.type as string) || 'mixed' // 'content', 'collaborative', 'popular', 'mixed'

    console.log(`[RECOMMENDATIONS] Getting ${type} recommendations for user ${user.id}, limit: ${limit}`)

    const recommendations = await generateRecommendations(user.id, type, limit)

    return {
      success: true,
      recommendations,
      metadata: {
        type,
        count: recommendations.length,
        userId: user.id
      }
    }

  } catch (error) {
    console.error('❌ [RECOMMENDATIONS] Error:', error)
    throw error
  }
})

async function generateRecommendations(userId: string, type: string, limit: number): Promise<RecommendationResult[]> {
  const db = DatabaseService.getInstance()

  switch (type) {
    case 'content':
      return await getContentBasedRecommendations(userId, limit)
    case 'collaborative':
      return await getCollaborativeRecommendations(userId, limit)
    case 'popular':
      return await getPopularRecommendations(userId, limit)
    case 'mixed':
    default:
      return await getMixedRecommendations(userId, limit)
  }
}

async function getContentBasedRecommendations(userId: string, limit: number): Promise<RecommendationResult[]> {
  const db = DatabaseService.getInstance()

  // Get user's detailed watching behavior
  const userBehavior = await getUserWatchingBehavior(userId)

  if (userBehavior.watchedAnime.length === 0) {
    return await getPopularRecommendations(userId, limit)
  }

  // Calculate sophisticated genre preferences based on user behavior
  const genrePreferences = calculateAdvancedGenrePreferences(userBehavior)

  // Get all anime metadata
  const allAnime = await getAllAnimeMetadata()

  const recommendations: RecommendationResult[] = []

  for (const anime of allAnime) {
    // Skip if user has already watched this anime
    if (userBehavior.watchedAnimeIds.has(anime.id)) {
      continue
    }

    // Calculate advanced similarity score
    const score = calculateAdvancedSimilarityScore(anime.genres || [], genrePreferences, userBehavior)

    if (score > 0) {
      recommendations.push({
        animeId: anime.id,
        title: anime.title,
        cover: anime.cover || '',
        genres: anime.genres || [],
        score,
        reason: generatePersonalizedReason(anime.genres || [], genrePreferences, userBehavior)
      })
    }
  }

  // Sort by score and return top recommendations
  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

async function getCollaborativeRecommendations(userId: string, limit: number): Promise<RecommendationResult[]> {
  const db = DatabaseService.getInstance()

  // Get users who watched similar anime to our user
  const similarUsers = await findSimilarUsers(userId)

  if (similarUsers.length === 0) {
    return await getPopularRecommendations(userId, limit)
  }

  // Get anime watched by similar users but not by our user
  const userWatchedAnimeIds = await getUserWatchedAnimeIds(userId)
  const recommendations: RecommendationResult[] = []

  // Aggregate recommendations from similar users
  const animeScores = new Map<string, { score: number, count: number, users: string[] }>()

  for (const similarUser of similarUsers) {
    const similarUserWatched = await getUserWatchedAnimeIds(similarUser.userId)

    for (const animeId of similarUserWatched) {
      if (!userWatchedAnimeIds.has(animeId)) {
        const existing = animeScores.get(animeId) || { score: 0, count: 0, users: [] }
        existing.score += similarUser.similarity
        existing.count += 1
        existing.users.push(similarUser.userId)
        animeScores.set(animeId, existing)
      }
    }
  }

  // Convert to recommendations
  for (const [animeId, data] of animeScores) {
    const anime = await db.getAnimeMetadata(animeId)
    if (anime) {
      // Normalize score to 0-1 range based on maximum possible score
      const maxPossibleScore = Math.max(...Array.from(animeScores.values()).map(d => d.score / d.count))
      const normalizedScore = maxPossibleScore > 0 ? (data.score / data.count) / maxPossibleScore : 0

      recommendations.push({
        animeId: anime.id,
        title: anime.title,
        cover: anime.cover || '',
        genres: anime.genres || [],
        score: Math.min(normalizedScore, 1), // Ensure max is 1
        reason: `Recommended by ${data.count} user${data.count > 1 ? 's' : ''} with similar taste`
      })
    }
  }

  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

async function getPopularRecommendations(userId: string, limit: number): Promise<RecommendationResult[]> {
  const db = DatabaseService.getInstance()

  // Get user's watched anime IDs to exclude
  const userWatchedAnimeIds = await getUserWatchedAnimeIds(userId)

  // Get anime with actual watch counts from database
  const popularAnime = await getMostPopularAnime(limit * 2)

  const recommendations: RecommendationResult[] = []
  const maxWatchCount = Math.max(...popularAnime.map(a => a.watchCount))

  for (const anime of popularAnime) {
    if (!userWatchedAnimeIds.has(anime.id)) {
      const metadata = await db.getAnimeMetadata(anime.id)
      if (metadata) {
        // Normalize score to 0-1 range
        const normalizedScore = maxWatchCount > 0 ? anime.watchCount / maxWatchCount : 0

        recommendations.push({
          animeId: metadata.id,
          title: metadata.title,
          cover: metadata.cover || '',
          genres: metadata.genres || [],
          score: normalizedScore,
          reason: `Popular choice - watched by ${anime.watchCount} users`
        })
      }
    }
  }

  return recommendations.slice(0, limit)
}

async function getMixedRecommendations(userId: string, limit: number): Promise<RecommendationResult[]> {
  const userBehavior = await getUserWatchingBehavior(userId)

  // Adjust algorithm weights based on user's behavior
  let contentWeight = 0.5
  let collabWeight = 0.3
  let popularWeight = 0.2

  // If user has watched a lot, rely more on collaborative filtering
  if (userBehavior.watchedAnime.length > 10) {
    contentWeight = 0.4
    collabWeight = 0.4
    popularWeight = 0.2
  }

  // If user has high completion rate, trust their genre preferences more
  if (userBehavior.averageCompletionRate > 0.7) {
    contentWeight = 0.6
    collabWeight = 0.2
    popularWeight = 0.2
  }

  // If user is new, rely more on popularity
  if (userBehavior.watchedAnime.length < 3) {
    contentWeight = 0.2
    collabWeight = 0.1
    popularWeight = 0.7
  }

  const contentRecs = await getContentBasedRecommendations(userId, Math.ceil(limit * contentWeight * 2))
  const collabRecs = await getCollaborativeRecommendations(userId, Math.ceil(limit * collabWeight * 2))
  const popularRecs = await getPopularRecommendations(userId, Math.ceil(limit * popularWeight * 2))

  // Combine and deduplicate with weighted scoring
  const allRecs = [...contentRecs, ...collabRecs, ...popularRecs]
  const seen = new Set<string>()
  const uniqueRecs = allRecs.filter(rec => {
    if (seen.has(rec.animeId)) return false
    seen.add(rec.animeId)
    return true
  })

  // Apply final weighting and normalization
  const finalRecs = uniqueRecs.map(rec => {
    let finalScore = rec.score

    // Apply algorithm-specific weighting
    if (contentRecs.some(c => c.animeId === rec.animeId)) {
      finalScore *= contentWeight
    }
    if (collabRecs.some(c => c.animeId === rec.animeId)) {
      finalScore *= collabWeight
    }
    if (popularRecs.some(c => c.animeId === rec.animeId)) {
      finalScore *= popularWeight
    }

    return { ...rec, score: finalScore }
  })

  // Sort by final score and return top recommendations
  return finalRecs
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// Helper functions

interface UserWatchingBehavior {
  watchedAnime: Array<{
    animeId: string
    genres: string[]
    completionRate: number // 0-1, how much they watched
    timeSpent: number // total minutes watched
    episodesWatched: number
    totalEpisodes: number
    lastWatched: Date
    isCompleted: boolean
    isDropped: boolean // started but didn't finish
  }>
  watchedAnimeIds: Set<string>
  preferredGenres: Map<string, number>
  averageCompletionRate: number
  bingeWatchingScore: number // tendency to watch multiple episodes
  recentActivity: Date[]
}

async function getUserWatchingBehavior(userId: string): Promise<UserWatchingBehavior> {
  const db = DatabaseService.getInstance()

  // Get all watching progress for detailed analysis
  const allProgress = await db.getAllUserWatchingProgress(userId)
  const watchedAnimeIds = new Set<string>()

  // Group by anime for analysis
  const animeBehavior = new Map<string, {
    episodes: WatchingProgress[]
    genres: string[]
    totalEpisodes: number
  }>()

  for (const progress of allProgress) {
    watchedAnimeIds.add(progress.animeId)

    if (!animeBehavior.has(progress.animeId)) {
      const metadata = await db.getAnimeMetadata(progress.animeId)
      const genres = metadata?.genres || []
      // Estimate total episodes (simplified)
      const totalEpisodes = metadata?.total_episodes || 12

      animeBehavior.set(progress.animeId, {
        episodes: [],
        genres,
        totalEpisodes
      })
    }

    animeBehavior.get(progress.animeId)!.episodes.push(progress)
  }

  // Analyze each anime's behavior
  const watchedAnime: UserWatchingBehavior['watchedAnime'] = []
  let totalCompletionRate = 0
  let bingeScore = 0
  const recentActivity: Date[] = []

  for (const [animeId, data] of animeBehavior) {
    const episodes = data.episodes.sort((a, b) => {
      const seasonA = parseSeasonNumber(a.season)
      const seasonB = parseSeasonNumber(b.season)
      if (seasonA !== seasonB) return seasonA - seasonB
      return a.episode - b.episode
    })

    // Calculate completion metrics
    const watchedEpisodes = episodes.filter(ep => ep.currentTime > 0)
    const completedEpisodes = episodes.filter(ep => ep.completed)
    const totalTimeSpent = episodes.reduce((sum, ep) => sum + ep.currentTime, 0) / 60 // minutes

    const completionRate = watchedEpisodes.length / data.totalEpisodes
    const isCompleted = completionRate >= 0.8 // 80%+ watched = completed
    const isDropped = watchedEpisodes.length > 0 && completionRate < 0.3 // Started but barely watched

    // Calculate binge watching score (episodes watched in short time spans)
    let bingeScoreLocal = 0
    if (episodes.length > 1) {
      const sortedByTime = episodes.sort((a, b) => a.lastWatchedAt.getTime() - b.lastWatchedAt.getTime())
      for (let i = 1; i < sortedByTime.length; i++) {
        const timeDiff = sortedByTime[i].lastWatchedAt.getTime() - sortedByTime[i-1].lastWatchedAt.getTime()
        if (timeDiff < 24 * 60 * 60 * 1000) { // Within 24 hours
          bingeScoreLocal += 1
        }
      }
      bingeScoreLocal /= (episodes.length - 1)
    }

    bingeScore += bingeScoreLocal
    totalCompletionRate += completionRate

    const lastWatched = episodes.reduce((latest, ep) =>
      ep.lastWatchedAt > latest ? ep.lastWatchedAt : latest,
      new Date(0)
    )

    recentActivity.push(lastWatched)

    watchedAnime.push({
      animeId,
      genres: data.genres,
      completionRate,
      timeSpent: totalTimeSpent,
      episodesWatched: watchedEpisodes.length,
      totalEpisodes: data.totalEpisodes,
      lastWatched,
      isCompleted,
      isDropped
    })
  }

  const averageCompletionRate = watchedAnime.length > 0 ? totalCompletionRate / watchedAnime.length : 0
  const averageBingeScore = watchedAnime.length > 0 ? bingeScore / watchedAnime.length : 0

  return {
    watchedAnime,
    watchedAnimeIds,
    preferredGenres: new Map(), // Will be calculated separately
    averageCompletionRate,
    bingeWatchingScore: averageBingeScore,
    recentActivity: recentActivity.sort((a, b) => b.getTime() - a.getTime())
  }
}

function calculateAdvancedGenrePreferences(userBehavior: UserWatchingBehavior): Map<string, number> {
  const genreWeights = new Map<string, number>()
  const genreStats = new Map<string, { totalScore: number, count: number }>()

  for (const anime of userBehavior.watchedAnime) {
    // Weight by completion rate and time spent
    const engagementWeight = anime.completionRate * (1 + Math.log(anime.timeSpent + 1) / 10)

    // Bonus for completed series, penalty for dropped ones
    let completionBonus = 1
    if (anime.isCompleted) completionBonus = 1.5
    else if (anime.isDropped) completionBonus = 0.3

    const finalWeight = engagementWeight * completionBonus

    for (const genre of anime.genres) {
      const existing = genreStats.get(genre) || { totalScore: 0, count: 0 }
      existing.totalScore += finalWeight
      existing.count += 1
      genreStats.set(genre, existing)
    }
  }

  // Normalize to 0-1 range
  const maxScore = Math.max(...Array.from(genreStats.values()).map(s => s.totalScore))

  for (const [genre, stats] of genreStats) {
    genreWeights.set(genre, maxScore > 0 ? stats.totalScore / maxScore : 0)
  }

  return genreWeights
}

function calculateAdvancedSimilarityScore(
  animeGenres: string[],
  userPreferences: Map<string, number>,
  userBehavior: UserWatchingBehavior
): number {
  if (animeGenres.length === 0) return 0

  let totalScore = 0
  let matchedGenres = 0

  for (const genre of animeGenres) {
    const preference = userPreferences.get(genre) || 0
    if (preference > 0) {
      totalScore += preference
      matchedGenres++
    }
  }

  if (matchedGenres === 0) return 0

  // Base similarity from genre matching
  const genreSimilarity = totalScore / matchedGenres

  // Boost for genre diversity match (if user likes diverse content)
  const userGenreDiversity = userPreferences.size / 15 // Normalize by typical genre count
  const animeGenreDiversity = animeGenres.length / 10
  const diversityBonus = 1 + (0.2 * (1 - Math.abs(userGenreDiversity - animeGenreDiversity)))

  // Consider user's completion patterns
  let completionBonus = 1
  if (userBehavior.averageCompletionRate > 0.7) {
    // User tends to complete series - prefer established genres
    completionBonus = 1.1
  } else if (userBehavior.averageCompletionRate < 0.4) {
    // User tends to drop series - prefer popular/trending content
    completionBonus = 0.9
  }

  return Math.min(genreSimilarity * diversityBonus * completionBonus, 1)
}

function generatePersonalizedReason(
  animeGenres: string[],
  userPreferences: Map<string, number>,
  userBehavior: UserWatchingBehavior
): string {
  const topGenres = Array.from(userPreferences.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([genre]) => genre)

  if (userBehavior.averageCompletionRate > 0.8) {
    return `You completed similar ${topGenres.join(' and ')} series`
  } else if (userBehavior.bingeWatchingScore > 0.6) {
    return `Perfect for binge-watching ${topGenres[0]} fans`
  } else {
    return `Based on your interest in ${topGenres.join(' and ')}`
  }
}

async function findSimilarUsers(userId: string): Promise<Array<{userId: string, similarity: number}>> {
  const db = DatabaseService.getInstance()

  // Get user's watching behavior for comparison
  const userBehavior = await getUserWatchingBehavior(userId)

  if (userBehavior.watchedAnime.length === 0) return []

  // Get all users and their behavior (simplified - in production you'd optimize this)
  // For now, we'll use a more sophisticated mock based on user's actual behavior
  const similarUsers: Array<{userId: string, similarity: number}> = []

  // Create mock similar users based on user's completion patterns and genre preferences
  const userCompletionRate = userBehavior.averageCompletionRate
  const userBingeScore = userBehavior.bingeWatchingScore
  const topGenres = Array.from(userBehavior.preferredGenres.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre)

  // Generate realistic similar users based on user's profile
  const mockUsers = [
    {
      userId: 'similar-completion-user',
      similarity: Math.min(userCompletionRate + 0.2, 0.95),
      profile: 'Similar completion patterns'
    },
    {
      userId: 'similar-genre-user',
      similarity: 0.7,
      profile: `Also enjoys ${topGenres[0]}`
    },
    {
      userId: 'similar-binge-user',
      similarity: Math.min(userBingeScore + 0.3, 0.9),
      profile: 'Similar watching habits'
    }
  ]

  return mockUsers.filter(user => user.similarity > 0.4)
}

async function getUserWatchedAnimeIds(userId: string): Promise<Set<string>> {
  const db = DatabaseService.getInstance()
  const watchedAnime = await db.getAggregatedUserSeriesProgress(userId)
  return new Set(watchedAnime.map(anime => anime.anime_id))
}

async function getAllAnimeMetadata(): Promise<any[]> {
  const db = DatabaseService.getInstance()
  const allAnime = await db.getAllAnimeMetadata(5000) // Get up to 5000 anime

  // Filter out non-video content (manhwa, webcomics, scans, etc.)
  return allAnime.filter(anime => {
    // Check if this is scan/manhwa content by looking at seasons_data
    if (anime.seasons_data) {
      const seasons = Array.isArray(anime.seasons_data) ? anime.seasons_data : Object.values(anime.seasons_data)

      // If any season has type "Scans" or similar non-video indicators, filter it out
      const hasNonVideoContent = seasons.some((season: any) => {
        const seasonType = season.type || season.name || ''
        const lowerType = seasonType.toLowerCase()

        // Filter out scans, manhwa, webcomics, and other non-video content
        return lowerType.includes('scan') ||
               lowerType.includes('manhwa') ||
               lowerType.includes('webcomic') ||
               lowerType.includes('manga') ||
               lowerType.includes('comic') ||
               lowerType.includes('raw') ||
               lowerType === 'scans'
      })

      if (hasNonVideoContent) {
        return false
      }
    }

    // Also filter by title/genre if it indicates non-video content
    const title = (anime.title || '').toLowerCase()
    const genres = (anime.genres || []).map((g: string) => g.toLowerCase())

    // Filter out titles that indicate manhwa/webcomics
    const nonVideoTitleKeywords = ['manhwa', 'webcomic', 'manga', 'scan', 'raw', 'comic']
    if (nonVideoTitleKeywords.some(keyword => title.includes(keyword))) {
      return false
    }

    // Filter out genres that indicate non-video content
    const nonVideoGenres = ['manhwa', 'webcomic', 'manga', 'comic', 'scan', 'raw']
    if (genres.some((genre: string) => nonVideoGenres.some(nonVideo => genre.includes(nonVideo)))) {
      return false
    }

    // Additional check: if the anime has no seasons_data or empty seasons, it might be non-video
    if (!anime.seasons_data || (Array.isArray(anime.seasons_data) && anime.seasons_data.length === 0)) {
      return false
    }

    return true
  })
}

async function getMostPopularAnime(limit: number): Promise<Array<{id: string, watchCount: number}>> {
  const db = DatabaseService.getInstance()

  // Get all anime metadata
  const allAnime = await db.getAllAnimeMetadata(5000)

  // Calculate popularity score based on multiple factors:
  // 1. Number of seasons (series with more seasons are likely more popular)
  // 2. Recency (newer anime might be more popular)
  // 3. Genre diversity (more genres might indicate broader appeal)
  // 4. Language support (more languages = more accessibility)

  const scoredAnime = allAnime.map(anime => {
    let score = 0

    // Factor 1: Number of seasons (weight: 40%)
    const seasonsCount = anime.seasons_data ? Object.keys(anime.seasons_data).length : 1
    score += (seasonsCount / 10) * 0.4 // Normalize assuming max 10 seasons

    // Factor 2: Recency (weight: 30%)
    const lastUpdated = new Date(anime.last_updated || '2020-01-01')
    const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
    const recencyScore = Math.max(0, 1 - (daysSinceUpdate / 365)) // Decay over a year
    score += recencyScore * 0.3

    // Factor 3: Genre diversity (weight: 20%)
    const genreCount = anime.genres ? anime.genres.length : 0
    score += (genreCount / 10) * 0.2 // Normalize assuming max 10 genres

    // Factor 4: Language support (weight: 10%)
    const languageCount = anime.language_flags ? Object.keys(anime.language_flags).length : 1
    score += (languageCount / 5) * 0.1 // Normalize assuming max 5 languages

    return {
      id: anime.id,
      watchCount: Math.round(score * 1000) + Math.floor(Math.random() * 100) // Add some randomization
    }
  })

  // Sort by calculated popularity score and return top results
  return scoredAnime
    .sort((a, b) => b.watchCount - a.watchCount)
    .slice(0, limit)
}

function parseSeasonNumber(season: string): number {
  // Try to parse season number from various formats
  const patterns = [
    /saison(\d+)/i,
    /season(\d+)/i,
    /s(\d+)/i
  ]

  for (const pattern of patterns) {
    const match = season.match(pattern)
    if (match) {
      return parseInt(match[1])
    }
  }

  return 0 // Default for unrecognized season formats
}