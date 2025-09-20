<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import Hls from 'hls.js'
import { useFetch, useRoute } from 'nuxt/app'

// Types matching server/shared parser outputs (subset)
type Season = { name: string; url: string; type: string }
type AnimeInfo = { title: string; altTitle?: string; cover: string; banner?: string; synopsis: string; genres: string[]; seasons: Season[] }
type Episode = { episode: number; url: string; urls?: string[] }

const route = useRoute()
const id = computed(() => String(route.params.id || ''))

const { data: info, error } = await useFetch<AnimeInfo>(`/api/anime/${id.value}`)

const selectedLang = ref<'vostfr' | 'vf'>('vostfr')
const selectedSeason = ref<Season | null>(null)
const episodes = ref<Episode[]>([])
const loadingEps = ref(false)

const seasonsByType = computed(() => {
  const groups: Record<string, Season[]> = {}
  for (const s of info.value?.seasons || []) {
    (groups[s.type] ||= []).push(s)
  }
  return groups
})

async function pickSeason(s: Season) {
  selectedSeason.value = s
  // Infer language support from the season URL; switch if current lang unsupported
  const supportsVostfr = /\/(vostfr)(?:\b|\/|$)/i.test(s.url)
  const supportsVf = /\/(vf)(?:\b|\/|$)/i.test(s.url)
  if (supportsVf && !supportsVostfr && selectedLang.value === 'vostfr') selectedLang.value = 'vf'
  if (supportsVostfr && !supportsVf && selectedLang.value === 'vf') selectedLang.value = 'vostfr'
  loadingEps.value = true
  episodes.value = []
  try {
    const parts = (s.url || '').split('/').filter(Boolean)
    const last = parts[parts.length - 1]
    const seasonSlug = (last === 'vf' || last === 'vostfr') ? (parts[parts.length - 2] || 'saison1') : (last || 'saison1')
    const { data } = await useFetch<{ episodes: Episode[] }>(`/api/anime/${id.value}/seasons/${seasonSlug}/${selectedLang.value}`)
    episodes.value = data.value?.episodes || []
  } finally {
    loadingEps.value = false
  }
}

onMounted(() => {
  if (!selectedSeason.value) {
    const first = info.value?.seasons?.[0]
    if (first) {
      // Initialize lang from first season URL to avoid empty results (e.g., only VF available)
      const supportsVf = /\/(vf)(?:\b|\/|$)/i.test(first.url)
      const supportsVostfr = /\/(vostfr)(?:\b|\/|$)/i.test(first.url)
      selectedLang.value = supportsVostfr ? 'vostfr' : supportsVf ? 'vf' : selectedLang.value
      pickSeason(first)
    }
  }
})

const showPlayer = ref(false)
const playUrl = ref('')
const resolving = ref(false)
const resolvedList = ref<{ type: string; url: string; proxiedUrl: string }[]>([])
const resolveError = ref('')
const fallbackEmbed = ref('')
const videoRef = ref<HTMLVideoElement | null>(null)
let hls: Hls | null = null
import { isBlacklisted } from '~/shared/utils/hosts'

function chooseFallbackEmbed(target: string, original: string): string {
  if (/\.m3u8($|\?)/i.test(target) || /\.(mp4|webm)($|\?)/i.test(target)) return original
  return target
}

async function pickPlayableUrl(ep: Episode): Promise<string> {
  const candidates = Array.isArray(ep.urls) && ep.urls.length ? ep.urls : [ep.url]
  const preferred = candidates.find(u => !isBlacklisted(u)) || candidates[0]
  return String(preferred || ep.url)
}

async function play(ep: Episode) {
  showPlayer.value = true
  resolving.value = true
  playUrl.value = ''
  resolvedList.value = []
  try {
  const target = await pickPlayableUrl(ep)
  const u64 = btoa(unescape(encodeURIComponent(target))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'')
  let referer: string | undefined
  try { const u = new URL(target); referer = u.origin + '/' } catch {}
    const route = useRoute()
    const debug = route.query.debug === '1' || route.query.debug === 'true'
    const { data } = await useFetch<any>('/api/player/resolve', {
      params: {
        u64,
        referer,
        ...(debug ? { debug: '1' } : {}),
      },
    })
    const ok = data.value?.ok
    resolveError.value = ok ? '' : (data.value?.message || 'Failed to resolve media URL')
    const urls = data.value?.urls || []
    resolvedList.value = urls
    if (ok && urls.length > 0) {
      const hlsFirst = urls.find((u: any) => u.type === 'hls') || urls[0]
      playUrl.value = hlsFirst.proxiedUrl || `/api/proxy?url=${encodeURIComponent(hlsFirst.url)}&rewrite=1`
      fallbackEmbed.value = ''
    } else {
      // Fallback: display the original embed page in an iframe to at least allow manual playback
      playUrl.value = ''
      fallbackEmbed.value = chooseFallbackEmbed(target, ep.url)
    }
  } finally {
    resolving.value = false
  }
}

function isM3U8(url: string) {
  return /\.m3u8(\?.*)?$/i.test(url)
}

function destroyHls() {
  if (hls) {
    try { hls.destroy() } catch { /* noop */ }
    hls = null
  }
}

watch([showPlayer, playUrl], async () => {
  if (!showPlayer.value) {
    destroyHls()
    return
  }
  const el = videoRef.value
  if (!el || !playUrl.value) return

  // If the URL is M3U8 and HLS.js is supported, use it; otherwise let the browser handle it
  if (isM3U8(playUrl.value) && Hls.isSupported()) {
    destroyHls()
    hls = new Hls({ enableWorker: true })
    hls.loadSource(playUrl.value)
    hls.attachMedia(el)
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      el.play().catch(() => {/* ignore */})
    })
  } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari and some browsers support HLS natively
    el.src = playUrl.value
    el.play().catch(() => {/* ignore */})
  } else {
    // Non-HLS fallback
    el.src = playUrl.value
    el.play().catch(() => {/* ignore */})
  }
})

onBeforeUnmount(() => {
  destroyHls()
})
</script>

<template>
  <div v-if="error" class="muted px-5 md:px-20 section">Failed to load anime. Try again later.</div>
  <div v-else-if="!info" class="muted px-5 md:px-20 section">Loading…</div>
  <div v-else>
    <section class="section px-5 md:px-20">
      <div class="grid grid-cols-1 md:grid-cols-[200px,1fr] gap-6 items-start">
        <img :src="info.cover" :alt="info.title" class="rounded-xl border border-zinc-800 shadow-sm w-full md:w-[200px] aspect-[3/4] object-cover" />
        <div>
          <h1 class="mb-1">{{ info.title }}</h1>
          <div v-if="info.altTitle" class="muted">aka {{ info.altTitle }}</div>
          <div class="divider"></div>
          <p class="muted">{{ info.synopsis }}</p>
          <div class="pills mt-2">
            <span v-for="g in info.genres" :key="g" class="pill">#{{ g }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="section px-5 md:px-20">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2>Seasons</h2>
        <div class="tabs">
          <button
            class="tab"
            :disabled="selectedSeason && !/\/(vostfr)(?:\b|\/|$)/i.test(selectedSeason.url)"
            :class="{ active: selectedLang==='vostfr' }"
            @click="selectedLang='vostfr'; selectedSeason && pickSeason(selectedSeason)"
          >�🇵 VOSTFR</button>
          <button
            class="tab"
            :disabled="selectedSeason && !/\/(vf)(?:\b|\/|$)/i.test(selectedSeason.url)"
            :class="{ active: selectedLang==='vf' }"
            @click="selectedLang='vf'; selectedSeason && pickSeason(selectedSeason)"
          >🇫🇷 VF</button>
        </div>
      </div>

      <div v-for="(group, t) in seasonsByType" :key="t" class="section pt-2">
        <div class="mb-2">
          <span class="badge"><span class="dot"></span>{{ t }}</span>
        </div>
        <div class="tabs">
          <button v-for="s in group" :key="s.url" class="tab" :class="{ active: selectedSeason && selectedSeason.url===s.url }" @click="pickSeason(s)">
            {{ s.name }}
          </button>
        </div>
      </div>

      <div class="section pt-2">
        <h2>Episodes</h2>
        <div v-if="loadingEps" class="muted">Loading episodes… ⌛️</div>
        <div v-else-if="episodes.length===0" class="muted">No episodes found 🤷</div>
        <div v-else class="flex flex-wrap gap-2 mt-2">
          <button v-for="e in episodes" :key="e.episode" class="pill hover:border-zinc-600" @click="play(e)">Ep {{ e.episode }} ▶️</button>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="showPlayer" class="scrim flex items-center justify-center p-4" @click.self="showPlayer=false">
        <div class="card w-full max-w-4xl p-3">
          <div class="flex items-center justify-between px-2 py-1">
            <span class="muted">Simple player • HLS preferred</span>
            <button class="btn secondary" @click="showPlayer=false">Close ✖️</button>
          </div>
          <div v-if="resolving" class="muted p-2">Resolving media… 🧭</div>
          <video v-if="!resolving && playUrl" ref="videoRef" controls autoplay class="w-full rounded-lg border border-zinc-800"></video>
          <iframe v-else-if="!resolving && fallbackEmbed" :src="fallbackEmbed" class="w-full aspect-video rounded-lg border border-zinc-800"></iframe>
          <div class="muted" v-else-if="!resolving">
            <div>No media URL</div>
            <div v-if="resolveError" class="text-rose-400 text-sm">{{ resolveError }}</div>
          </div>
          <div v-if="resolvedList.length" class="flex flex-wrap gap-2 p-2 overflow-auto">
            <button v-for="u in resolvedList" :key="u.url" class="btn ghost" @click="playUrl = u.proxiedUrl || `/api/proxy?url=${encodeURIComponent(u.url)}&rewrite=1`">
              {{ u.type.toUpperCase() }} 🔗
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
