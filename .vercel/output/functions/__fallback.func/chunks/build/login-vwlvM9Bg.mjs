import { c } from './AuthForm-gwFmrMX0.mjs';
import { defineComponent, mergeProps, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent } from 'vue/server-renderer';
import { u as u$1 } from './cookie-DCPdh00r.mjs';
import { b as Ct, n as Oe } from './server.mjs';
import './useAuth-Cw79LLZm.mjs';
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
import './ssr-DTPz_gAB.mjs';
import 'vue-router';
import '@iconify/vue';

const m=defineComponent({__name:"login",__ssrInlineRender:true,setup(s){const d=e=>{console.log("Login successful:",e);const s=u$1("redirectAfterLogin"),o=s.value||"/";s.value=null,Oe(o);};return (s,t,r,a)=>{const m=c;t(`<div${ssrRenderAttrs(mergeProps({class:"login-page"},a))} data-v-9425b2a7>`),t(ssrRenderComponent(m,{"initial-mode":"login",onSuccess:d},null,r)),t("</div>");}}}),l=m.setup;m.setup=(e,s)=>{const o=useSSRContext();return (o.modules||(o.modules=new Set)).add("pages/login.vue"),l?l(e,s):void 0};const u=Ct(m,[["__scopeId","data-v-9425b2a7"]]);

export { u as default };
//# sourceMappingURL=login-vwlvM9Bg.mjs.map
