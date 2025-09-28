import { d as defineEventHandler, g as getQuery, c as createError, i as isBlacklisted, h as hostnameOf, b as preferNonBlacklisted } from '../../../../../../nitro/nitro.mjs';
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
  const titles = {};
  try {
    const mainPageUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(animeId)}/`;
    const mainPageRes = await fetch(mainPageUrl, {
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
      },
      redirect: "follow",
      referrerPolicy: "strict-origin-when-cross-origin"
    });
    if (mainPageRes.ok) {
      const mainPageHtml = await mainPageRes.text();
      const episodeListPatterns = [
        // Pattern for episode lists in divs or sections
        /<div[^>]*class="[^"]*episode[^"]*"[^>]*>[\s\S]*?(\d+)[^<>]*[-:]\s*([^<>]{3,100}?)(?:<|$)/gi,
        // Pattern for episode titles in tables
        /<tr[^>]*>[\s\S]*?(\d+)[\s\S]*?<td[^>]*>([^<>]{3,100}?)<\/td>/gi,
        // Pattern for structured episode data
        /<(?:li|div)[^>]*episode[^>]*>[\s\S]*?(\d+)[\s\S]*?title[^>]*>([^<>]{3,100}?)</gi,
        // Pattern for JSON-like episode data
        /"episode":\s*(\d+)[^}]*"title":\s*"([^"]{3,100})"/gi,
        // Pattern for episode selectors with real titles (not just "Episode X")
        /<option[^>]*>(?:Episode\s*)?(\d+)\s*[-:]\s*([^<>]{4,100}?)(?:<\/option>|$)/gi
      ];
      for (const pattern of episodeListPatterns) {
        let match;
        while ((match = pattern.exec(mainPageHtml)) !== null) {
          if (!match[1] || !match[2]) continue;
          const episodeNum = parseInt(match[1]);
          let title = match[2].trim().replace(/\s+/g, " ").replace(/^[-:\s\u00A0]+|[-:\s\u00A0]+$/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
          title = title.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*\[[^\]]*\]\s*$/, "").replace(/^(Episode|Épisode)\s*\d+\s*[-:]?\s*/i, "").replace(/\s*(vostfr|vf|french|english|sub|dub)\s*$/i, "").replace(/\s*-\s*$/, "");
          if (episodeNum > 0 && title && title.length >= 3 && !title.match(/^(episode|épisode|ep|e)\s*\d*$/i) && !title.match(/^\d+$/) && title.toLowerCase() !== "episode" && title.toLowerCase() !== "\xE9pisode") {
            if (!titles[episodeNum] || titles[episodeNum].length < title.length) {
              titles[episodeNum] = title;
            }
          }
        }
      }
    }
    const seasonPageUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(animeId)}/${encodeURIComponent(season)}/`;
    const seasonPageRes = await fetch(seasonPageUrl, {
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
      },
      redirect: "follow",
      referrerPolicy: "strict-origin-when-cross-origin"
    });
    if (seasonPageRes.ok) {
      const seasonPageHtml = await seasonPageRes.text();
      const seasonTitles = extractEpisodeTitles(seasonPageHtml);
      for (const [episodeNum, title] of Object.entries(seasonTitles)) {
        const epNum = parseInt(episodeNum);
        if (!titles[epNum] || title.length > titles[epNum].length && !title.match(/^Episode\s*\d+$/i)) {
          titles[epNum] = title;
        }
      }
    }
    const langPageUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(animeId)}/${encodeURIComponent(season)}/${encodeURIComponent(lang)}/`;
    const langPageRes = await fetch(langPageUrl, {
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
      },
      redirect: "follow",
      referrerPolicy: "strict-origin-when-cross-origin"
    });
    if (langPageRes.ok) {
      const langPageHtml = await langPageRes.text();
      const langTitles = extractEpisodeTitles(langPageHtml);
      for (const [episodeNum, title] of Object.entries(langTitles)) {
        const epNum = parseInt(episodeNum);
        if (!titles[epNum] || title.length > titles[epNum].length && !title.match(/^Episode\s*\d+$/i)) {
          titles[epNum] = title;
        }
      }
    }
  } catch (error) {
    console.warn("Error scraping episode titles from main page:", error);
  }
  return titles;
}
const EPISODE_PATTERNS = [
  // Pattern for anime-sama episode lists in HTML
  /<div[^>]*class="[^"]*episode[^"]*"[^>]*>[\s\S]*?(\d+)[\s\S]*?[-:]\s*([^<>]+?)(?:<|$)/gi,
  // Pattern for "Episode X - Title" or "Episode X: Title"
  /(?:Episode|Épisode)\s*(\d+)\s*[-:]\s*([^\n\r<>]{3,}?)(?:\n|<|$)/gi,
  // Pattern for numbered lists "X - Title" or "X. Title"
  /(?:^|\n)\s*(\d+)\s*[-\.]\s*([^\n\r<>]{3,}?)(?:\n|<|$)/gm,
  // Pattern for HTML select options
  /<option[^>]*>(?:Episode\s*)?(\d+)[^<>]*[-:]\s*([^<>]{3,}?)<\/option>/gi,
  // NEW: Pattern for selectEpisodes select component (films/movies without episode numbers)
  /<select[^>]*id="selectEpisodes"[^>]*>[\s\S]*?<\/select>/gi,
  // Pattern for list items
  /<li[^>]*>(?:Episode\s*)?(\d+)[^<>]*[-:]\s*([^<>]{3,}?)<\/li>/gi,
  // Pattern for table rows or divs with episode data
  /<(?:tr|div)[^>]*>[\s\S]*?(?:Episode\s*)?(\d+)[\s\S]*?[-:]\s*([^<>]{3,}?)(?:<\/(?:tr|div)|$)/gi,
  // Pattern for span or p elements with episode titles
  /<(?:span|p)[^>]*>(?:Episode\s*)?(\d+)[^<>]*[-:]\s*([^<>]{3,}?)<\/(?:span|p)>/gi,
  // Pattern for anime-sama specific episode links or buttons
  /<a[^>]*>[\s\S]*?(?:Episode\s*)?(\d+)[\s\S]*?[-:]\s*([^<>]{3,}?)[\s\S]*?<\/a>/gi,
  // Pattern for episode titles in comments or meta descriptions
  /<!--[\s\S]*?(?:Episode\s*)?(\d+)[\s\S]*?[-:]\s*([^-]{3,}?)[\s\S]*?-->/gi
];
const JS_PATTERNS = [
  /(?:var|let|const)\s+(?:titles?|episodes?|names?|eps_titles?)\s*=\s*\[([\s\S]*?)\]/gi,
  /(?:titles?|episodes?|names?|eps_titles?)\s*:\s*\[([\s\S]*?)\]/gi,
  // Pattern for anime-sama specific title arrays
  /eps_titles\s*=\s*\[([\s\S]*?)\]/gi
];
const META_PATTERNS = [
  /<meta[^>]*(?:name|property)=["'](?:description|episode)["'][^>]*content=["']([^"']*(?:Episode|Épisode)\s*\d+[^"']*)["']/gi,
  /"name":\s*"([^"]*(?:Episode|Épisode)\s*\d+[^"]*)"[^}]*"episodeNumber":\s*(\d+)/gi,
  // Pattern for JSON-LD structured data
  /"episode":\s*\[[\s\S]*?"name":\s*"([^"]+)"[\s\S]*?"episodeNumber":\s*(\d+)/gi
];
function cleanEpisodeTitle(rawTitle) {
  if (!rawTitle || typeof rawTitle !== "string") {
    return null;
  }
  let title = rawTitle.trim().replace(/\s+/g, " ").replace(/^[-:\s\u00A0]+|[-:\s\u00A0]+$/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  title = title.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*\[[^\]]*\]\s*$/, "").replace(/^(Episode|Épisode)\s*\d+\s*[-:]?\s*/i, "").replace(/\s*(vostfr|vf|french|english|sub|dub)\s*$/i, "").replace(/\s*-\s*$/, "");
  if (title && title.length >= 3 && title.length <= 200) {
    return title;
  }
  return null;
}
function parseHtmlPatterns(html, titles) {
  for (const pattern of EPISODE_PATTERNS) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      if (!match[1] || !match[2]) continue;
      const episodeNum = parseInt(match[1]);
      const cleanedTitle = cleanEpisodeTitle(match[2]);
      if (episodeNum > 0 && cleanedTitle) {
        if (!titles[episodeNum] || titles[episodeNum].length < cleanedTitle.length) {
          titles[episodeNum] = cleanedTitle;
        }
      }
    }
  }
}
function parseSelectEpisodes(html, titles) {
  const selectEpisodesMatch = html.match(/<select[^>]*id="selectEpisodes"[^>]*>([\s\S]*?)<\/select>/i);
  if (selectEpisodesMatch) {
    const selectContent = selectEpisodesMatch[1];
    if (!selectContent) return;
    const optionMatches = selectContent.match(/<option[^>]*>([^<>]+?)<\/option>/gi);
    if (optionMatches) {
      optionMatches.forEach((optionMatch, index) => {
        const optionText = optionMatch.replace(/<[^>]+>/g, "").trim();
        const cleanedTitle = cleanEpisodeTitle(optionText);
        if (cleanedTitle) {
          const episodeNum = index + 1;
          if (!titles[episodeNum]) {
            titles[episodeNum] = cleanedTitle;
          }
        }
      });
    }
  }
}
function parseJsArrays(html, titles) {
  for (const jsPattern of JS_PATTERNS) {
    let jsMatch;
    while ((jsMatch = jsPattern.exec(html)) !== null) {
      const content = jsMatch[1];
      if (!content) continue;
      const titleMatches = content.match(/["']([^"']{3,100}?)["']/g);
      if (titleMatches) {
        titleMatches.forEach((match, index) => {
          const title = match.slice(1, -1).trim();
          if (title && !title.match(/^https?:\/\//) && !title.match(/^\d+$/) && !title.match(/^(var|let|const|function)/) && title.length >= 3) {
            const episodeNum = index + 1;
            if (!titles[episodeNum] || titles[episodeNum].length < title.length) {
              titles[episodeNum] = title;
            }
          }
        });
      }
    }
  }
}
function parseMetaPatterns(html, titles) {
  for (const metaPattern of META_PATTERNS) {
    let metaMatch;
    while ((metaMatch = metaPattern.exec(html)) !== null) {
      const content = metaMatch[1];
      if (!content) continue;
      const episodeMatch = content.match(/(?:Episode|Épisode)\s*(\d+)[-:\s]*(.+)/i);
      if (episodeMatch && episodeMatch[1] && episodeMatch[2]) {
        const episodeNum = parseInt(episodeMatch[1]);
        const title = episodeMatch[2].trim();
        if (episodeNum > 0 && title && title.length >= 3) {
          if (!titles[episodeNum] || titles[episodeNum].length < title.length) {
            titles[episodeNum] = title;
          }
        }
      }
    }
  }
}
function extractEpisodeTitles(html) {
  const titles = {};
  try {
    parseHtmlPatterns(html, titles);
    parseSelectEpisodes(html, titles);
    parseJsArrays(html, titles);
    parseMetaPatterns(html, titles);
  } catch (error) {
    console.warn("Error extracting episode titles:", error);
  }
  return titles;
}
function generateFallbackTitle(animeId, season, episodeNum) {
  if (season.toLowerCase().includes("film") || season.toLowerCase().includes("movie")) {
    const animeNameFormatted = animeId.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    return `${animeNameFormatted} - Film ${episodeNum}`;
  }
  if (season.toLowerCase().includes("ova") || season.toLowerCase().includes("special")) {
    const animeNameFormatted = animeId.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    return `${animeNameFormatted} - OVA ${episodeNum}`;
  }
  return void 0;
}
const _lang_ = defineEventHandler(async (event) => {
  console.log("Route hit:", event.context.params);
  const { id, season, lang } = event.context.params;
  const query = getQuery(event);
  const debug = query.debug === "true";
  console.log("Parameters:", { id, season, lang });
  if (!id || !season || !lang) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing required parameters: id, season, and lang are required"
    });
  }
  const dbg = { source: "", length: 0 };
  const episodeTitles = await scrapeEpisodeTitlesFromMainPage(id, season, lang);
  if (debug) console.info(`[episodes] Scraped ${Object.keys(episodeTitles).length} episode titles from anime-sama`);
  const jsUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(lang)}/episodes.js`;
  let sourceText = "";
  try {
    const jsRes = await fetch(jsUrl, {
      headers: {
        "Accept": "*/*",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
      },
      redirect: "follow",
      referrerPolicy: "strict-origin-when-cross-origin",
      signal: AbortSignal.timeout(1e4)
      // 10 second timeout
    });
    if (jsRes.ok) {
      const jsText = await jsRes.text();
      if (jsText && jsText.trim()) {
        sourceText = jsText;
        dbg.source = jsUrl;
        dbg.length = jsText.length;
      }
    }
  } catch (error) {
    console.debug("Failed to fetch episodes.js:", error);
  }
  if (!sourceText) {
    const seasonUrl = `https://anime-sama.fr/catalogue/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(lang)}/`;
    try {
      const res = await fetch(seasonUrl, {
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
        },
        redirect: "follow",
        referrerPolicy: "strict-origin-when-cross-origin"
      });
      if (res.ok) {
        sourceText = await res.text();
        dbg.source = seasonUrl;
        dbg.length = sourceText.length;
      }
    } catch {
    }
  }
  if (!sourceText) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: `Unable to fetch episode data for ${id}/${season}/${lang}`
    });
  }
  const regex = /eps\d*\s*=\s*\[([^\]]+)\]/g;
  const matches = [];
  let match;
  while ((match = regex.exec(sourceText)) !== null) {
    matches.push(match[1]);
  }
  if (debug) console.info(`[episodes] Found ${matches.length} eps arrays`);
  let episodes = [];
  if (matches.length > 0) {
    const allUrls = matches.flatMap(
      (arrayContent) => arrayContent ? arrayContent.split(",").map((url) => url.trim().replace(/['"]/g, "")) : []
    );
    const grouped = allUrls.reduce((groups, url) => {
      const episodeMatch = url.match(/(?:episode?|ep|e)[-_]?(\d+)/i) || url.match(/(\d+)/);
      const episode = episodeMatch && episodeMatch[1] ? parseInt(episodeMatch[1]) : Object.keys(groups).length + 1;
      if (!groups[episode]) groups[episode] = [];
      groups[episode].push(url);
      return groups;
    }, {});
    if (debug) console.info(`[episodes] JS parsing: ${allUrls.length} urls -> groups=${Object.keys(grouped).length}`);
    episodes = Object.entries(grouped).map(([ep, urls]) => {
      const episodeNum = parseInt(ep);
      const nonBlacklisted = urls.filter((url) => !isBlacklisted(url));
      const providers = Array.from(new Set(urls.map(hostnameOf)));
      const primary = preferNonBlacklisted(urls);
      const urlsToUse = nonBlacklisted.length > 0 ? nonBlacklisted : urls;
      const title = episodeTitles[episodeNum] || generateFallbackTitle(id, season, episodeNum);
      return {
        episode: episodeNum,
        title,
        url: primary,
        urls: urlsToUse,
        providers
      };
    }).sort((a, b) => a.episode - b.episode);
    if (debug) console.info(`[episodes] JS parsing result: ${episodes.length} episodes`);
  } else {
    const arrayMatch = sourceText.match(/\[([^\]]+)\]/);
    if (!arrayMatch || !arrayMatch[1]) {
      if (debug) {
        const snippet = sourceText.slice(0, 4e3);
        console.info(`[episodes] No eps arrays found for ${id}/${season}/${lang}. Source=${dbg.source} length=${sourceText.length}. First 4000 chars:
` + snippet);
      }
      throw createError({ statusCode: 502, statusMessage: "Bad Gateway", message: "No eps arrays found in source (enable ?debug=1 to log HTML)" });
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
    if (debug) console.info(`[episodes] Fallback parsing: 1 array with ${n} urls -> mirrors=${mirrors} => ${episodes.length} episodes`);
  }
  const payload = { episodes };
  if (debug) {
    const snippet = (sourceText || "").slice(0, 1e3);
    payload.debug = { ...dbg, snippet, episodeTitlesFound: Object.keys(episodeTitles).length };
    console.info(`[episodes] Parsed ${episodes.length} episodes for ${id}/${season}/${lang} from ${dbg.source} length=${dbg.length}`);
  }
  return payload;
});

export { _lang_ as default };
//# sourceMappingURL=_lang_.mjs.map
