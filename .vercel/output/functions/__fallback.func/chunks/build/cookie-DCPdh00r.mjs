import { ref } from 'vue';
import { a3 as getRequestHeader, z as destr, K as klona, a4 as isEqual, a5 as setCookie, f as getCookie, a6 as deleteCookie } from '../nitro/nitro.mjs';
import { d as ke } from './server.mjs';
import { e } from './ssr-DTPz_gAB.mjs';

function parse(str, options) {
  if (typeof str !== "string") {
    throw new TypeError("argument str must be a string");
  }
  const obj = {};
  const opt = options || {};
  const dec = opt.decode || decode;
  let index = 0;
  while (index < str.length) {
    const eqIdx = str.indexOf("=", index);
    if (eqIdx === -1) {
      break;
    }
    let endIdx = str.indexOf(";", index);
    if (endIdx === -1) {
      endIdx = str.length;
    } else if (endIdx < eqIdx) {
      index = str.lastIndexOf(";", eqIdx - 1) + 1;
      continue;
    }
    const key = str.slice(index, eqIdx).trim();
    if (opt?.filter && !opt?.filter(key)) {
      index = endIdx + 1;
      continue;
    }
    if (void 0 === obj[key]) {
      let val = str.slice(eqIdx + 1, endIdx).trim();
      if (val.codePointAt(0) === 34) {
        val = val.slice(1, -1);
      }
      obj[key] = tryDecode(val, dec);
    }
    index = endIdx + 1;
  }
  return obj;
}
function decode(str) {
  return str.includes("%") ? decodeURIComponent(str) : str;
}
function tryDecode(str, decode2) {
  try {
    return decode2(str);
  } catch {
    return str;
  }
}

const l={path:"/",watch:true,decode:e=>destr(decodeURIComponent(e)),encode:e=>encodeURIComponent("string"==typeof e?e:JSON.stringify(e))};function u(r,u){const p={...l,...u};p.filter??=e=>e===r;const f=function(e$1={}){return parse(getRequestHeader(e(),"cookie")||"",e$1)}(p)||{};let k;void 0!==p.maxAge?k=1e3*p.maxAge:p.expires&&(k=p.expires.getTime()-Date.now());const g=klona(void 0!==k&&k<=0?void 0:f[r]??p.default?.()),v=ref(g);{const e$1=ke(),o=()=>{p.readonly||isEqual(v.value,f[r])||(e$1._cookies||={},r in e$1._cookies&&isEqual(v.value,e$1._cookies[r])||(e$1._cookies[r]=v.value,function(e,o,s,r={}){if(e){if(null!=s)return setCookie(e,o,s,r);if(void 0!==getCookie(e,o))deleteCookie(e,o,r);}}(e(e$1),r,v.value,p)));},s=e$1.hooks.hookOnce("app:rendered",o);e$1.hooks.hookOnce("app:error",()=>(s(),o()));}return v}

export { u };
//# sourceMappingURL=cookie-DCPdh00r.mjs.map
