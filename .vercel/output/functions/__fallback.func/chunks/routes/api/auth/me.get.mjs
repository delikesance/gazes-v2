import { d as defineEventHandler, A as AuthService, c as createError } from '../../../nitro/nitro.mjs';
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

const me_get = defineEventHandler(async (event) => {
  console.log("\u{1F510} [ME] Request received");
  try {
    const user = await AuthService.getUserFromRequest(event);
    if (!user) {
      console.log("\u274C [ME] No authenticated user");
      throw createError({
        statusCode: 401,
        statusMessage: "Non authentifi\xE9"
      });
    }
    console.log("\u2705 [ME] User found:", user.username);
    return {
      success: true,
      user
    };
  } catch (error) {
    console.error("\u274C [ME] Error occurred:", error);
    throw error;
  }
});

export { me_get as default };
//# sourceMappingURL=me.get.mjs.map
