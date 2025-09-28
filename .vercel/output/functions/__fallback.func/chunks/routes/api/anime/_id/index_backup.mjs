import { d as defineEventHandler, c as createError, p as parseAnimePage } from '../../../../nitro/nitro.mjs';
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

const index_backup = defineEventHandler(async (event) => {
  var _a;
  const id = (_a = event.context.params) == null ? void 0 : _a.id;
  if (!id || typeof id !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing or invalid id parameter"
    });
  const response = await fetch("https://anime-sama.fr/catalogue/" + id + "/", {
    "cache": "default",
    "credentials": "include",
    "headers": {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Priority": "u=0, i",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15"
    },
    "method": "GET",
    "mode": "cors",
    "redirect": "follow",
    "referrerPolicy": "strict-origin-when-cross-origin"
  });
  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      statusMessage: response.statusText,
      message: `Failed to fetch anime details for id: ${id}`
    });
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
    console.log(`\u{1F50D} Scraping language flags from: ${seasonUrl}`);
    try {
      const seasonResponse = await fetch(seasonUrl, {
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
        },
        redirect: "follow",
        referrerPolicy: "strict-origin-when-cross-origin"
      });
      if (seasonResponse.ok) {
        const seasonHtml = await seasonResponse.text();
        const languageFlags = parseLanguageFlags(seasonHtml);
        console.log(`\u{1F3F3}\uFE0F Extracted language flags:`, languageFlags);
        return { ...animeData, languageFlags };
      } else {
        console.warn(`\u274C Failed to fetch season page: ${seasonResponse.status} ${seasonResponse.statusText}`);
      }
    } catch (error) {
      console.warn("\u274C Failed to scrape language flags:", error);
    }
  }
  return animeData;
});
function parseLanguageFlags(html) {
  var _a;
  const flags = {};
  const flagToEmoji = {
    "cn": "\u{1F1E8}\u{1F1F3}",
    // China
    "jp": "\u{1F1EF}\u{1F1F5}",
    // Japan  
    "kr": "\u{1F1F0}\u{1F1F7}",
    // Korea
    "fr": "\u{1F1EB}\u{1F1F7}",
    // France
    "en": "\u{1F1FA}\u{1F1F8}",
    // English (USA)
    "us": "\u{1F1FA}\u{1F1F8}",
    // USA
    "qc": "\u{1F1E8}\u{1F1E6}",
    // Quebec/Canada
    "sa": "\u{1F1F8}\u{1F1E6}",
    // Saudi Arabia (Arabic)
    "ar": "\u{1F1F8}\u{1F1E6}",
    // Arabic
    "de": "\u{1F1E9}\u{1F1EA}",
    // Germany
    "es": "\u{1F1EA}\u{1F1F8}",
    // Spain
    "it": "\u{1F1EE}\u{1F1F9}",
    // Italy
    "pt": "\u{1F1F5}\u{1F1F9}",
    // Portugal
    "br": "\u{1F1E7}\u{1F1F7}",
    // Brazil
    "ru": "\u{1F1F7}\u{1F1FA}",
    // Russia
    "tr": "\u{1F1F9}\u{1F1F7}",
    // Turkey
    "th": "\u{1F1F9}\u{1F1ED}",
    // Thailand
    "in": "\u{1F1EE}\u{1F1F3}",
    // India
    "mx": "\u{1F1F2}\u{1F1FD}",
    // Mexico
    "nl": "\u{1F1F3}\u{1F1F1}",
    // Netherlands
    "se": "\u{1F1F8}\u{1F1EA}",
    // Sweden
    "no": "\u{1F1F3}\u{1F1F4}",
    // Norway
    "dk": "\u{1F1E9}\u{1F1F0}",
    // Denmark
    "fi": "\u{1F1EB}\u{1F1EE}",
    // Finland
    "pl": "\u{1F1F5}\u{1F1F1}",
    // Poland
    "cz": "\u{1F1E8}\u{1F1FF}",
    // Czech Republic
    "hu": "\u{1F1ED}\u{1F1FA}",
    // Hungary
    "ro": "\u{1F1F7}\u{1F1F4}",
    // Romania
    "bg": "\u{1F1E7}\u{1F1EC}",
    // Bulgaria
    "gr": "\u{1F1EC}\u{1F1F7}",
    // Greece
    "il": "\u{1F1EE}\u{1F1F1}",
    // Israel
    "ae": "\u{1F1E6}\u{1F1EA}",
    // UAE
    "eg": "\u{1F1EA}\u{1F1EC}",
    // Egypt
    "za": "\u{1F1FF}\u{1F1E6}",
    // South Africa
    "ng": "\u{1F1F3}\u{1F1EC}",
    // Nigeria
    "au": "\u{1F1E6}\u{1F1FA}",
    // Australia
    "nz": "\u{1F1F3}\u{1F1FF}",
    // New Zealand
    "sg": "\u{1F1F8}\u{1F1EC}",
    // Singapore
    "my": "\u{1F1F2}\u{1F1FE}",
    // Malaysia
    "id": "\u{1F1EE}\u{1F1E9}",
    // Indonesia
    "ph": "\u{1F1F5}\u{1F1ED}",
    // Philippines
    "vn": "\u{1F1FB}\u{1F1F3}",
    // Vietnam
    "mm": "\u{1F1F2}\u{1F1F2}",
    // Myanmar
    "kh": "\u{1F1F0}\u{1F1ED}",
    // Cambodia
    "la": "\u{1F1F1}\u{1F1E6}"
    // Laos
  };
  const flagImages = {};
  const flagImageRegex = /<img[^>]*src="[^"]*flag_([^"\.]+)(?:\.png|\.jpg|\.jpeg|\.gif|\.webp)"[^>]*>/gi;
  let imageMatch;
  while ((imageMatch = flagImageRegex.exec(html)) !== null) {
    const flagCode = (_a = imageMatch[1]) == null ? void 0 : _a.toLowerCase();
    const emoji = flagCode ? flagToEmoji[flagCode] || "\u{1F3F3}\uFE0F" : "\u{1F3F3}\uFE0F";
    if (flagCode) {
      flagImages[flagCode] = emoji;
    }
  }
  const langRegex = /<a href="\.\.\/([^"]+)"[^>]*id="switch[^"]*"[^>]*>/gi;
  let langMatch;
  while ((langMatch = langRegex.exec(html)) !== null) {
    const langCode = langMatch[1];
    if (!langCode) continue;
    let assignedEmoji = "\u{1F3F3}\uFE0F";
    if (langCode === "vostfr" || langCode === "vost") {
      assignedEmoji = flagImages["cn"] || flagImages["jp"] || flagImages["kr"] || Object.values(flagImages)[0] || "\u{1F1E8}\u{1F1F3}";
    } else if (langCode === "vf" || langCode === "vf1" || langCode === "vf2") {
      assignedEmoji = flagImages["fr"] || "\u{1F1EB}\u{1F1F7}";
    } else if (langCode === "va") {
      assignedEmoji = flagImages["us"] || flagImages["en"] || "\u{1F1FA}\u{1F1F8}";
    } else if (langCode === "vj") {
      assignedEmoji = flagImages["jp"] || "\u{1F1EF}\u{1F1F5}";
    } else if (langCode === "vkr") {
      assignedEmoji = flagImages["kr"] || "\u{1F1F0}\u{1F1F7}";
    } else if (langCode === "vcn") {
      assignedEmoji = flagImages["cn"] || "\u{1F1E8}\u{1F1F3}";
    } else if (langCode === "vqc") {
      assignedEmoji = flagImages["qc"] || "\u{1F1E8}\u{1F1E6}";
    } else if (langCode === "var") {
      assignedEmoji = flagImages["ar"] || flagImages["sa"] || "\u{1F1F8}\uFFFD";
    } else {
      assignedEmoji = Object.values(flagImages)[0] || "\u{1F3F3}\uFE0F";
    }
    flags[langCode] = assignedEmoji;
  }
  return flags;
}

export { index_backup as default };
//# sourceMappingURL=index_backup.mjs.map
