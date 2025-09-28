import { ref, computed, watch } from 'vue';

const u=(u,r={})=>{const{debounceMs:t=300,minLength:n=1,immediate:o=false}=r,i=ref(""),v=ref(false),s=ref([]),c=ref(null),m=ref(false),h=computed(()=>m.value&&0===s.value.length);let d=null,g=null;const b=async e=>{const l=e??i.value;if(!l||l.length<n)return s.value=[],m.value=false,void(c.value=null);g&&g.abort(),g=new AbortController,v.value=true,c.value=null;try{const e=await u(l);if(g.signal.aborted)return;s.value=e,m.value=!0;}catch(a){g.signal.aborted||(c.value=a instanceof Error?a.message:"Search failed",s.value=[]);}finally{g.signal.aborted||(v.value=false);}},f=()=>{i.value="",s.value=[],m.value=false,c.value=null,v.value=false,d&&(clearTimeout(d),d=null),g&&(g.abort(),g=null);};return watch(i,e=>{var l;e&&e.length>=n?(l=e,d&&clearTimeout(d),d=setTimeout(()=>{b(l);},t)):e||f();},{immediate:o}),{query:i,search:{loading:v,results:s,error:c,isEmpty:h,hasSearched:m},executeSearch:b,clearSearch:f}};

export { u };
//# sourceMappingURL=useSearch-BmyD_PFd.mjs.map
