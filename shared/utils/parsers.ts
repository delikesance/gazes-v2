

export interface AnimeSeason {
  name: string;
  url: string;
  type: string; // e.g. 'Anime', 'Kai', 'Film', etc.
}

export interface AnimeInfo {
  title: string;
  altTitle?: string;
  cover: string;
  banner?: string;
  synopsis: string;
  genres: string[];
  manga: { name: string; url: string }[];
  seasons: AnimeSeason[];
}

export function parseAnimePage(html: string): AnimeInfo {
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

  // For seasons and manga, use regex to find panneauAnime and panneauScan calls
  const seasons: AnimeSeason[] = [];
  const manga: { name: string; url: string }[] = [];

  // Find all panneauAnime calls
  const panneauAnimeRegex = /panneauAnime\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g;
  let match;
  while ((match = panneauAnimeRegex.exec(html)) !== null) {
    const name = (match[1] || "").trim();
    const url = (match[2] || "").trim();
    if (name && url && name.toLowerCase() !== "nom" && !url.includes("/catalogue/naruto/url")) {
      // Determine type from context or default to Anime
      // For simplicity, assume Anime unless Kai
      let type = "Anime";
      if (html.includes("Anime Version Kai") && html.indexOf("Anime Version Kai") < match.index) {
        type = "Kai";
      }
      seasons.push({ name, url, type });
    }
  }

  // Find all panneauScan calls for manga
  const panneauScanRegex = /panneauScan\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g;
  while ((match = panneauScanRegex.exec(html)) !== null) {
    const name = (match[1] || "").trim();
    const url = (match[2] || "").trim();
    if (name && url) {
      manga.push({ name, url });
    }
  }

  // Deduplicate seasons
  const seenSeason = new Set<string>();
  const uniqueSeasons = seasons.filter(s => {
    const key = `${s.type}|${s.url}`;
    if (seenSeason.has(key)) return false;
    seenSeason.add(key);
    return true;
  });

  // Deduplicate manga
  const seenManga = new Set<string>();
  const uniqueManga = manga.filter(m => {
    if (seenManga.has(m.url)) return false;
    seenManga.add(m.url);
    return true;
  });

  return {
    title,
    altTitle,
    cover,
    banner,
    synopsis,
    genres,
    manga: uniqueManga,
    seasons: uniqueSeasons,
  };
}
import type { SearchResponse } from "../types/searchResponse";

export function parseAnimeResults(html: string): SearchResponse {
  const results: SearchResponse = [];
  const animeRegex =
    /<a[^>]*href="(https:\/\/anime-sama\.(?:org|fr)\/catalogue\/[^\"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<h3[^>]*>([^<]*)<\/h3>[\s\S]*?<p[^>]*>([^<]*)<\/p>[\s\S]*?<\/a>/g;

  let match: RegExpExecArray | null;

  while ((match = animeRegex.exec(html)) !== null) {
    const [, url, image, title, aliasesText] = match;
    if (!title?.trim() || !url) continue;

    const aliases = aliasesText?.trim()
      ? aliasesText
          .split(",")
          .map((alias) => alias.trim())
          .filter(Boolean)
      : [];

    // Extract the slug as the FIRST segment after "/catalogue/"
    // This avoids picking up trailing segments like "saison1" or ending up with "catalogue"
    let id = "";
    try {
      // Use URL API when possible for robustness
      const u = new URL(url);
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("catalogue");
      if (idx !== -1 && parts[idx + 1]) {
        id = parts[idx + 1] || "";
      }
    } catch {
      // Fallback to string ops if URL constructor fails
      const afterCatalogue = url.split("/catalogue/")[1] || "";
      id = afterCatalogue.split("/").filter(Boolean)[0] || "";
    }
    if (!id || id === "catalogue") {
      // Skip invalid entries that don't have a proper slug
      continue;
    }
    console.log(
      `Parsed anime: title='${title.trim()}', id='${id}', url='${url}'`,
    );
    results.push({
      title: title.trim(),
      id,
      image: image || "",
    });
  }

  return results;
}

export interface CatalogueItem {
  id: string;
  title: string;
  image: string;
  type?: string; // e.g. 'Anime', 'Scans', etc.
}

// Parse the catalogue grid page for items. It contains anchors with posters and titles.
// We use regex for basic parsing.
export function parseCataloguePage(html: string): CatalogueItem[] {
  const items: CatalogueItem[] = [];

  // Regex to match catalogue items: <a href="/catalogue/slug"> or <a href="https://anime-sama.fr/catalogue/slug"> ... <img src="image"> ... <h1>title</h1> ... </a>
  const itemRegex = /<a[^>]*href="(?:https?:\/\/[^\/]+)?\/catalogue\/([^"\/]+)[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<h1[^>]*>([^<]*)<\/h1>/gi;

  let match;
  while ((match = itemRegex.exec(html)) !== null) {
    const slug = match[1];
    const image = match[2];
    const title = match[3]?.trim() || "";

    if (slug && image && title) {
      // Determine type: default to Anime, check for Scans or Film
      let type: string = 'Anime';
      const anchorText = match[0];
      if (anchorText.includes(' Scans')) type = 'Scans';
      else if (anchorText.includes(' Film ')) type = 'Film';

      items.push({ id: slug, title, image, type });
    }
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
