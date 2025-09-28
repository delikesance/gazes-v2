import { d as defineEventHandler, k as getMethod, s as setResponseHeader, l as setResponseStatus, g as getQuery, t as getHeader } from '../../nitro/nitro.mjs';
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

function b64urlDecodeToUtf8(input) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    if (typeof atob === "function") {
      const bin = atob(padded);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    }
  } catch {
  }
  try {
    const B = globalThis.Buffer;
    if (B == null ? void 0 : B.from) {
      return B.from(base64, "base64").toString("utf8");
    }
  } catch {
  }
  return input;
}
const proxy = defineEventHandler(async (event) => {
  var _a, _b, _c;
  if (getMethod(event) === "OPTIONS") {
    setResponseHeader(event, "Access-Control-Allow-Origin", "*");
    setResponseHeader(event, "Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
    setResponseHeader(event, "Access-Control-Allow-Headers", "Range,Content-Type,Accept,Origin,Referer,User-Agent");
    setResponseStatus(event, 204);
    return "";
  }
  setResponseHeader(event, "Access-Control-Allow-Origin", "*");
  setResponseHeader(event, "Access-Control-Expose-Headers", "Content-Type,Content-Length,Accept-Ranges,Content-Range");
  setResponseHeader(event, "Vary", "Origin");
  const query = getQuery(event);
  let rawUrl = "";
  if (typeof query.u64 === "string" && query.u64) {
    const decoded = b64urlDecodeToUtf8(query.u64);
    if (!decoded) {
      setResponseStatus(event, 400);
      setResponseHeader(event, "Content-Type", "application/json; charset=utf-8");
      return JSON.stringify({ ok: false, message: "Invalid base64 in u64" });
    }
    rawUrl = decoded;
  } else if (typeof query.url === "string") {
    rawUrl = query.url;
  }
  if (!rawUrl) {
    setResponseStatus(event, 400);
    setResponseHeader(event, "Content-Type", "application/json; charset=utf-8");
    return JSON.stringify({ ok: false, message: "Missing url query parameter" });
  }
  let target;
  try {
    target = new URL(rawUrl);
  } catch (error) {
    console.warn("[proxy] Invalid URL:", rawUrl, error);
    setResponseStatus(event, 400);
    setResponseHeader(event, "Content-Type", "application/json; charset=utf-8");
    return JSON.stringify({ ok: false, message: "Invalid url" });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    setResponseStatus(event, 400);
    setResponseHeader(event, "Content-Type", "application/json; charset=utf-8");
    return JSON.stringify({ ok: false, message: "Only http/https URLs are allowed" });
  }
  const controlKeys = /* @__PURE__ */ new Set(["url", "u64", "referer", "origin", "ua", "rewrite"]);
  for (const [k, v] of Object.entries(query)) {
    if (controlKeys.has(k)) continue;
    if (typeof v !== "string") continue;
    if (!v.length) continue;
    if (!target.searchParams.has(k)) target.searchParams.set(k, v);
  }
  let referer = typeof query.referer === "string" ? query.referer : void 0;
  const origin = typeof query.origin === "string" ? query.origin : void 0;
  const ua = typeof query.ua === "string" ? query.ua : "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
  const rewrite = query.rewrite !== "0";
  const range = getHeader(event, "range") || void 0;
  const headers = {
    "User-Agent": ua,
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-Dest": "empty"
  };
  if (!referer) referer = `${target.origin}/`;
  if (referer) headers["Referer"] = referer;
  if (origin) headers["Origin"] = origin;
  if (range) headers["Range"] = range;
  if (/\.m3u8($|\?)/i.test(rawUrl)) {
    headers["Accept"] = "application/vnd.apple.mpegurl,application/x-mpegURL,*/*";
  }
  const controller = new AbortController();
  try {
    ;
    (_c = (_b = (_a = event.node) == null ? void 0 : _a.req) == null ? void 0 : _b.on) == null ? void 0 : _c.call(_b, "close", () => controller.abort());
  } catch {
  }
  let res;
  try {
    res = await fetch(target.toString(), { headers, redirect: "follow", signal: controller.signal });
  } catch (error) {
    console.warn("[proxy] Fetch error for URL:", target.toString(), error);
    setResponseStatus(event, 502);
    setResponseHeader(event, "Content-Type", "application/json; charset=utf-8");
    return JSON.stringify({ ok: false, message: `Failed to fetch: ${(error == null ? void 0 : error.message) || "Network error"}` });
  }
  console.log("[proxy] Fetch response status:", res.status, "for URL:", target.toString());
  console.log("[proxy] Response headers:", Object.fromEntries(res.headers.entries()));
  setResponseHeader(event, "Access-Control-Allow-Origin", "*");
  setResponseHeader(event, "Access-Control-Expose-Headers", "Content-Type,Content-Length,Accept-Ranges,Content-Range");
  setResponseHeader(event, "Vary", "Origin");
  const hopHeaders = ["Content-Type", "Content-Length", "Accept-Ranges", "Content-Range", "Cache-Control", "Last-Modified", "ETag"];
  for (const h of hopHeaders) {
    const v = res.headers.get(h);
    if (v) setResponseHeader(event, h, v);
  }
  setResponseStatus(event, res.status, res.statusText);
  const contentType = res.headers.get("Content-Type") || "";
  const isM3U8 = /application\/(vnd\.apple\.mpegurl|x-mpegURL)|text\/plain.*\.m3u8/i.test(contentType) || /\.m3u8($|\?)/i.test(target.toString());
  console.log("[proxy] Content-Type:", contentType, "Is M3U8:", isM3U8, "Rewrite enabled:", rewrite);
  if (!isM3U8 && /text\/html|application\/xhtml\+xml/i.test(contentType)) {
    setResponseStatus(event, 415, "Unsupported Media Type");
    setResponseHeader(event, "Content-Type", "application/json; charset=utf-8");
    return JSON.stringify({ ok: false, message: "This proxy only serves media (m3u8/mp4). Use /api/player/resolve for embed pages." });
  }
  if (isM3U8 && rewrite && res.ok) {
    try {
      const playlist = await res.text();
      console.log("[proxy] Original playlist length:", playlist.length);
      console.log("[proxy] First 500 chars of playlist:", playlist.substring(0, 500));
      const base = target;
      const buildProxy = (u) => {
        try {
          const abs = new URL(u, base);
          const params = new URLSearchParams({ url: abs.toString() });
          if (referer) params.set("referer", referer);
          if (origin) params.set("origin", origin);
          if (ua) params.set("ua", ua);
          return `/api/proxy?${params.toString()}`;
        } catch (error) {
          console.warn("[proxy] Failed to build proxy URL for:", u, error);
          return u;
        }
      };
      const rewritten = playlist.split(/\r?\n/).map((line) => {
        if (!line.trim()) return line;
        if (line.startsWith("#")) {
          return line.replace(/URI="([^"]+)"/ig, (_m, p1) => `URI="${buildProxy(p1)}"`);
        }
        return buildProxy(line);
      }).join("\n");
      setResponseHeader(event, "Content-Type", "application/vnd.apple.mpegurl");
      return rewritten;
    } catch (error) {
      console.warn("[proxy] HLS rewrite failed:", error);
    }
  }
  const body = res.body;
  return body;
});

export { proxy as default };
//# sourceMappingURL=proxy.mjs.map
