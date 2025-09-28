import { d as defineEventHandler, r as readBody, c as createError, A as AuthService } from '../../../nitro/nitro.mjs';
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

const login_post = defineEventHandler(async (event) => {
  console.log("\u{1F510} [LOGIN] Request received");
  try {
    const body = await readBody(event);
    console.log("\u{1F510} [LOGIN] Request body:", { email: body.email, hasPassword: !!body.password });
    const { email, password } = body;
    console.log("\u{1F510} [LOGIN] Validating input...");
    if (!email || !password) {
      console.log("\u274C [LOGIN] Missing email or password");
      throw createError({
        statusCode: 400,
        statusMessage: "Email et mot de passe requis"
      });
    }
    console.log("\u{1F510} [LOGIN] Attempting to authenticate user:", email);
    const user = await AuthService.authenticateUser(email, password);
    console.log("\u{1F510} [LOGIN] Authentication result:", user ? "SUCCESS" : "FAILED");
    if (!user) {
      console.log("\u274C [LOGIN] Invalid credentials for user:", email);
      throw createError({
        statusCode: 401,
        statusMessage: "Email ou mot de passe incorrect"
      });
    }
    console.log("\u{1F510} [LOGIN] Generating tokens for user:", user.username);
    const tokens = AuthService.generateTokens(user);
    console.log("\u{1F510} [LOGIN] Tokens generated successfully");
    console.log("\u{1F510} [LOGIN] Setting authentication cookies");
    AuthService.setAuthCookies(event, tokens);
    console.log("\u{1F510} [LOGIN] Cookies set successfully");
    console.log("\u2705 [LOGIN] Login successful for user:", user.username);
    return {
      success: true,
      message: "Connexion r\xE9ussie",
      user
    };
  } catch (error) {
    console.error("\u274C [LOGIN] Error occurred:", error);
    throw error;
  }
});

export { login_post as default };
//# sourceMappingURL=login.post.mjs.map
