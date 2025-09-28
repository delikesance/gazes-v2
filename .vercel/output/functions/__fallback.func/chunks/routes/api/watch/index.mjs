import { d as defineEventHandler, A as AuthService, c as createError, D as DatabaseService } from '../../../nitro/nitro.mjs';
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
  console.log("\u{1F4FA} [WATCH_PROGRESS] Get request received");
  try {
    const user = await AuthService.getUserFromRequest(event);
    if (!user) {
      console.log("\u274C [WATCH_PROGRESS] No authenticated user");
      throw createError({
        statusCode: 401,
        statusMessage: "Non authentifi\xE9"
      });
    }
    const db = DatabaseService.getInstance();
    const progress = await db.getUserContinueWatching(user.id);
    console.log("\u2705 [WATCH_PROGRESS] Found", progress.length, "continue watching items for user:", user.username);
    return {
      success: true,
      progress
    };
  } catch (error) {
    console.error("\u274C [WATCH_PROGRESS] Error occurred:", error);
    throw error;
  }
});

export { index as default };
//# sourceMappingURL=index.mjs.map
