import { d as defineEventHandler, g as getQuery, c as createError, i as isBlacklisted, h as hostnameOf, b as preferNonBlacklisted } from '../../../../nitro/nitro.mjs';
import 'jsonwebtoken';
import 'bcryptjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import '@supabase/supabase-js';
import '@iconify/utils';
import 'consola';
import 'node:url';
import 'ipx';

async function scrapeEpisodeTitlesFromMainPage(animeId, season, lang) {
  console.log("Starting title scraping for:", animeId, season, lang);
  const isFilm = season.toLowerCase().includes("film") || season.toLowerCase().includes("movie");
  if (!isFilm) {
    console.log("Skipping title scraping for regular episodes (not a film)");
    return {};
  }
  const titles = {};
  console.log("Fetching film titles from lang page:", `https://anime-sama.fr/catalogue/${encodeURIComponent(animeId)}/${encodeURIComponent(season)}/${encodeURIComponent(lang)}/`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4e3);
  const langPageRes = await fetch(`https://anime-sama.fr/catalogue/${encodeURIComponent(animeId)}/${encodeURIComponent(season)}/${encodeURIComponent(lang)}/`, {
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
    },
    redirect: "follow",
    referrerPolicy: "strict-origin-when-cross-origin",
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  if (langPageRes.ok) {
    const langPageHtml = await langPageRes.text();
    console.log("Film page HTML length:", langPageHtml.length);
    const newSPFMatches = langPageHtml.match(/newSPF\("([^"]+)"\)/gi);
    if (newSPFMatches) {
      newSPFMatches.forEach((match, index) => {
        const titleMatch = match.match(/newSPF\("([^"]+)"\)/);
        if (titleMatch && titleMatch[1]) {
          const title = titleMatch[1].trim();
          if (title && title.length >= 3 && title.length <= 200) {
            const episodeNum = index + 1;
            titles[episodeNum] = title;
          }
        }
      });
    }
    console.log("Found film titles:", Object.keys(titles).length, titles);
    console.log("Found film titles:", Object.keys(titles).length, titles);
  }
  return titles;
}
function generateFallbackTitle(animeId, season, episodeNum) {
  if (season.toLowerCase().includes("film") || season.toLowerCase().includes("movie")) {
    const animeNameFormatted2 = animeId.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    return `${animeNameFormatted2} - Film ${episodeNum}`;
  }
  if (season.toLowerCase().includes("ova") || season.toLowerCase().includes("special")) {
    const animeNameFormatted2 = animeId.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    return `${animeNameFormatted2} - OVA ${episodeNum}`;
  }
  const animeNameFormatted = animeId.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  return `${animeNameFormatted} - Episode ${episodeNum}`;
}
const ____slug_ = defineEventHandler(async (event) => {
  const params = event.context.params;
  const slugString = params.slug;
  const slug = slugString.split("/");
  console.log("Slug parameter:", slug);
  const query = getQuery(event);
  query.debug === "true";
  if (!slug || slug.length !== 3) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Invalid path. Expected format: /api/anime/episodes/[id]/[season]/[lang]. Got slug: ${JSON.stringify(slug)}`
    });
  }
  const [id, season, lang] = slug;
  if (!id || !season || !lang) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing required parameters: id, season, and lang are required"
    });
  }
  const seasonFormatted = /^\d+$/.test(season) ? `saison${season}` : season;
  const episodeTitles = await scrapeEpisodeTitlesFromMainPage(id, seasonFormatted, lang);
  const jsUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(id)}/${encodeURIComponent(seasonFormatted)}/${encodeURIComponent(lang)}/episodes.js`;
  let sourceText = "";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3e3);
    const jsRes = await fetch(jsUrl, {
      headers: {
        "Accept": "*/*",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
      },
      redirect: "follow",
      referrerPolicy: "strict-origin-when-cross-origin",
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (jsRes.ok) {
      const jsText = await jsRes.text();
      if (jsText && jsText.trim()) {
        sourceText = jsText;
      }
    }
  } catch {
  }
  if (!sourceText) {
    const seasonUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(id)}/${encodeURIComponent(seasonFormatted)}/${encodeURIComponent(lang)}/`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4e3);
      const res = await fetch(seasonUrl, {
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
        },
        redirect: "follow",
        referrerPolicy: "strict-origin-when-cross-origin",
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        sourceText = await res.text();
      }
    } catch {
    }
  }
  if (!sourceText) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: `Unable to fetch episode data for ${id}/${seasonFormatted}/${lang}`
    });
  }
  const epsBlocks = sourceText.split(/var\s+eps/).slice(1);
  const matches = [];
  for (const block of epsBlocks) {
    const arrayMatch = block.match(/=\s*\[([\s\S]*?)\]/);
    if (arrayMatch) {
      matches.push(arrayMatch[1]);
    }
  }
  let episodes = [];
  if (matches.length > 0) {
    const epsArrays = matches.map(
      (arrayContent) => arrayContent ? arrayContent.split(",").map((url) => url.trim().replace(/['"]/g, "")).filter((url) => url.length > 0) : []
    );
    const maxEpisodes = Math.max(...epsArrays.map((arr) => arr.length));
    for (let episodeNum = 1; episodeNum <= maxEpisodes; episodeNum++) {
      const urls = [];
      epsArrays.forEach((epsArray) => {
        if (epsArray[episodeNum - 1]) {
          urls.push(epsArray[episodeNum - 1]);
        }
      });
      if (urls.length > 0) {
        const nonBlacklisted = urls.filter((url) => !isBlacklisted(url));
        const providers = Array.from(new Set(urls.map(hostnameOf)));
        const primary = preferNonBlacklisted(urls);
        const urlsToUse = nonBlacklisted.length > 0 ? nonBlacklisted : urls;
        const title = episodeTitles[episodeNum] || generateFallbackTitle(id, season, episodeNum);
        episodes.push({
          episode: episodeNum,
          title,
          url: primary,
          urls: urlsToUse,
          providers
        });
      }
    }
  } else {
    const arrayMatch = sourceText.match(/\[([^\]]+)\]/);
    if (!arrayMatch || !arrayMatch[1]) {
      throw createError({ statusCode: 502, statusMessage: "Bad Gateway", message: "No eps arrays found in source" });
    }
    const urls = arrayMatch[1].split(",").map((url) => url.trim().replace(/['"]/g, "")).filter((url) => url.length > 0);
    const n = urls.length;
    const mirrors = Math.max(1, Math.floor(n / 12));
    episodes = Array.from({ length: Math.ceil(n / mirrors) }, (_, i) => {
      const episodeNum = i + 1;
      const group = urls.slice(i * mirrors, (i + 1) * mirrors);
      const nonBlacklisted = group.filter((url) => !isBlacklisted(url));
      const providers = Array.from(new Set(group.map(hostnameOf)));
      const primary = preferNonBlacklisted(group);
      const urlsToUse = nonBlacklisted.length > 0 ? nonBlacklisted : group;
      const title = episodeTitles[episodeNum] || generateFallbackTitle(id, season, episodeNum);
      return {
        episode: episodeNum,
        title,
        url: primary,
        urls: urlsToUse,
        providers
      };
    });
  }
  const payload = { episodes };
  return payload;
});

export { ____slug_ as default };
//# sourceMappingURL=_...slug_.mjs.map
