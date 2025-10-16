// Simple parsing functions for anime metadata population
// Based on the TypeScript parsers but simplified for Node.js

export function parseCataloguePage(html) {
  const items = [];

  // Regex to match catalogue items
  const itemRegex = /<a[^>]*href="(?:https?:\/\/[^\/]+)?\/catalogue\/([^"\/]+)[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<h1[^>]*>([^<]*)<\/h1>/gi;

  let match;
  while ((match = itemRegex.exec(html)) !== null) {
    const slug = match[1];
    const image = match[2];
    const title = match[3]?.trim() || "";

    if (slug && image && title) {
      // Determine type: default to Anime, check for Scans or Film
      let type = 'Anime';
      const anchorText = match[0];
      if (anchorText.includes(' Scans')) type = 'Scans';
      else if (anchorText.includes(' Film ')) type = 'Film';

      items.push({ id: slug, title, image, type });
    }
  }

  // Deduplicate by id
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function parseAnimePage(html) {
  // Extract title
  const titleMatch = html.match(/id="titreOeuvre"[^>]*>([^<]+)</i);
  const title = titleMatch ? (titleMatch[1]?.trim() || "Unknown Title") : "Unknown Title";

  // Extract alt title
  const altTitleMatch = html.match(/id="titreAlter"[^>]*>([^<]+)</i);
  const altTitle = altTitleMatch && altTitleMatch[1]?.trim() ? altTitleMatch[1]?.trim() : undefined;

  // Extract cover
  const coverMatch = html.match(/id="coverOeuvre"[^>]*src="([^"]+)"/i);
  const ogImageMatch = html.match(/property="og:image"[^>]*content="([^"]+)"/i);
  let cover = coverMatch?.[1] || ogImageMatch?.[1] || "";
  let banner = ogImageMatch?.[1] || undefined;
  if (banner && cover && banner === cover) banner = undefined;

  // Extract synopsis
  const synopsisMatch = html.match(/<h2[^>]*>Synopsis<\/h2>\s*<p[^>]*>([^<]+)<\/p>/i);
  const synopsis = synopsisMatch ? (synopsisMatch[1]?.trim() || "") : "";

  // Extract genres
  const genresMatch = html.match(/<h2[^>]*>Genres<\/h2>\s*<a[^>]*>([^<]+)<\/a>/i);
  const genres = genresMatch ? (genresMatch[1] || "").split(",").map(g => g.trim()).filter(Boolean) : [];

  // For seasons, use regex to find panneauAnime calls
  const seasons = [];

  // Remove all comments (/* ... */) from HTML first
  const uncommentedHtml = html.replace(/\/\*[\s\S]*?\*\//g, '');

  let match;
  const panneauAnimeRegex = /panneauAnime\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g;
  while ((match = panneauAnimeRegex.exec(uncommentedHtml)) !== null) {
    const name = (match[1] || "").trim();
    const url = (match[2] || "").trim();
    if (name && url && name.toLowerCase() !== "nom" && !url.includes("/catalogue/naruto/url")) {
      // Determine type from context or default to Anime
      let type = "Anime";
      if (html.includes("Anime Version Kai") && html.indexOf("Anime Version Kai") < match.index) {
        type = "Kai";
      }
      seasons.push({ name, url, type });
    }
  }

  // Deduplicate seasons
  const seasonMap = new Map();
  const uniqueSeasons = seasons.filter(s => {
    const seasonNumber = extractSeasonNumber(s.name) || extractSeasonNumber(s.url) || 1;

    if (!seasonMap.has(seasonNumber)) {
      seasonMap.set(seasonNumber, s);
      return true;
    }

    return false;
  });

  return {
    title,
    altTitle,
    cover,
    banner,
    synopsis,
    genres,
    seasons: uniqueSeasons,
  };
}

// Helper function to extract season number from name or URL
function extractSeasonNumber(text) {
  if (!text) return null;

  // Look for patterns like "Saison 1", "Season 1", "S1", etc.
  const patterns = [
    /saison\s*(\d+)/i,
    /season\s*(\d+)/i,
    /\bs(\d+)\b/i,
    /(\d+)(?:st|nd|rd|th)?\s*(?:saison|season)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1]);
    }
  }

  // If no season number found, check if it's a special case like "Film" or "OAV"
  if (text.toLowerCase().includes('film') || text.toLowerCase().includes('oav')) {
    return 0; // Special season number for movies/OAVs
  }

  return null;
}