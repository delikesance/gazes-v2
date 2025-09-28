import { ssrRenderAttrs, ssrRenderSlot } from 'vue/server-renderer';
import { useSSRContext } from 'vue';
import { b as Ct } from './server.mjs';
import '../nitro/nitro.mjs';
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

const i={};const n=i.setup;i.setup=(e,s)=>{const o=useSSRContext();return (o.modules||(o.modules=new Set)).add("layouts/player.vue"),n?n(e,s):void 0};const r=Ct(i,[["ssrRender",function(d,o,i,n){o(`<div${ssrRenderAttrs(n)}><main>`),ssrRenderSlot(d.$slots,"default",{},null,o,i),o("</main></div>");}]]);

export { r as default };
//# sourceMappingURL=player-HcisSb8M.mjs.map
