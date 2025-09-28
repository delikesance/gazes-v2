import { d as defineEventHandler, s as setResponseHeader, k as getMethod, l as setResponseStatus, g as getQuery, m as getProviderInfo } from '../../../nitro/nitro.mjs';
import { Buffer } from 'buffer';
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

function decodeBase64Url(input) {
  try {
    const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    return Buffer.from(padded, "base64").toString("utf8");
  } catch (error) {
    console.warn("Failed to decode base64url:", error);
    return input;
  }
}
const VIDEO_URL_PATTERNS = [
  // M3U8 HLS streams
  {
    regex: /https:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*/gi,
    type: "hls"
  },
  // MP4 direct links
  {
    regex: /https:\/\/[^\s"'<>]*\.mp4[^\s"'<>]*/gi,
    type: "mp4"
  },
  // Other video formats
  {
    regex: /https:\/\/[^\s"'<>]*\.(?:webm|mkv|avi|mov)[^\s"'<>]*/gi,
    type: "video"
  },
  // Quoted URLs (common in JavaScript)
  {
    regex: /["']https:\/\/[^"']*\.(?:m3u8|mp4|webm|mkv|avi|mov)[^"']*["']/gi,
    type: "quoted"
  },
  // Video source attributes
  {
    regex: /src\s*=\s*["'](https:\/\/[^"']*\.(?:m3u8|mp4|webm|mkv|avi|mov)[^"']*)["']/gi,
    type: "src"
  },
  // File URLs in JavaScript
  {
    regex: /file\s*:\s*["'](https:\/\/[^"']*\.(?:m3u8|mp4|webm|mkv|avi|mov)[^"']*)["']/gi,
    type: "file"
  },
  // JavaScript variables containing URLs
  {
    regex: /(?:var|const|let)\s+\w+\s*=\s*["'](https:\/\/[^"']*\.(?:m3u8|mp4)[^"']*)["']/gi,
    type: "javascript"
  },
  // API endpoint patterns (common in video players)
  {
    regex: /["']https:\/\/[^"']*\/(?:api|source|video|stream|player)[^"']*["']/gi,
    type: "api"
  },
  // MyVi.top specific patterns
  {
    regex: /["'](https:\/\/[^"']*myvi[^"']*\.(?:mp4|m3u8|json|php|aspx)[^"']*)["']/gi,
    type: "myvi"
  },
  // General video hosting patterns
  {
    regex: /["'](https:\/\/[^"']*(?:cdn|stream|video|media)[^"']*\.(?:mp4|m3u8)[^"']*)["']/gi,
    type: "cdn"
  },
  // SibNet relative URLs (need to be converted to absolute)
  {
    regex: /src\s*:\s*["']([^"']*\/v\/[^"']*\.mp4)["']/gi,
    type: "sibnet_relative"
  }
];
const EXTRACTION_CONFIG = {
  MAX_HTML_SIZE: 2 * 1024 * 1024,
  // Reduce to 2MB limit for faster processing
  PROCESSING_TIMEOUT: 3e3,
  // Reduce to 3 second timeout for faster extraction
  ALLOWED_PORTS: [80, 443, 8080, 8443],
  BLOCKED_HOSTS: ["localhost", "127.0.0.1", "0.0.0.0", "::1"],
  MAX_URLS_PER_TYPE: 5
  // Reduce to 5 URLs per type for faster processing
};
function stripQuotes(url) {
  return url.replace(/^["']|["']$/g, "");
}
function parseQuality(url) {
  var _a;
  const qualityMatch = url.match(/(\d+p|\d+x\d+|hd|fhd|uhd|4k|8k)/i);
  return (_a = qualityMatch == null ? void 0 : qualityMatch[1]) == null ? void 0 : _a.toLowerCase();
}
function validateUrl(candidate) {
  try {
    const cleanUrl = stripQuotes(candidate.trim());
    if (!cleanUrl || cleanUrl.length > 2048) {
      return { isValid: false, error: "URL too long or empty" };
    }
    const url = new URL(cleanUrl);
    if (url.protocol !== "https:") {
      return { isValid: false, error: "Only HTTPS URLs allowed" };
    }
    if (EXTRACTION_CONFIG.BLOCKED_HOSTS.includes(url.hostname.toLowerCase())) {
      return { isValid: false, error: "Blocked hostname" };
    }
    if (url.port && !EXTRACTION_CONFIG.ALLOWED_PORTS.includes(parseInt(url.port))) {
      return { isValid: false, error: "Port not allowed" };
    }
    if (!/^[a-zA-Z0-9.-]+$/.test(url.hostname)) {
      return { isValid: false, error: "Invalid hostname characters" };
    }
    return { isValid: true, url: cleanUrl };
  } catch (error) {
    return { isValid: false, error: `Invalid URL: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}
function* iterateMatches(html, patterns) {
  const urlCounts = /* @__PURE__ */ new Map();
  const startTime = Date.now();
  let totalUrlsFound = 0;
  const MAX_TOTAL_URLS = 15;
  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(html)) !== null) {
      if (Date.now() - startTime > EXTRACTION_CONFIG.PROCESSING_TIMEOUT) {
        console.warn("\u26A0\uFE0F URL extraction timeout reached, stopping");
        return;
      }
      if (totalUrlsFound >= MAX_TOTAL_URLS) {
        console.log(`\u2705 Found ${totalUrlsFound} URLs, stopping early for performance`);
        return;
      }
      const currentCount = urlCounts.get(pattern.type) || 0;
      if (currentCount >= EXTRACTION_CONFIG.MAX_URLS_PER_TYPE) {
        console.warn(`\u26A0\uFE0F Max URLs reached for type ${pattern.type}, skipping`);
        break;
      }
      const candidate = match[1] || match[0];
      let processedCandidate = candidate;
      if (pattern.type === "sibnet_relative" && !candidate.startsWith("http")) {
        processedCandidate = `https://video.sibnet.ru${candidate.startsWith("/") ? "" : "/"}${candidate}`;
        console.log(`\u{1F517} Converting SibNet relative URL: ${candidate} -> ${processedCandidate}`);
      }
      const validation = validateUrl(processedCandidate);
      if (validation.isValid && validation.url) {
        urlCounts.set(pattern.type, currentCount + 1);
        totalUrlsFound++;
        yield {
          type: pattern.type,
          url: validation.url,
          quality: parseQuality(validation.url)
        };
      } else {
        console.debug(`\u{1F6AB} Rejected URL: ${candidate} (${validation.error})`);
      }
    }
  }
}
function extractVideoUrls(html) {
  console.log("\u{1F50D} Starting secure URL extraction...");
  if (html.length > EXTRACTION_CONFIG.MAX_HTML_SIZE) {
    console.warn(`\u26A0\uFE0F HTML too large (${html.length} bytes), truncating to ${EXTRACTION_CONFIG.MAX_HTML_SIZE} bytes`);
    html = html.substring(0, EXTRACTION_CONFIG.MAX_HTML_SIZE);
  }
  if (html.length === 0) {
    console.warn("\u26A0\uFE0F Empty HTML content");
    return [];
  }
  const urls = [];
  const uniqueUrls = /* @__PURE__ */ new Set();
  try {
    for (const urlData of iterateMatches(html, VIDEO_URL_PATTERNS)) {
      if (!uniqueUrls.has(urlData.url)) {
        uniqueUrls.add(urlData.url);
        urls.push(urlData);
        console.log(`\u2705 Found ${urlData.type} URL: ${urlData.url}${urlData.quality ? ` (${urlData.quality})` : ""}`);
      }
    }
  } catch (error) {
    console.error("\u274C Error during URL extraction:", error);
    return [];
  }
  console.log(`\u{1F517} Extraction complete: ${urls.length} unique URLs found`);
  return urls;
}
const resolve = defineEventHandler(async (event) => {
  setResponseHeader(event, "Access-Control-Allow-Origin", "*");
  setResponseHeader(event, "Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  setResponseHeader(event, "Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (getMethod(event) === "OPTIONS") {
    setResponseStatus(event, 204);
    return "";
  }
  const query = getQuery(event);
  let url = "";
  if (query.u64 && typeof query.u64 === "string") {
    console.log("\u{1F4DD} Decoding u64 parameter:", query.u64);
    url = decodeBase64Url(query.u64);
    console.log("\u{1F517} Decoded URL:", url);
  } else if (query.url && typeof query.url === "string") {
    url = query.url;
  }
  if (!url) {
    return {
      ok: false,
      urls: [],
      message: "Missing url or u64 parameter"
    };
  }
  try {
    console.log("\u{1F50D} Resolving URL:", url);
    const referer = query.referer;
    const headers = {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      "DNT": "1",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1"
    };
    if (referer) {
      console.log("\u{1F4CE} Using referer:", referer);
      headers["Referer"] = decodeURIComponent(referer);
    }
    const controller = new AbortController();
    const timeoutMs = 5e3;
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        console.error("\u274C Fetch failed:", response.status, response.statusText);
        return {
          ok: false,
          urls: [],
          message: `Failed to fetch: ${response.status} ${response.statusText}`
        };
      }
      const html = await response.text();
      console.log("\u{1F4C4} Fetched HTML length:", html.length);
      console.log("\u{1F4C4} First 500 chars:", html.substring(0, 500));
      const extractedUrls = extractVideoUrls(html);
      console.log("\u{1F517} Found URLs:", extractedUrls);
      const uniqueUrls = /* @__PURE__ */ new Map();
      for (const urlData of extractedUrls) {
        if (!uniqueUrls.has(urlData.url)) {
          const providerInfo = getProviderInfo(urlData.url);
          uniqueUrls.set(urlData.url, {
            type: urlData.type === "hls" ? "hls" : urlData.type === "mp4" ? "mp4" : "unknown",
            url: urlData.url,
            proxiedUrl: `/api/proxy?url=${encodeURIComponent(urlData.url)}&referer=${encodeURIComponent(url)}&origin=${encodeURIComponent(new URL(url).origin)}&rewrite=1`,
            quality: urlData.quality,
            provider: providerInfo ? {
              hostname: providerInfo.hostname,
              reliability: providerInfo.reliability,
              description: providerInfo.description
            } : null
          });
        }
      }
      const finalUrls = Array.from(uniqueUrls.values()).sort((a, b) => {
        var _a, _b;
        const reliabilityA = ((_a = a.provider) == null ? void 0 : _a.reliability) || 0;
        const reliabilityB = ((_b = b.provider) == null ? void 0 : _b.reliability) || 0;
        return reliabilityB - reliabilityA;
      });
      console.log("\u{1F3C6} URLs sorted by provider reliability:");
      finalUrls.forEach((urlData, index) => {
        const provider = urlData.provider;
        if (provider) {
          console.log(`  ${index + 1}. ${provider.hostname} (reliability: ${provider.reliability}/10) - ${urlData.type}`);
        } else {
          console.log(`  ${index + 1}. Unknown provider - ${urlData.type}`);
        }
      });
      return {
        ok: true,
        urls: finalUrls,
        message: `Fetched ${html.length} bytes. Found ${finalUrls.length} unique video URLs, sorted by provider reliability.`
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        console.error(`\u274C Fetch timed out after ${timeoutMs}ms for URL:`, url);
        return {
          ok: false,
          urls: [],
          message: `Request timed out after ${timeoutMs / 1e3} seconds`
        };
      } else {
        console.error("\u274C Fetch error:", fetchError.message);
        return {
          ok: false,
          urls: [],
          message: `Network error: ${fetchError.message}`
        };
      }
    }
  } catch (error) {
    console.error("\u274C Resolve error:", error);
    return {
      ok: false,
      urls: [],
      message: `Error: ${error.message}`
    };
  }
});

export { resolve as default };
//# sourceMappingURL=resolve.mjs.map
