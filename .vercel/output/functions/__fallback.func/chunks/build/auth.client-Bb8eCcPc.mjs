import { a } from './useAuth-Cw79LLZm.mjs';
import { g as qe, n as Oe } from './server.mjs';
import { u } from './cookie-DCPdh00r.mjs';
import 'vue';
import '../nitro/nitro.mjs';
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
import 'vue-router';
import '@iconify/vue';
import 'vue/server-renderer';
import './ssr-DTPz_gAB.mjs';

const i=qe(s=>{if(["/","/login","/register","/catalogue","/series","/movies","/others","/anime"].includes(s.path))return;if(s.path.startsWith("/watch"))return;const{isAuthenticated:i,pending:t}=a();if(!t.value&&!i.value){return u("redirectAfterLogin").value=s.fullPath,Oe("/login")}});

export { i as default };
//# sourceMappingURL=auth.client-Bb8eCcPc.mjs.map
