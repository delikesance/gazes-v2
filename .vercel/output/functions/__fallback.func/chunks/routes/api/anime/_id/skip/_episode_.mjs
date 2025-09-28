import { d as defineEventHandler, e as getRouterParams, c as createError, g as getQuery, a as parseAnimeResults, p as parseAnimePage } from '../../../../../nitro/nitro.mjs';
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
async function getAnimeById(animeId) {
  var _a;
  console.log(`\u23ED\uFE0F [API] Fetching anime info for ID/slug: ${animeId}`);
  let response = await fetch(`https://anime-sama.fr/catalogue/${animeId}/`, {
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": USER_AGENT
    },
    redirect: "follow"
  });
  if (!response.ok) {
    console.log(`\u23ED\uFE0F [API] Direct fetch failed, trying search for slug: ${animeId}`);
    const searchTerm = animeId.replace(/[-_]/g, " ");
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
      console.log(`\u23ED\uFE0F [API] No search results found for: ${animeId}`);
      return null;
    }
    if (!((_a = searchResults[0]) == null ? void 0 : _a.id)) {
      console.log(`\u23ED\uFE0F [API] No valid anime ID found in search results`);
      return null;
    }
    const realAnimeId = searchResults[0].id;
    console.log(`\u23ED\uFE0F [API] Found real anime ID from search: ${realAnimeId}`);
    response = await fetch(`https://anime-sama.fr/catalogue/${realAnimeId}/`, {
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": USER_AGENT
      },
      redirect: "follow"
    });
    if (!response.ok) {
      console.log(`\u23ED\uFE0F [API] Failed to fetch anime page with real ID: ${response.status}`);
      return null;
    }
  }
  const html = await response.text();
  const animeData = parseAnimePage(html);
  console.log(`\u23ED\uFE0F [API] Found anime: "${animeData.title}"`);
  return { title: animeData.title };
}
async function fetchSkipTimes(malId, episodeNumber, episodeLength) {
  try {
    console.log(`\u23ED\uFE0F [API] Fetching skip times for MAL ID ${malId}, episode ${episodeNumber}, length: ${episodeLength}`);
    let url = `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNumber}?types[]=op&types[]=ed`;
    if (episodeLength) {
      url += `&episodeLength=${episodeLength}`;
    }
    console.log(`\u23ED\uFE0F [API] AniSkip URL: ${url}`);
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT
      }
    });
    if (!response.ok) {
      console.log(`\u23ED\uFE0F [API] AniSkip API failed: ${response.status}`);
      return null;
    }
    const data = await response.json();
    console.log(`\u23ED\uFE0F [API] AniSkip response:`, data);
    if (!data.found || !data.results || data.results.length === 0) {
      console.log(`\u23ED\uFE0F [API] No skip times found`);
      return { skipTimes: [] };
    }
    const skipTimes = data.results.map((result) => ({
      startTime: result.interval.startTime,
      endTime: result.interval.endTime,
      type: result.skipType
    }));
    console.log(`\u23ED\uFE0F [API] Processed ${skipTimes.length} skip times`);
    return { skipTimes };
  } catch (error) {
    console.error("\u23ED\uFE0F [API] Error fetching skip times:", error);
    return null;
  }
}
const _episode_ = defineEventHandler(async (event) => {
  try {
    const { id: animeId, episode: episodeNumber } = getRouterParams(event);
    if (!animeId || !episodeNumber) {
      throw createError({ statusCode: 400, statusMessage: "Missing anime ID or episode number" });
    }
    const query = getQuery(event);
    const episodeLength = query.episodeLength ? parseFloat(query.episodeLength) : void 0;
    console.log(`\u23ED\uFE0F [API] Skip request received - Anime ID: ${animeId}, Episode: ${episodeNumber}, Length: ${episodeLength}`);
    const anime = await getAnimeById(animeId);
    if (!anime) {
      console.log(`\u23ED\uFE0F [API] Anime not found: ${animeId}`);
      throw createError({ statusCode: 404, statusMessage: "Anime not found" });
    }
    console.log(`\u23ED\uFE0F [API] Found anime: "${anime.title}"`);
    const malId = await fetchMalId(anime.title);
    if (!malId) {
      console.log(`\u23ED\uFE0F [API] Could not find MAL ID for: "${anime.title}"`);
      throw createError({ statusCode: 404, statusMessage: "MAL ID not found" });
    }
    console.log(`\u23ED\uFE0F [API] Using MAL ID: ${malId}`);
    const skipData = await fetchSkipTimes(malId, parseInt(episodeNumber), episodeLength);
    if (!skipData) {
      console.log(`\u23ED\uFE0F [API] No skip data found for MAL ID ${malId}, episode ${episodeNumber}`);
      return { skipTimes: [] };
    }
    console.log(`\u23ED\uFE0F [API] Returning skip data:`, skipData);
    return skipData;
  } catch (error) {
    console.error("\u23ED\uFE0F [API] Error in skip endpoint:", error);
    throw error;
  }
});
async function fetchMalId(animeTitle) {
  var _a, _b, _c;
  try {
    const cleanTitle = animeTitle.replace(/ \(.*\)$/g, "");
    const keyword = encodeURIComponent(cleanTitle);
    const searchUrl = `https://myanimelist.net/search/prefix.json?type=anime&keyword=${keyword}`;
    console.log(`\u23ED\uFE0F [API] Searching MAL with keyword: "${cleanTitle}" -> URL: ${searchUrl}`);
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": USER_AGENT
      }
    });
    if (!response.ok) {
      console.error(`\u23ED\uFE0F [API] MAL search failed: ${response.status}`);
      return null;
    }
    const data = await response.json();
    console.log(`\u23ED\uFE0F [API] MAL search returned ${((_c = (_b = (_a = data.categories) == null ? void 0 : _a[0]) == null ? void 0 : _b.items) == null ? void 0 : _c.length) || 0} results`);
    if (!data.categories || !data.categories[0] || !data.categories[0].items || data.categories[0].items.length === 0) {
      console.log(`\u23ED\uFE0F [API] No MAL results found`);
      return null;
    }
    const items = data.categories[0].items;
    let bestMatch = items.find(
      (item) => item.name.toLowerCase() === cleanTitle.toLowerCase()
    );
    if (!bestMatch) {
      const tvSeries = items.filter(
        (item) => !item.name.toLowerCase().includes("film") && !item.name.toLowerCase().includes("movie") && !item.name.toLowerCase().includes("special") && !item.name.toLowerCase().includes("ova") && !item.name.toLowerCase().includes("rewrite") && !item.name.toLowerCase().includes("relight")
      );
      bestMatch = tvSeries.find(
        (item) => item.name.toLowerCase().includes(cleanTitle.toLowerCase().split(" ")[0])
      ) || tvSeries[0] || items[0];
    }
    console.log(`\u23ED\uFE0F [API] Selected MAL entry: "${bestMatch.name}" (ID: ${bestMatch.id})`);
    return bestMatch.id.toString();
  } catch (error) {
    console.error("\u23ED\uFE0F [API] Error fetching MAL ID:", error);
    return null;
  }
}

export { _episode_ as default };
//# sourceMappingURL=_episode_.mjs.map
