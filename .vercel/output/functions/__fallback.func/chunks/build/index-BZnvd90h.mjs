import { defineComponent, computed, h as h$1, onServerPrefetch, hasInjectionContext, inject } from 'vue';
import { Icon, getIcon, loadIcon } from '@iconify/vue';
import { getIconCSS } from '@iconify/utils/lib/css/icon';
import { d as ke, i as rt, e as je } from './server.mjs';
import { f } from './asyncData-BOLdWyFS.mjs';
import { u as useSeoMeta, a as useHead, h as headSymbol } from '../routes/renderer.mjs';
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
import 'vue/server-renderer';
import 'perfect-debounce';
import 'vue-bundle-renderer/runtime';
import 'unhead/server';
import 'devalue';
import 'unhead/plugins';
import 'unhead/utils';

function h(t){const s=t||ke();return s.ssrContext?.head||s.runWithContext(()=>{if(hasInjectionContext()){const e=inject(headSymbol);if(!e)throw new Error("[nuxt] [unhead] Missing Unhead instance.");return e}})}function g(e,n={}){const t=h(n.nuxt);return useHead(e,{head:t,...n})}function S(e,n={}){const t=h(n.nuxt);return useSeoMeta(e,{head:t,...n})}async function x(e,n){if(!e)return null;const t=getIcon(e);if(t)return t;let s;const o=loadIcon(e).catch(()=>(console.warn(`[Icon] failed to load icon \`${e}\``),null));return n>0?await Promise.race([o,new Promise(t=>{s=setTimeout(()=>{console.warn(`[Icon] loading icon \`${e}\` timed out after ${n}ms`),t();},n);})]).finally(()=>clearTimeout(s)):await o,getIcon(e)}function z(e){const n=rt().icon,s=(n.collections||[]).sort((e,n)=>n.length-e.length);return computed(()=>{const t=e(),o=t.startsWith(n.cssSelectorPrefix)?t.slice(n.cssSelectorPrefix.length):t,r=n.aliases?.[o]||o;if(!r.includes(":")){const e=s.find(e=>r.startsWith(e+"-"));return e?e+":"+r.slice(e.length+1):r}return r})}function w(e,n){if(false!==e)return  true===e||null===e?n:e}const _="NUXT_ICONS_SERVER_CSS";const C=defineComponent({name:"NuxtIconCss",props:{name:{type:String,required:true},customize:{type:[Function,Boolean,null],default:null,required:false}},setup(e){const n=ke(),s=rt().icon,u=computed(()=>e.name?s.cssSelectorPrefix+e.name:""),i=computed(()=>"."+function(e){return e.replace(/([^\w-])/g,"\\$1")}(u.value));return onServerPrefetch(async()=>{{const t=je().icon||{};if(!t?.serverKnownCssClasses?.includes(u.value)){const t=await x(e.name,s.fetchTimeout).catch(()=>null);if(!t)return null;let o=n.vueApp._context.provides[_];if(o||(o=n.vueApp._context.provides[_]=new Map,n.runWithContext(()=>{g({style:[()=>{let e=Array.from(o.values()).sort().join("");return s.cssLayer&&(e=`@layer ${s.cssLayer} {${e}}`),{innerHTML:e}}]},{tagPriority:"low"});})),e.name&&!o.has(e.name)){const n=function(n,t=true){let o=i.value;s.cssWherePseudo&&(o=`:where(${o})`);const r=getIconCSS(n,{iconSelector:o,format:"compressed",customise:w(e.customize,s.customize)});return s.cssLayer&&t?`@layer ${s.cssLayer} { ${r} }`:r}(t,false);o.set(e.name,n);}return null}}}),()=>h$1("span",{class:["iconify",u.value]})}}),N=defineComponent({name:"NuxtIconSvg",props:{name:{type:String,required:true},customize:{type:[Function,Boolean,null],default:null,required:false}},setup(e,{slots:n}){ke();const t=rt().icon,s=z(()=>e.name),u="i-"+s.value;return s.value&&onServerPrefetch(async()=>{await f(u,async()=>await x(s.value,t.fetchTimeout),{deep:false});}),()=>h$1(Icon,{icon:s.value,ssr:true,customise:w(e.customize,t.customize)},n)}}),$=defineComponent({name:"NuxtIcon",props:{name:{type:String,required:true},mode:{type:String,required:false,default:null},size:{type:[Number,String],required:false,default:null},customize:{type:[Function,Boolean,null],default:null,required:false}},setup(e,{slots:n}){const s=ke(),o=rt().icon,u=z(()=>e.name),i=computed(()=>s.vueApp?.component(u.value)||("svg"===(e.mode||o.mode)?N:C)),a=computed(()=>{const n=e.size||o.size;return n?{fontSize:Number.isNaN(+n)?n:n+"px"}:null});return ()=>h$1(i.value,{...o.attrs,name:u.value,class:o.class,style:a.value,customize:e.customize},n)}}),q=Object.freeze(Object.defineProperty({__proto__:null,default:$},Symbol.toStringTag,{value:"Module"}));

export { $ as _, g as a, q as i, S as u };
//# sourceMappingURL=index-BZnvd90h.mjs.map
