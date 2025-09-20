export const BLACKLIST_HOSTS = [
  'vidmoly.to',
  'vidmoly.me',
  'vidmoly.net',
  'vidmoly.org'
]

export function hostnameOf(u: string): string | null {
  try { return new URL(u).hostname.toLowerCase() } catch { return null }
}

export function isBlacklisted(u: string): boolean {
  const h = hostnameOf(u)
  if (!h) return false
  return BLACKLIST_HOSTS.some(b => h === b || h.endsWith(`.${b}`))
}

export function preferNonBlacklisted(urls: string[]): string | null {
  if (!Array.isArray(urls) || urls.length === 0) return null
  for (const u of urls) if (!isBlacklisted(u)) return u
  return urls[0] || null
}
