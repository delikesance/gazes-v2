import { d as defineEventHandler, g as getQuery } from '../../nitro/nitro.mjs';
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

const debugAnime = defineEventHandler(async (event) => {
  const query = getQuery(event);
  const animeId = query.id;
  const debug = query.debug === "1" || query.debug === "true";
  if (!animeId) {
    return { error: "Missing anime ID parameter" };
  }
  if (!/^[a-zA-Z0-9-]+$/.test(animeId)) {
    return { error: "Invalid anime ID format" };
  }
  console.log(`\u{1F50D} Debugging anime: ${animeId}`);
  try {
    const animePageUrl = `https://anime-sama.fr/catalogue/${animeId}`;
    console.log(`\u{1F4C4} Checking anime page: ${animePageUrl}`);
    const animeResponse = await fetch(animePageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
      }
    });
    if (!animeResponse.ok) {
      return {
        error: `Anime page not found: ${animeResponse.status} ${animeResponse.statusText}`,
        url: animePageUrl
      };
    }
    const animeHtml = await animeResponse.text();
    console.log(`\u2705 Anime page loaded: ${animeHtml.length} bytes`);
    const seasonPattern = /href="\/catalogue\/[^"]+\/([^"\/]+)\/(vostfr|vf)"/g;
    const seasons = /* @__PURE__ */ new Set();
    const languages = /* @__PURE__ */ new Set();
    let match;
    while ((match = seasonPattern.exec(animeHtml)) !== null) {
      if (match[1] && match[2]) {
        seasons.add(match[1]);
        languages.add(match[2]);
      }
    }
    const panneauPattern = /panneauAnime\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/g;
    let panneauMatch;
    while ((panneauMatch = panneauPattern.exec(animeHtml)) !== null) {
      const path = panneauMatch[2];
      if (path) {
        const pathParts = path.split("/");
        if (pathParts.length === 2 && pathParts[0] && pathParts[1]) {
          seasons.add(pathParts[0]);
          languages.add(pathParts[1]);
        }
      }
    }
    console.log(`\u{1F3AD} Found seasons: ${Array.from(seasons).join(", ")}`);
    console.log(`\u{1F5E3}\uFE0F Found languages: ${Array.from(languages).join(", ")}`);
    const results = {
      anime: animeId,
      animePageStatus: animeResponse.status,
      seasons: Array.from(seasons),
      languages: Array.from(languages),
      episodeData: [],
      embedTests: [],
      workingUrls: [],
      errors: []
    };
    for (const season of seasons) {
      for (const lang of languages) {
        const seasonUrl = `https://anime-sama.fr/catalogue/${animeId}/${season}/${lang}`;
        console.log(`\u{1F3AF} Testing season: ${seasonUrl}`);
        try {
          const episodesJsUrl = `${seasonUrl}/episodes.js`;
          const jsResponse = await fetch(episodesJsUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
            }
          });
          let episodeSource = "";
          let sourceType = "";
          if (jsResponse.ok) {
            episodeSource = await jsResponse.text();
            sourceType = "episodes.js";
            console.log(`\u2705 Found episodes.js: ${episodeSource.length} bytes`);
          } else {
            const htmlResponse = await fetch(seasonUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
              }
            });
            if (htmlResponse.ok) {
              episodeSource = await htmlResponse.text();
              sourceType = "html";
              console.log(`\u2705 Found HTML page: ${episodeSource.length} bytes`);
            } else {
              console.log(`\u274C Failed to load: ${htmlResponse.status} ${htmlResponse.statusText}`);
              results.errors.push({
                season,
                lang,
                error: `Failed to load season page: ${htmlResponse.status} ${htmlResponse.statusText}`,
                url: seasonUrl
              });
              continue;
            }
          }
          const episodeArrays = [];
          const arrayPattern = /(var|let|const)\s+eps(\d+)\s*=\s*\[([\s\S]*?)\];/g;
          let arrayMatch;
          while ((arrayMatch = arrayPattern.exec(episodeSource)) !== null) {
            const inner = arrayMatch[3];
            if (inner) {
              const urls = Array.from(inner.matchAll(/["']([^"'\s]+)["']/g)).map((x) => x[1]).filter((u) => u !== void 0 && /^https?:\/\//i.test(u));
              if (urls.length > 0) {
                episodeArrays.push(urls);
                console.log(`\u{1F4FA} Found eps${arrayMatch[2]} with ${urls.length} URLs`);
              }
            }
          }
          const episodeData = {
            season,
            lang,
            sourceType,
            sourceLength: episodeSource.length,
            episodeArrays: episodeArrays.length,
            totalUrls: episodeArrays.reduce((sum, arr) => sum + arr.length, 0),
            sampleUrls: episodeArrays.length > 0 && episodeArrays[0] ? episodeArrays[0].slice(0, 3) : []
          };
          results.episodeData.push(episodeData);
          if (episodeArrays.length > 0) {
            const firstEpisodeUrls = episodeArrays.map((arr) => arr[0]).filter((url) => url !== void 0);
            for (let i = 0; i < Math.min(firstEpisodeUrls.length, 5); i++) {
              const testUrl = firstEpisodeUrls[i];
              console.log(`\u{1F9EA} Testing embed URL: ${testUrl}`);
              try {
                const embedResponse = await fetch(testUrl, {
                  headers: {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
                    "Referer": "https://anime-sama.fr/"
                  },
                  signal: AbortSignal.timeout(1e4)
                  // 10 second timeout
                });
                const embedResult = {
                  url: testUrl,
                  status: embedResponse.status,
                  statusText: embedResponse.statusText,
                  season,
                  lang,
                  provider: new URL(testUrl).hostname,
                  working: embedResponse.ok
                };
                results.embedTests.push(embedResult);
                if (embedResponse.ok) {
                  const embedHtml = await embedResponse.text();
                  console.log(`\u2705 Embed working: ${testUrl} (${embedHtml.length} bytes)`);
                  const videoPatterns = [
                    /https:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*/gi,
                    /https:\/\/[^\s"'<>]*\.mp4[^\s"'<>]*/gi,
                    /["'](https:\/\/[^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
                    /src\s*=\s*["'](https:\/\/[^"']*\.(?:m3u8|mp4)[^"']*)["']/gi
                  ];
                  const foundUrls = [];
                  for (const pattern of videoPatterns) {
                    pattern.lastIndex = 0;
                    let videoMatch;
                    while ((videoMatch = pattern.exec(embedHtml)) !== null) {
                      const videoUrl = videoMatch[1] || videoMatch[0];
                      if (videoUrl && !foundUrls.includes(videoUrl)) {
                        foundUrls.push(videoUrl);
                      }
                    }
                  }
                  if (foundUrls.length > 0) {
                    console.log(`\u{1F3AC} Found ${foundUrls.length} video URLs in embed`);
                    results.workingUrls.push({
                      embedUrl: testUrl,
                      videoUrls: foundUrls,
                      season,
                      lang,
                      provider: new URL(testUrl).hostname
                    });
                  }
                } else {
                  console.log(`\u274C Embed failed: ${testUrl} - ${embedResponse.status} ${embedResponse.statusText}`);
                }
              } catch (error) {
                console.log(`\u{1F4A5} Embed error: ${testUrl} - ${error.message}`);
                results.embedTests.push({
                  url: testUrl,
                  error: error.message,
                  season,
                  lang,
                  provider: new URL(testUrl).hostname,
                  working: false
                });
              }
            }
          }
        } catch (error) {
          console.log(`\u{1F4A5} Season error: ${season}/${lang} - ${error.message}`);
          results.errors.push({
            season,
            lang,
            error: error.message,
            url: seasonUrl
          });
        }
      }
    }
    const summary = {
      totalSeasons: results.episodeData.length,
      totalEmbedsTested: results.embedTests.length,
      workingEmbeds: results.embedTests.filter((t) => t.working).length,
      failingEmbeds: results.embedTests.filter((t) => !t.working).length,
      videoUrlsFound: results.workingUrls.length,
      uniqueProviders: [...new Set(results.embedTests.map((t) => t.provider))],
      workingProviders: [...new Set(results.embedTests.filter((t) => t.working).map((t) => t.provider))],
      failingProviders: [...new Set(results.embedTests.filter((t) => !t.working).map((t) => t.provider))]
    };
    console.log(`\u{1F4CA} Debug Summary:`);
    console.log(`  - Seasons tested: ${summary.totalSeasons}`);
    console.log(`  - Embeds tested: ${summary.totalEmbedsTested}`);
    console.log(`  - Working embeds: ${summary.workingEmbeds}`);
    console.log(`  - Video URLs found: ${summary.videoUrlsFound}`);
    console.log(`  - Working providers: ${summary.workingProviders.join(", ")}`);
    console.log(`  - Failing providers: ${summary.failingProviders.join(", ")}`);
    return {
      success: true,
      summary,
      ...results
    };
  } catch (error) {
    console.error(`\u{1F4A5} Debug error:`, error);
    return {
      error: error.message,
      stack: debug ? error.stack : void 0
    };
  }
});

export { debugAnime as default };
//# sourceMappingURL=debug-anime.mjs.map
