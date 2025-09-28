import { d as defineEventHandler, f as getCookie, c as createError, A as AuthService } from '../../../nitro/nitro.mjs';
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

const refresh_post = defineEventHandler(async (event) => {
  console.log("\u{1F504} [REFRESH] Request received");
  try {
    const refreshToken = getCookie(event, "refreshToken");
    console.log("\u{1F504} [REFRESH] Refresh token found:", !!refreshToken);
    if (!refreshToken) {
      console.log("\u274C [REFRESH] No refresh token");
      throw createError({
        statusCode: 401,
        statusMessage: "Refresh token manquant"
      });
    }
    console.log("\u{1F504} [REFRESH] Verifying refresh token...");
    const payload = AuthService.verifyToken(refreshToken, "refresh");
    console.log("\u{1F504} [REFRESH] Refresh token verified for user ID:", payload.userId);
    console.log("\u{1F504} [REFRESH] Finding user by ID...");
    const user = await AuthService.findUserById(payload.userId);
    if (!user) {
      console.log("\u274C [REFRESH] User not found");
      throw createError({
        statusCode: 401,
        statusMessage: "Utilisateur non trouv\xE9"
      });
    }
    console.log("\u{1F504} [REFRESH] Generating new tokens...");
    const tokens = AuthService.generateTokens(user);
    console.log("\u{1F504} [REFRESH] New tokens generated");
    console.log("\u{1F504} [REFRESH] Setting new authentication cookies");
    AuthService.setAuthCookies(event, tokens);
    console.log("\u{1F504} [REFRESH] Cookies set successfully");
    console.log("\u2705 [REFRESH] Token refresh successful for user:", user.username);
    return {
      success: true,
      message: "Tokens rafra\xEEchis",
      user
    };
  } catch (error) {
    console.error("\u274C [REFRESH] Error occurred:", error);
    throw error;
  }
});

export { refresh_post as default };
//# sourceMappingURL=refresh.post.mjs.map
