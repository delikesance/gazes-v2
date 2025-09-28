import { d as defineEventHandler, A as AuthService } from '../../../nitro/nitro.mjs';
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

const logout_post = defineEventHandler(async (event) => {
  console.log("\u{1F6AA} [LOGOUT] Request received");
  try {
    console.log("\u{1F6AA} [LOGOUT] Clearing authentication cookies");
    AuthService.clearAuthCookies(event);
    console.log("\u{1F6AA} [LOGOUT] Cookies cleared successfully");
    console.log("\u2705 [LOGOUT] Logout successful");
    return {
      success: true,
      message: "D\xE9connexion r\xE9ussie"
    };
  } catch (error) {
    console.error("\u274C [LOGOUT] Error occurred:", error);
    throw error;
  }
});

export { logout_post as default };
//# sourceMappingURL=logout.post.mjs.map
