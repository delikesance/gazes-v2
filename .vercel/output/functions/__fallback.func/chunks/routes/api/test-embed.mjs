import { d as defineEventHandler, g as getQuery } from '../../nitro/nitro.mjs';
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

const testEmbed = defineEventHandler(async (event) => {
  const query = getQuery(event);
  const url = query.url;
  if (!url) {
    return { error: "Missing url parameter" };
  }
  try {
    const parsedUrl = new URL(url);
    const allowedHosts = ["video.sibnet.ru", "streamtape.com", "vidmoly.to", "uqload.com", "doodstream.com", "www.myvi.tv", "sendvid.com"];
    if (!allowedHosts.includes(parsedUrl.hostname.toLowerCase())) {
      return { error: "URL from untrusted domain" };
    }
  } catch (e) {
    return { error: "Invalid URL format" };
  }
  console.log(`\u{1F9EA} Testing embed URL: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        "Referer": "https://anime-sama.fr/"
      },
      signal: AbortSignal.timeout(1e4)
    });
    if (!response.ok) {
      return {
        error: `HTTP ${response.status}: ${response.statusText}`,
        url
      };
    }
    const html = await response.text();
    console.log(`\u{1F4C4} Response size: ${html.length} bytes`);
    const patterns = {
      m3u8_basic: /https:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*/gi,
      mp4_basic: /https:\/\/[^\s"'<>]*\.mp4[^\s"'<>]*/gi,
      m3u8_quoted: /["'](https:\/\/[^"']*\.m3u8[^"']*)["']/gi,
      mp4_quoted: /["'](https:\/\/[^"']*\.mp4[^"']*)["']/gi,
      m3u8_src: /src\s*=\s*["'](https:\/\/[^"']*\.m3u8[^"']*)["']/gi,
      mp4_src: /src\s*=\s*["'](https:\/\/[^"']*\.mp4[^"']*)["']/gi,
      sibnet_specific: /src:\s*["']([^"']*\.(?:mp4|m3u8)[^"']*)["']/gi,
      myvi_specific: /video_url["']?\s*:\s*["']([^"']+)["']/gi,
      sendvid_specific: /file:\s*["']([^"']*\.(?:mp4|m3u8)[^"']*)["']/gi,
      generic_file: /file\s*:\s*["']([^"']*\.(?:mp4|m3u8)[^"']*)["']/gi,
      generic_source: /source\s*:\s*["']([^"']*\.(?:mp4|m3u8)[^"']*)["']/gi
    };
    const foundUrls = {};
    let totalFound = 0;
    for (const [patternName, pattern] of Object.entries(patterns)) {
      pattern.lastIndex = 0;
      const urls = [];
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const videoUrl = match[1] || match[0];
        if (videoUrl && !urls.includes(videoUrl)) {
          urls.push(videoUrl);
          totalFound++;
        }
      }
      if (urls.length > 0) {
        foundUrls[patternName] = urls;
      }
    }
    const allUrlPattern = /https:\/\/[^\s"'<>]+/gi;
    const allUrls = [];
    let urlMatch;
    while ((urlMatch = allUrlPattern.exec(html)) !== null) {
      const url2 = urlMatch[0];
      if (url2.includes(".mp4") || url2.includes(".m3u8") || url2.includes("video") || url2.includes("stream")) {
        allUrls.push(url2);
      }
    }
    const jsVariables = {};
    const jsPatterns = [
      /(?:var|let|const)\s+(\w+)\s*=\s*["']([^"']*(?:mp4|m3u8)[^"']*)["']/gi,
      /(\w+)\s*:\s*["']([^"']*(?:mp4|m3u8)[^"']*)["']/gi
    ];
    for (const pattern of jsPatterns) {
      pattern.lastIndex = 0;
      let jsMatch;
      while ((jsMatch = pattern.exec(html)) !== null) {
        if (jsMatch[1] && jsMatch[2]) {
          jsVariables[jsMatch[1]] = jsMatch[2];
        }
      }
    }
    return {
      success: true,
      url,
      responseSize: html.length,
      status: response.status,
      foundUrls,
      totalFound,
      allVideoLikeUrls: allUrls.slice(0, 10),
      // First 10 to avoid too much data
      jsVariables,
      // Include a sample of the HTML for debugging
      htmlSample: html.substring(0, 1e3) + (html.length > 1e3 ? "..." : ""),
      // Look for specific provider patterns
      containsText: {
        hasVideo: html.toLowerCase().includes("video"),
        hasSource: html.toLowerCase().includes("source"),
        hasFile: html.toLowerCase().includes("file"),
        hasStream: html.toLowerCase().includes("stream"),
        hasM3u8: html.toLowerCase().includes("m3u8"),
        hasMp4: html.toLowerCase().includes("mp4")
      }
    };
  } catch (error) {
    return {
      error: error.message,
      url
    };
  }
});

export { testEmbed as default };
//# sourceMappingURL=test-embed.mjs.map
