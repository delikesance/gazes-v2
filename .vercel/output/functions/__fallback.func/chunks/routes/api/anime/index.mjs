import { d as defineEventHandler, c as createError, a as parseAnimeResults, p as parseAnimePage } from '../../../nitro/nitro.mjs';
import 'cheerio';
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

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const index = defineEventHandler(async (event) => {
  var _a, _b;
  const id = (_a = event.context.params) == null ? void 0 : _a.id;
  if (!id || typeof id !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing or invalid id parameter"
    });
  let response = await fetch(`https://anime-sama.fr/catalogue/${id}/`, {
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": USER_AGENT
    },
    redirect: "follow"
  });
  if (!response.ok) {
    const searchTerm = id.replace(/[-_]/g, " ");
    const searchResponse = await fetch("https://anime-sama.fr/template-php/defaut/fetch.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: "query=" + encodeURIComponent(searchTerm)
    });
    const searchResults = parseAnimeResults(await searchResponse.text());
    if (!searchResponse.ok || !searchResults || searchResults.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: "Not Found",
        message: `No anime found for id: ${id}`
      });
    }
    if (!((_b = searchResults[0]) == null ? void 0 : _b.id)) {
      throw createError({
        statusCode: 404,
        statusMessage: "Not Found",
        message: `No valid anime found for id: ${id}`
      });
    }
    const realAnimeId = searchResults[0].id;
    response = await fetch(`https://anime-sama.fr/catalogue/${realAnimeId}/`, {
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": USER_AGENT
      },
      redirect: "follow"
    });
    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        statusMessage: response.statusText,
        message: `Failed to fetch anime details for id: ${id}`
      });
    }
  }
  const html = await response.text();
  const animeData = parseAnimePage(html);
  if (animeData.seasons && animeData.seasons.length > 0) {
    const firstSeason = animeData.seasons[0];
    if (!(firstSeason == null ? void 0 : firstSeason.url)) {
      return animeData;
    }
    let seasonUrl = firstSeason.url;
    if (seasonUrl.startsWith("/")) {
      seasonUrl = `https://anime-sama.fr/catalogue${seasonUrl}`;
    } else if (!seasonUrl.startsWith("http")) {
      seasonUrl = `https://anime-sama.fr/catalogue/${id}/${seasonUrl}`;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3e3);
      const seasonResponse = await fetch(seasonUrl, {
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "User-Agent": USER_AGENT
        },
        redirect: "follow",
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (seasonResponse.ok) {
        const seasonHtml = await seasonResponse.text();
        const languageFlags = parseLanguageFlags(seasonHtml);
        return { ...animeData, languageFlags };
      }
    } catch (error) {
    }
  }
  return animeData;
});
function parseLanguageFlags(html) {
  var _a;
  const flags = {};
  const flagToEmoji = {
    "cn": "\u{1F1E8}\u{1F1F3}",
    "jp": "\u{1F1EF}\u{1F1F5}",
    "kr": "\u{1F1F0}\u{1F1F7}",
    "fr": "\u{1F1EB}\u{1F1F7}",
    "en": "\u{1F1FA}\u{1F1F8}",
    "us": "\u{1F1FA}\u{1F1F8}",
    "qc": "\u{1F1E8}\u{1F1E6}",
    "ar": "\u{1F1F8}\u{1F1E6}",
    "x": "\u{1F1EF}\u{1F1F5}"
    // Original version
  };
  const buttonRegex = /<a\s+href="\.\.\/([^"]+)"[^>]*id="switch[^"]*"[^>]*>[\s\S]*?<img[^>]*src="[^"]*flag_([^"\.]+)\.png"[^>]*>[\s\S]*?<\/a>/gi;
  let match;
  while ((match = buttonRegex.exec(html)) !== null) {
    const langCode = match[1];
    const flagCode = (_a = match[2]) == null ? void 0 : _a.toLowerCase();
    const emoji = flagCode ? flagToEmoji[flagCode] || "\u{1F3F3}\uFE0F" : "\u{1F3F3}\uFE0F";
    if (langCode && flagCode) {
      flags[langCode] = emoji;
    }
  }
  return flags;
}

export { index as default };
//# sourceMappingURL=index.mjs.map
