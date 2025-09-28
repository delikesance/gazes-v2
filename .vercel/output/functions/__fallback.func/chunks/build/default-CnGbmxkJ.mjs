import { u as Ae, _ as bt, c as lt } from './server.mjs';
import { _ as $ } from './index-BZnvd90h.mjs';
import { defineComponent, computed, mergeProps, withCtx, createVNode, createTextVNode, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent, ssrRenderSlot } from 'vue/server-renderer';
import { a } from './useAuth-Cw79LLZm.mjs';
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
import '@iconify/utils/lib/css/icon';
import './asyncData-BOLdWyFS.mjs';
import 'perfect-debounce';
import '../routes/renderer.mjs';
import 'vue-bundle-renderer/runtime';
import 'unhead/server';
import 'devalue';
import 'unhead/plugins';
import 'unhead/utils';

const f=defineComponent({__name:"SiteHeader",__ssrInlineRender:true,setup(a$1){const u=Ae(),p=computed(()=>u.path.startsWith("/anime/")),f=computed(()=>"/catalogue"===u.path),g=computed(()=>"/"===u.path),_=computed(()=>"/series"===u.path),x=computed(()=>"/movies"===u.path);return a(),(e,a,l,u)=>{const v=bt,z=lt,j=$;a(`<nav${ssrRenderAttrs(mergeProps({class:["p-10 w-full z-[99] bg-transparent",p.value||f.value?"relative":"absolute top-0 left-0"]},u))}><div class="flex w-full items-center py-3 px-9 gap-10 pl-5 justify-between"><ul class="flex items-center gap-10"><li class="-mb-2 text-xl">`),a(ssrRenderComponent(v,{to:"/catalogue",class:{"text-violet-400":f.value}},{default:withCtx((e,s,t,i)=>{if(!s)return [createVNode(z,null,{default:withCtx(()=>[createVNode(j,{name:"heroicons-outline:search"})]),_:1})];s(ssrRenderComponent(z,null,{},t,i));}),_:1},l)),a("</li><li>"),a(ssrRenderComponent(v,{to:"/",class:{"text-violet-400":g.value}},{default:withCtx((e,s,t,i)=>{if(!s)return [createTextVNode("Accueil")];s("Accueil");}),_:1},l)),a("</li><li>"),a(ssrRenderComponent(v,{to:"/series",class:{"text-violet-400":_.value}},{default:withCtx((e,s,t,i)=>{if(!s)return [createTextVNode("Séries")];s("Séries");}),_:1},l)),a("</li><li>"),a(ssrRenderComponent(v,{to:"/movies",class:{"text-violet-400":x.value}},{default:withCtx((e,s,t,i)=>{if(!s)return [createTextVNode("Films")];s("Films");}),_:1},l)),a('</li></ul><div class="flex items-center gap-4">'),a(ssrRenderComponent(z,null,{},l)),a("</div></div></nav>");}}}),g=f.setup;f.setup=(e,s)=>{const t=useSSRContext();return (t.modules||(t.modules=new Set)).add("components/SiteHeader.vue"),g?g(e,s):void 0};const _=Object.assign(f,{__name:"SiteHeader"}),x=defineComponent({__name:"default",__ssrInlineRender:true,setup:e=>((new Date).getFullYear(),(e,s,t,i)=>{const a=_;s(`<div${ssrRenderAttrs(i)}>`),s(ssrRenderComponent(a,null,null,t)),s("<main>"),ssrRenderSlot(e.$slots,"default",{},null,s,t),s("</main></div>");})}),z=x.setup;x.setup=(e,s)=>{const t=useSSRContext();return (t.modules||(t.modules=new Set)).add("layouts/default.vue"),z?z(e,s):void 0};

export { x as default };
//# sourceMappingURL=default-CnGbmxkJ.mjs.map
