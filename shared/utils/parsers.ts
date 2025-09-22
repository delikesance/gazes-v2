import * as cheerio from "cheerio";

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
  const $ = cheerio.load(html);

  // Title
  const title = $("#titreOeuvre").text().trim();

  // Alternate title
  const altTitle = $("#titreAlter").text().trim() || undefined;

  // Cover image and banner (OG image)
  const coverFromDom = $("#coverOeuvre").attr("src") || "";
  const ogImage = $('meta[property="og:image"]').attr("content") || undefined;
  // Prefer explicit cover, fallback to og:image
  let cover = coverFromDom || ogImage || "";
  let banner: string | undefined = ogImage;
  // If banner equals cover, omit banner to avoid duplication
  if (banner && cover && banner.trim() === cover.trim()) banner = undefined;

  // Synopsis
  const synopsis = $('h2:contains("Synopsis")').next("p").text().trim();

  // Genres
  const genresText = $('h2:contains("Genres")').next("a").text().trim();
  const genres = genresText
    .split(",")
    .map((g: string) => g.trim())
    .filter(Boolean);

  // We'll build seasons and manga per section, then derive animeVersions from seasons
  const seasons: AnimeSeason[] = [];
  const manga: { name: string; url: string }[] = [];

  // Resolve URLs against canonical base when relative
  const canonicalHref = $('link[rel="canonical"]').attr("href") || "";
  const basePath = canonicalHref.endsWith("/")
    ? canonicalHref
    : canonicalHref
      ? canonicalHref + "/"
      : "/";
  const resolveUrl = (u: string): string => {
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith("/")) return u;
    return basePath + u.replace(/^\//, "");
  };

  // Normalize internal URLs to drop '/catalogue' prefix so we return '/<slug>/...'
  const formatUrl = (u: string): string => {
    const resolved = resolveUrl(u);
    if (!resolved) return resolved;
    if (/^https?:\/\//i.test(resolved)) return resolved; // keep absolute as-is
    return resolved.replace(/^\/catalogue\//, "/");
  };

  // Helper: parse panels from anchors within a container
  const collectFromAnchors = ($container: any, type: string) => {
    $container.find("a").each((_: number, a: any) => {
      const name = $(a).find("div").text().trim();
      const url = formatUrl($(a).attr("href") || "");
      if (!name || !url) return;
      if (type === "Manga") manga.push({ name, url });
      else seasons.push({ name, url, type });
    });
  };

  // Helper: parse panels from script calls like panneauAnime("name", "url") or panneauScan(...)
  const collectFromScripts = ($container: any, type: string) => {
    let scriptText = $container
      .find("script")
      .map((_: number, s: any) => $(s).text())
      .get()
      .join("\n");
    if (!scriptText) return;
    // Strip single-line and block comments to avoid picking placeholder examples
    scriptText = scriptText
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\n)\s*\/\/.*$/gm, "");
    const re =
      type === "Manga"
        ? /panneauScan\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g
        : /panneauAnime\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(scriptText)) !== null) {
      const name = (m[1] || "").trim();
      const url = formatUrl((m[2] || "").trim());
      // Skip placeholders
      if (
        !name ||
        !url ||
        name.toLowerCase() === "nom" ||
        url === "/catalogue/naruto/url"
      )
        continue;
      if (type === "Manga") manga.push({ name, url });
      else seasons.push({ name, url, type });
    }
  };

  // Parse sections by headers
  $("h2").each((_: number, el: any) => {
    const header = $(el).text().trim();
    let type: string | null = null;
    if (header === "Anime" || header === "Serie") type = "Anime";
    else if (header === "Anime Version Kai") type = "Kai";
    else if (header === "Manga") type = "Manga";
    if (!type) return;

    // Panel container is the next flex-wrap block, regardless of extra classes
    const $panel = $(el).nextAll(".flex.flex-wrap").first();
    if (!$panel || $panel.length === 0) return;

    // First try anchors if present
    collectFromAnchors($panel, type);
    // Then try parsing the inline scripts (document.write templates) as fallback
    if (
      (type === "Manga" && manga.length === 0) ||
      (type !== "Manga" && seasons.filter((s) => s.type === type).length === 0)
    ) {
      collectFromScripts($panel, type);
    }
  });

  // Deduplicate seasons by (type + url)
  const seenSeason = new Set<string>();
  const uniqueSeasons: AnimeSeason[] = [];
  for (const s of seasons) {
    const key = `${s.type}|${s.url}`;
    if (seenSeason.has(key)) continue;
    seenSeason.add(key);
    uniqueSeasons.push(s);
  }

  // Deduplicate manga by url
  const seenManga = new Set<string>();
  const uniqueManga: { name: string; url: string }[] = [];
  for (const m of manga) {
    if (seenManga.has(m.url)) continue;
    seenManga.add(m.url);
    uniqueManga.push(m);
  }

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
    /<a[^>]*href="(https:\/\/anime-sama\.org\/catalogue\/[^\"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<h3[^>]*>([^<]*)<\/h3>[\s\S]*?<p[^>]*>([^<]*)<\/p>[\s\S]*?<\/a>/g;

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
// We use cheerio for resilience across minor markup changes.
export function parseCataloguePage(html: string): CatalogueItem[] {
  const $ = cheerio.load(html);
  const items: CatalogueItem[] = [];

  // Try to find cards; anime-sama catalogue tends to use anchors wrapping an image and title.
  // Strategy: select all anchors under the main catalogue container that link to /catalogue/<slug>
  $('a[href*="/catalogue/"]').each((_, a) => {
    const href = $(a).attr("href") || "";
    const u = (() => {
      try {
        return new URL(href, "https://anime-sama.fr");
      } catch {
        return null;
      }
    })();
    if (!u) return;
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("catalogue");
    const slug = idx !== -1 ? parts[idx + 1] : "";
    if (!slug) return;

    // Title: try common heading tags, then elements with title-like classes, then img alt, then anchor text
    let title = $(a).find("h1, h2, h3, h4").first().text().trim();
    if (!title)
      title = $(a)
        .find('[class*="title" i], [class*="name" i]')
        .first()
        .text()
        .trim();
    if (!title) title = $(a).find("img").attr("alt")?.trim() || "";
    if (!title) title = $(a).text().replace(/\s+/g, " ").trim();
    if (!title) return;

    // Extract type from the full anchor text
    const fullText = $(a).text().replace(/\s+/g, " ").trim();
    let type = 'Unknown';
    
    // Prioritize detection in this order
    if (fullText.includes(' Scans')) {
      type = 'Scans';
    } else if (fullText.includes(' Anime ') || fullText.includes(' VOSTFR') || fullText.includes(' VF')) {
      type = 'Anime';
    } else if (fullText.includes(' Film ')) {
      type = 'Film';
    } else {
      // If it's not explicitly anime, film, or scans, skip it (like Kai, etc.)
      return;
    }

    // Image: handle lazy-loaded images and srcset
    const $img = $(a).find("img").first();
    let image = $img.attr("src") || "";
    if (!image)
      image = $img.attr("data-src") || $img.attr("data-lazy-src") || "";
    if (!image) {
      const srcset = $img.attr("srcset") || "";
      if (srcset) {
        // pick the first URL from srcset
        const first = srcset.split(",")[0]?.trim().split(" ")[0];
        if (first) image = first;
      }
    }
    if (!image) return;

    items.push({ id: slug, title, image, type });
  });

  // Deduplicate by id
  const seen = new Set<string>();
  return items.filter((it) =>
    seen.has(it.id) ? false : (seen.add(it.id), true),
  );
}
