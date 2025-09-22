export function extractSeasonSlug(url: string): string {
  const parts = (url || "").split("/").filter(Boolean)
  const last = parts[parts.length - 1]
  return last === "vf" || last === "vostfr"
    ? parts[parts.length - 2] || "saison1"
    : last || "saison1"
}
