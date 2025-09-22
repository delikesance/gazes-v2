export function extractSeasonSlug(url: string, availableLanguages?: string[]): string {
  const parts = (url || "").split("/").filter(Boolean)
  const last = parts[parts.length - 1] || ""

  // If available languages are provided, check if the last part is a language
  if (availableLanguages && availableLanguages.includes(last)) {
    const potentialSeasonSlug = parts[parts.length - 2] || ""
    
    // Check if it's a known season slug (saison1, saison2, film, ova, etc.)
    const knownSeasonSlugs = ['saison', 'film', 'ova', 'special', 'kai']
    const isKnownSeasonSlug = knownSeasonSlugs.some(slug => potentialSeasonSlug.includes(slug)) ||
                             /^saison\d+$/.test(potentialSeasonSlug)
    
    // If it's a known season slug, return it
    if (isKnownSeasonSlug) {
      return potentialSeasonSlug
    }
    
    // Otherwise, it's probably the anime ID, so this is season 1
    return "saison1"
  }

  // Fallback to hardcoded check for backward compatibility
  if (last === "vf" || last === "vostfr") {
    const potentialSeasonSlug = parts[parts.length - 2] || ""
    const knownSeasonSlugs = ['saison', 'film', 'ova', 'special', 'kai']
    const isKnownSeasonSlug = knownSeasonSlugs.some(slug => potentialSeasonSlug.includes(slug)) ||
                             /^saison\d+$/.test(potentialSeasonSlug)
    
    if (isKnownSeasonSlug) {
      return potentialSeasonSlug
    }
    return "saison1"
  }
  
  // If last part is not a language, it's probably the season slug itself
  return last || "saison1"
}
