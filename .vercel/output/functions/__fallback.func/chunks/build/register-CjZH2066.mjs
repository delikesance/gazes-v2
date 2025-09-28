import { c } from './AuthForm-gwFmrMX0.mjs';
import { defineComponent, mergeProps, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent } from 'vue/server-renderer';
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
import 'vue-router';
import '@iconify/vue';

const a=defineComponent({__name:"register",__ssrInlineRender:true,setup(s){const d=e=>{console.log("Registration successful:",e),Oe("/");};return (s,t,n,a)=>{const m=c;t(`<div${ssrRenderAttrs(mergeProps({class:"register-page"},a))} data-v-3ab3e793>`),t(ssrRenderComponent(m,{"initial-mode":"register",onSuccess:d},null,n)),t("</div>");}}}),m=a.setup;a.setup=(e,s)=>{const o=useSSRContext();return (o.modules||(o.modules=new Set)).add("pages/register.vue"),m?m(e,s):void 0};const u=Ct(a,[["__scopeId","data-v-3ab3e793"]]);

export { u as default };
//# sourceMappingURL=register-CjZH2066.mjs.map
