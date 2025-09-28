import { d as defineEventHandler, A as AuthService, c as createError, v as getRouterParam, D as DatabaseService, r as readBody } from '../../../../nitro/nitro.mjs';
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

const index = defineEventHandler(async (event) => {
  const method = event.node.req.method;
  if (method === "GET") {
    console.log("\u{1F4FA} [LOAD_PROGRESS] GET request received");
    try {
      const user = await AuthService.getUserFromRequest(event);
      if (!user) {
        console.log("\u274C [LOAD_PROGRESS] No authenticated user");
        throw createError({
          statusCode: 401,
          statusMessage: "Non authentifi\xE9"
        });
      }
      const animeId = getRouterParam(event, "animeId");
      if (!animeId) {
        throw createError({
          statusCode: 400,
          statusMessage: "Anime ID manquant"
        });
      }
      const db = DatabaseService.getInstance();
      const allProgress = await db.getUserContinueWatching(user.id);
      const animeProgress = allProgress.filter((p) => p.animeId === animeId);
      console.log("\u2705 [LOAD_PROGRESS] Found", animeProgress.length, "progress items for anime:", animeId);
      return {
        success: true,
        progress: animeProgress
      };
    } catch (error) {
      console.error("\u274C [LOAD_PROGRESS] Error occurred:", error);
      throw error;
    }
  } else if (method === "POST") {
    console.log("\u{1F4FA} [SAVE_PROGRESS] POST request received");
    try {
      const user = await AuthService.getUserFromRequest(event);
      if (!user) {
        console.log("\u274C [SAVE_PROGRESS] No authenticated user");
        throw createError({
          statusCode: 401,
          statusMessage: "Non authentifi\xE9"
        });
      }
      const animeId = getRouterParam(event, "animeId");
      const body = await readBody(event);
      const { season, episode, currentTime, duration } = body;
      console.log("\u{1F4FA} [SAVE_PROGRESS] Saving progress:", { userId: user.id, animeId, season, episode, currentTime, duration });
      if (!animeId || season === void 0 || episode === void 0 || currentTime === void 0 || duration === void 0) {
        console.log("\u274C [SAVE_PROGRESS] Missing required fields");
        throw createError({
          statusCode: 400,
          statusMessage: "Champs requis manquants"
        });
      }
      const db = DatabaseService.getInstance();
      const progress = await db.saveWatchingProgress(user.id, animeId, season, episode, currentTime, duration);
      console.log("\u2705 [SAVE_PROGRESS] Progress saved successfully for user:", user.username);
      return {
        success: true,
        progress
      };
    } catch (error) {
      console.error("\u274C [SAVE_PROGRESS] Error occurred:", error);
      throw error;
    }
  } else {
    throw createError({
      statusCode: 405,
      statusMessage: "M\xE9thode non autoris\xE9e"
    });
  }
});

export { index as default };
//# sourceMappingURL=index.mjs.map
