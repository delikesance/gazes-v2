import { d as defineEventHandler, g as getQuery, u as useRuntimeConfig, a as parseAnimeResults, j as parseCataloguePage } from '../../nitro/nitro.mjs';
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

const catalogue = defineEventHandler(async (event) => {
  const q = getQuery(event);
  let genres = [];
  const genre = q.genre;
  if (Array.isArray(genre)) genres = genre;
  else if (typeof genre === "string" && genre) genres = [genre];
  const search = typeof q.search === "string" ? q.search : "";
  const page = typeof q.page === "string" ? q.page : void 0;
  const random = q.random === "1" || q.random === "true" ? "1" : void 0;
  const debug = q.debug === "1" || q.debug === "true";
  if (search && search.trim()) {
    try {
      const config = useRuntimeConfig();
      const searchApiUrl = config.searchApiUrl || "https://anime-sama.fr/template-php/defaut/fetch.php";
      const timeoutMs = parseInt(config.searchApiTimeoutMs || "10000", 10);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);
      try {
        const searchResponse = await fetch(searchApiUrl, {
          method: "POST",
          headers: {
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Priority": "u=3, i",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
            "X-Requested-With": "XMLHttpRequest"
          },
          body: "query=" + encodeURIComponent(search),
          mode: "cors",
          redirect: "follow",
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const searchHtml = await searchResponse.text();
        const searchResults = parseAnimeResults(searchHtml);
        const items = searchResults.map((item) => ({
          id: item.id,
          title: item.title,
          image: item.image,
          type: "Anime"
          // Search results are typically anime
        })).filter((item) => item.type !== "Scans");
        return { items, count: items.length, status: searchResponse.status };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === "AbortError") {
          console.warn(`Search API request timed out after ${timeoutMs}ms, falling back to catalogue search`);
          throw new Error(`Search API timeout after ${timeoutMs}ms`);
        } else {
          console.warn("Search API fetch failed:", fetchError.message);
          throw fetchError;
        }
      }
    } catch (error) {
      console.warn("Search API failed, falling back to catalogue search:", {
        error: error.message,
        search,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  }
  let categories = [];
  const categoryParam = q.type || q.categorie || q.category;
  if (Array.isArray(categoryParam)) categories = categoryParam;
  else if (typeof categoryParam === "string" && categoryParam) categories = [categoryParam];
  const typeMapping = {
    "series": "Anime",
    "movie": "Film"
  };
  categories = categories.map((cat) => typeMapping[cat] || cat);
  const getParamKeys = (categories2) => {
    const hasSpecificType = categories2.some(
      (cat) => ["Anime", "Film"].includes(cat)
    );
    if (hasSpecificType) {
      return { genreKey: "genre[]", categorieKey: "type[]" };
    } else {
      return { genreKey: "genre[]", categorieKey: "categorie[]" };
    }
  };
  const paramKeys = getParamKeys(categories);
  const buildUrl = (base, genreKey, categorieKey) => {
    const u = new URL(base);
    for (const g of genres) u.searchParams.append(genreKey, g);
    for (const c of categories) u.searchParams.append(categorieKey, c);
    u.searchParams.set("search", search);
    if (page) u.searchParams.set("page", page);
    if (random) u.searchParams.set("random", random);
    return u;
  };
  const candidates = [
    { base: "https://anime-sama.fr/catalogue/", genreKey: paramKeys.genreKey, categorieKey: paramKeys.categorieKey, referer: "https://anime-sama.fr/catalogue/" }
  ];
  const tried = [];
  for (const c of candidates) {
    const url = buildUrl(c.base, c.genreKey, c.categorieKey);
    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
          "Referer": c.referer,
          "Upgrade-Insecure-Requests": "1"
        },
        redirect: "follow"
      });
      const html = await res.text();
      const items = parseCataloguePage(html);
      const filteredItems = items.filter((item) => item.type !== "Scans");
      tried.push({ url: url.toString(), status: res.status, count: filteredItems.length });
      if (filteredItems.length > 0 || genres.length === 0) {
        const base = { items: filteredItems, count: filteredItems.length, status: res.status };
        return debug ? { ...base, _debug: { tried } } : base;
      }
      if (genres.length > 0 && genres[0]) {
        const searchUrl = new URL(c.base);
        searchUrl.searchParams.set("search", genres[0]);
        for (const cat of categories) searchUrl.searchParams.append(paramKeys.categorieKey, cat);
        if (page) searchUrl.searchParams.set("page", page);
        const res2 = await fetch(searchUrl.toString(), {
          method: "GET",
          headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
            "Referer": c.referer,
            "Upgrade-Insecure-Requests": "1"
          },
          redirect: "follow"
        });
        const html2 = await res2.text();
        const items2 = parseCataloguePage(html2);
        const filteredItems2 = items2.filter((item) => item.type !== "Scans");
        tried.push({ url: searchUrl.toString(), status: res2.status, count: filteredItems2.length });
        if (filteredItems2.length > 0) {
          const base = { items: filteredItems2, count: filteredItems2.length, status: res2.status };
          return debug ? { ...base, _debug: { tried } } : base;
        }
      }
    } catch {
      tried.push({ url: url.toString(), status: 0, count: 0 });
    }
  }
  const fallback = { items: [], count: 0, status: 0 };
  return debug ? { ...fallback, _debug: { tried } } : fallback;
});

export { catalogue as default };
//# sourceMappingURL=catalogue.mjs.map
