import { d as defineEventHandler, r as readBody, c as createError, A as AuthService } from '../../../nitro/nitro.mjs';
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

const register_post = defineEventHandler(async (event) => {
  var _a;
  console.log("\u{1F464} [REGISTER] Request received");
  try {
    const body = await readBody(event);
    console.log("\u{1F464} [REGISTER] Request body:", { email: body.email, username: body.username, hasPassword: !!body.password });
    const { email, username, password } = body;
    console.log("\u{1F464} [REGISTER] Validating input...");
    if (!email || !username || !password) {
      console.log("\u274C [REGISTER] Missing required fields");
      throw createError({
        statusCode: 400,
        statusMessage: "Email, nom d'utilisateur et mot de passe requis"
      });
    }
    if (password.length < 6) {
      console.log("\u274C [REGISTER] Password too short");
      throw createError({
        statusCode: 400,
        statusMessage: "Le mot de passe doit contenir au moins 6 caract\xE8res"
      });
    }
    console.log("\u{1F464} [REGISTER] Creating user:", username, "with email:", email);
    const user = await AuthService.createUser(email, username, password);
    console.log("\u{1F464} [REGISTER] User created successfully");
    console.log("\u{1F464} [REGISTER] Generating tokens for new user:", user.username);
    const tokens = AuthService.generateTokens(user);
    console.log("\u{1F464} [REGISTER] Tokens generated successfully");
    console.log("\u{1F464} [REGISTER] Setting authentication cookies");
    AuthService.setAuthCookies(event, tokens);
    console.log("\u{1F464} [REGISTER] Cookies set successfully");
    console.log("\u2705 [REGISTER] Registration successful for user:", user.username);
    return {
      success: true,
      message: "Inscription r\xE9ussie",
      user
    };
  } catch (error) {
    console.error("\u274C [REGISTER] Error occurred:", error);
    if ((_a = error.message) == null ? void 0 : _a.includes("already exists")) {
      throw createError({
        statusCode: 409,
        statusMessage: "Un utilisateur avec cet email existe d\xE9j\xE0"
      });
    }
    throw error;
  }
});

export { register_post as default };
//# sourceMappingURL=register.post.mjs.map
