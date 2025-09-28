import { d as defineEventHandler, c as createError } from '../../../nitro/nitro.mjs';
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

const _id_ = defineEventHandler(async (event) => {
  var _a;
  const id = (_a = event.context.params) == null ? void 0 : _a.id;
  if (!id || typeof id !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing or invalid id parameter"
    });
  const seasonUrl = `https://anime-sama.fr/catalogue/${id}/saison1/vostfr/`;
  console.log("Testing season URL:", seasonUrl);
  try {
    const seasonResponse = await fetch(seasonUrl, {
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
      },
      redirect: "follow",
      referrerPolicy: "strict-origin-when-cross-origin"
    });
    console.log("Season response status:", seasonResponse.status);
    if (seasonResponse.ok) {
      const seasonHtml = await seasonResponse.text();
      console.log("Season HTML length:", seasonHtml.length);
      const flags = parseLanguageFlags(seasonHtml);
      console.log("Parsed flags:", flags);
      return { flags, htmlLength: seasonHtml.length };
    } else {
      return { error: "Season page not found", status: seasonResponse.status };
    }
  } catch (error) {
    console.error("Error:", error);
    return { error: String(error) };
  }
});
function parseLanguageFlags(html) {
  console.log("parseLanguageFlags called with HTML length:", html.length);
  const flags = {};
  const flagMap = {
    "flag_cn.png": "\u{1F1E8}\u{1F1F3}",
    // China
    "flag_jp.png": "\u{1F1EF}\u{1F1F5}",
    // Japan
    "flag_kr.png": "\u{1F1F0}\u{1F1F7}",
    // Korea
    "flag_fr.png": "\u{1F1EB}\u{1F1F7}",
    // France
    "flag_en.png": "\u{1F1FA}\u{1F1F8}",
    // English (USA)
    "flag_qc.png": "\u{1F1E8}\u{1F1E6}",
    // Quebec/Canada
    "flag_sa.png": "\u{1F1F8}\u{1F1E6}"
    // Saudi Arabia (Arabic)
  };
  const flagRegex = /<a href="\.\.\/([^"]+)"[^>]*id="switch[^"]*"[^>]*>[\s\S]*?<img[^>]*src="[^"]*flag_([^"]+)\.png"[^>]*alt="[^"]*"[^>]*>[\s\S]*?<\/a>/gi;
  let match;
  let count = 0;
  while ((match = flagRegex.exec(html)) !== null) {
    count++;
    const langCode = match[1];
    const flagCode = match[2];
    console.log(`Match ${count}: ${langCode} -> flag_${flagCode}.png`);
    const emoji = flagMap[`flag_${flagCode}.png`];
    if (emoji && langCode) {
      flags[langCode] = emoji;
      console.log(`Mapped ${langCode} to ${emoji}`);
    }
  }
  console.log(`Total matches: ${count}`);
  return flags;
}

export { _id_ as default };
//# sourceMappingURL=_id_.mjs.map
