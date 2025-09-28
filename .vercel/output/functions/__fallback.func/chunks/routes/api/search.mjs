import { d as defineEventHandler, g as getQuery, c as createError, a as parseAnimeResults } from '../../nitro/nitro.mjs';
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

const search = defineEventHandler(async (event) => {
  const query = getQuery(event);
  if (!query.title || typeof query.title !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing title query parameter"
    });
  const response = await fetch("https://anime-sama.fr/template-php/defaut/fetch.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest"
    },
    body: "query=" + encodeURIComponent(query.title),
    credentials: "include",
    mode: "cors"
  });
  const html = await response.text();
  return parseAnimeResults(html);
});

export { search as default };
//# sourceMappingURL=search.mjs.map
