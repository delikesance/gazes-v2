<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from "vue";
import Hls from "hls.js";
import { useFetch, useRoute } from "nuxt/app";

// Types matching server/shared parser outputs (subset)
type Season = { name: string; url: string; type: string };
type AnimeInfo = {
    title: string;
    altTitle?: string;
    cover: string;
    banner?: string;
    synopsis: string;
    genres: string[];
    seasons: Season[];
    manga?: { url: string; name?: string }[];
};
type Episode = { episode: number; url: string; urls?: string[] };

const route = useRoute();
const id = computed(() => String(route.params.id || ""));

// Debug logger function
const debug = computed(() => route.query.debug === "1" || route.query.debug === "true");
const debugLog = (...args: any[]) => {
    if (debug.value) {
        console.log(...args);
    }
};

const { data: info, error } = await useFetch<AnimeInfo>(
    `/api/anime/${id.value}`,
);

const selectedLang = ref<"vostfr" | "vf">("vostfr");
const selectedSeason = ref<Season | null>(null);
const episodes = ref<Episode[]>([]);
const loadingEps = ref(false);

const seasonsByType = computed(() => {
    const groups: Record<string, Season[]> = {};
    for (const s of info.value?.seasons || []) {
        (groups[s.type] ||= []).push(s);
    }
    return groups;
});

async function pickSeason(s: Season) {
    selectedSeason.value = s;
    // Infer language support from the season URL; switch if current lang unsupported
    const supportsVostfr = /\/(vostfr)(?:\b|\/|$)/i.test(s.url);
    const supportsVf = /\/(vf)(?:\b|\/|$)/i.test(s.url);
    if (supportsVf && !supportsVostfr && selectedLang.value === "vostfr")
        selectedLang.value = "vf";
    if (supportsVostfr && !supportsVf && selectedLang.value === "vf")
        selectedLang.value = "vostfr";
    loadingEps.value = true;
    episodes.value = [];
    try {
        const parts = (s.url || "").split("/").filter(Boolean);
        const last = parts[parts.length - 1];
        const seasonSlug =
            last === "vf" || last === "vostfr"
                ? parts[parts.length - 2] || "saison1"
                : last || "saison1";
        const { data } = await useFetch<{ episodes: Episode[] }>(
            `/api/anime/${id.value}/seasons/${seasonSlug}/${selectedLang.value}`,
        );
        episodes.value = data.value?.episodes || [];
    } finally {
        loadingEps.value = false;
    }
}

onMounted(() => {
    if (!selectedSeason.value) {
        const first = info.value?.seasons?.[0];
        if (first) {
            // Initialize lang from first season URL to avoid empty results (e.g., only VF available)
            const supportsVf = /\/(vf)(?:\b|\/|$)/i.test(first.url);
            const supportsVostfr = /\/(vostfr)(?:\b|\/|$)/i.test(first.url);
            selectedLang.value = supportsVostfr
                ? "vostfr"
                : supportsVf
                  ? "vf"
                  : selectedLang.value;
            pickSeason(first);
        }
    }
});

const showPlayer = ref(false);
const playUrl = ref("");
const resolving = ref(false);
const resolvedList = ref<{ type: string; url: string; proxiedUrl: string; quality?: string }[]>([]);
const resolveError = ref("");
const videoRef = ref<HTMLVideoElement | null>(null);
let hls: Hls | null = null;
import { isBlacklisted } from "~/shared/utils/hosts";

async function pickPlayableUrl(ep: Episode): Promise<string> {
    const candidates =
        Array.isArray(ep.urls) && ep.urls.length ? ep.urls : [ep.url];
    const preferred =
        candidates.find((u) => !isBlacklisted(u)) || candidates[0];
    return String(preferred || ep.url);
}

async function play(ep: Episode) {
    showPlayer.value = true;
    resolving.value = true;
    playUrl.value = "";
    resolvedList.value = [];
    resolveError.value = "";
    
    try {
        const target = await pickPlayableUrl(ep);
        debugLog('🎯 Target URL:', target);
        
        const u64 = btoa(unescape(encodeURIComponent(target)))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
        
        let referer: string | undefined;
        try {
            const u = new URL(target);
            referer = u.origin + "/";
        } catch {}
        
        debugLog('🔍 Resolving with params:', { u64, referer, debug: debug.value });
        
        const { data, error } = await useFetch<any>("/api/player/resolve", {
            params: {
                u64,
                referer,
                ...(debug.value ? { debug: "1" } : {}),
            },
            timeout: 30000, // 30 second timeout
        });
        
        if (error.value) {
            console.error('❌ Fetch error:', error.value);
            resolveError.value = `Network error: ${error.value.message || 'Failed to connect'}`;
            return;
        }
        
        debugLog('📦 Resolve response:', data.value);
        
        const ok = data.value?.ok;
        resolveError.value = ok
            ? ""
            : data.value?.message || "Failed to resolve media URL";
        const urls = data.value?.urls || [];
        resolvedList.value = urls;
        
        if (ok && urls.length > 0) {
            const hlsFirst = urls.find((u: any) => u.type === "hls") || urls[0];
            const selectedUrl = hlsFirst.proxiedUrl || hlsFirst.url;
            
            debugLog('✅ Selected media URL:', selectedUrl);
            debugLog('📊 Media type:', hlsFirst.type);
            
            playUrl.value = selectedUrl;
        } else {
            playUrl.value = "";
            resolveError.value = resolveError.value || "No direct video streams found";
            console.warn('⚠️ No playable URLs found');
        }
    } catch (error: any) {
        console.error('💥 Unexpected error:', error);
        resolveError.value = `Unexpected error: ${error.message || 'Unknown error'}`;
    } finally {
        resolving.value = false;
    }
}

function isM3U8(url: string) {
    return /\.m3u8(\?.*)?$/i.test(url);
}

function destroyHls() {
    if (hls) {
        try {
            hls.destroy();
        } catch {
            /* noop */
        }
        hls = null;
    }
}

async function setupVideo() {
    const el = videoRef.value;
    if (!el || !playUrl.value) return;

    debugLog('🎬 Setting up video with URL:', playUrl.value);
    
    // Reset video element
    el.pause();
    el.removeAttribute('src');
    el.load();

    // If the URL is M3U8 and HLS.js is supported, use it
    if (isM3U8(playUrl.value) && Hls.isSupported()) {
        debugLog('📺 Using HLS.js for M3U8 playback');
        destroyHls();
        hls = new Hls({ 
            enableWorker: true,
            debug: false,
            lowLatencyMode: false,
            backBufferLength: 90
        });
        
        hls.loadSource(playUrl.value);
        hls.attachMedia(el);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            debugLog('✅ HLS manifest parsed, starting playback');
            el.play().catch((err) => {
                console.warn('Autoplay blocked:', err);
            });
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('❌ HLS error:', data);
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        debugLog('🔄 Trying to recover from network error');
                        hls?.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        debugLog('🔄 Trying to recover from media error');
                        hls?.recoverMediaError();
                        break;
                    default:
                        debugLog('💥 Fatal error, destroying HLS');
                        destroyHls();
                        resolveError.value = `HLS playback error: ${data.details}`;
                        break;
                }
            }
        });
        
    } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari and some browsers support HLS natively
        debugLog('🍎 Using native HLS support');
        destroyHls();
        el.src = playUrl.value;
        el.play().catch((err) => {
            console.warn('Autoplay blocked:', err);
        });
    } else {
        // Non-HLS fallback (MP4, etc.)
        debugLog('🎥 Using native video element for direct playback');
        destroyHls();
        el.src = playUrl.value;
        el.play().catch((err) => {
            console.warn('Autoplay blocked:', err);
        });
    }
}

watch([showPlayer, playUrl], async () => {
    if (!showPlayer.value) {
        destroyHls();
        return;
    }
    await nextTick(); // Wait for DOM updates
    setupVideo();
});

onBeforeUnmount(() => {
    destroyHls();
});

// Video error handling
const handleVideoError = (event: Event) => {
    const video = event.target as HTMLVideoElement;
    const error = video.error;

    if (error) {
        console.error("Video playback error:", error);
        const errorMsg = getVideoErrorMessage(error.code);
        resolveError.value = `Video playback error: ${errorMsg}`;
        
        // Try to get more info about the current source
        if (playUrl.value) {
            console.error("Failed URL:", playUrl.value);
            console.error("Video readyState:", video.readyState);
            console.error("Video networkState:", video.networkState);
        }
    }
};

const getVideoErrorMessage = (errorCode: number): string => {
    switch (errorCode) {
        case 1:
            return "Playback aborted by user";
        case 2:
            return "Network error during download";
        case 3:
            return "Media decoding error";
        case 4:
            return "Video format not supported";
        default:
            return "Unknown error";
    }
};
</script>

<template>
    <div v-if="error" class="muted px-5 md:px-20 section">
        Failed to load anime. Try again later.
    </div>
    <div v-else-if="!info" class="muted px-5 md:px-20 section">Loading…</div>
    <div v-else>
        <section class="section px-5 md:px-20">
            <div
                class="grid grid-cols-1 md:grid-cols-[200px,1fr] gap-6 items-start"
            >
                <img
                    :src="info.cover"
                    :alt="info.title"
                    class="rounded-xl border border-zinc-800 shadow-sm w-full md:w-[200px] aspect-[3/4] object-cover"
                />
                <div>
                    <h1 class="mb-1">{{ info.title }}</h1>
                    <div v-if="info.altTitle" class="muted">
                        aka {{ info.altTitle }}
                    </div>
                    <div class="divider"></div>
                    <p class="muted">{{ info.synopsis }}</p>
                    <div class="pills mt-2">
                        <span v-for="g in info.genres" :key="g" class="pill"
                            >#{{ g }}</span
                        >
                    </div>
                </div>
            </div>
        </section>

        <section class="section px-5 md:px-20">
            <!-- No Seasons Available -->
            <div
                v-if="!info.seasons || info.seasons.length === 0"
                class="text-center py-16"
            >
                <div class="mb-4">
                    <ClientOnly>
                        <Icon
                            :name="
                                info.manga && info.manga.length > 0
                                    ? 'heroicons:book-open'
                                    : 'heroicons:film'
                            "
                            class="w-16 h-16 text-zinc-500 mx-auto mb-4"
                        />
                    </ClientOnly>
                    <h3 class="text-xl font-semibold mb-2">
                        {{
                            info.manga && info.manga.length > 0
                                ? "Contenu manga uniquement"
                                : "Contenu non disponible"
                        }}
                    </h3>
                    <p class="text-zinc-400 mb-6 max-w-md mx-auto">
                        <template v-if="info.manga && info.manga.length > 0">
                            Ce titre n'a pas d'adaptation animée disponible.
                            Vous pouvez consulter la version manga/manhwa à la
                            place.
                        </template>
                        <template v-else>
                            Aucune saison ou épisode n'est actuellement
                            disponible pour cet anime. Il se peut que le contenu
                            soit en cours d'ajout ou temporairement
                            indisponible.
                        </template>
                    </p>
                    <div class="flex justify-center gap-3">
                        <NuxtLink
                            v-if="
                                info.manga &&
                                info.manga.length > 0 &&
                                info.manga[0]?.url
                            "
                            :to="info.manga[0].url"
                            class="btn primary"
                        >
                            Lire le manga
                        </NuxtLink>
                        <NuxtLink to="/catalogue" class="btn secondary">
                            Retour au catalogue
                        </NuxtLink>
                        <button @click="$router.go(-1)" class="btn ghost">
                            Page précédente
                        </button>
                    </div>
                </div>
            </div>

            <!-- Seasons Available -->
            <template v-else>
                <div
                    class="flex flex-wrap items-center justify-between gap-3 mb-3"
                >
                    <h2>Seasons</h2>
                    <div class="tabs">
                        <button
                            class="tab"
                            :disabled="
                                !!(
                                    selectedSeason &&
                                    !/\/(vostfr)(?:\b|\/|$)/i.test(
                                        selectedSeason.url,
                                    )
                                )
                            "
                            :class="{ active: selectedLang === 'vostfr' }"
                            @click="
                                selectedLang = 'vostfr';
                                selectedSeason && pickSeason(selectedSeason);
                            "
                        >
                            🇯🇵 VOSTFR
                        </button>
                        <button
                            class="tab"
                            :disabled="
                                !!(
                                    selectedSeason &&
                                    !/\/(vf)(?:\b|\/|$)/i.test(
                                        selectedSeason.url,
                                    )
                                )
                            "
                            :class="{ active: selectedLang === 'vf' }"
                            @click="
                                selectedLang = 'vf';
                                selectedSeason && pickSeason(selectedSeason);
                            "
                        >
                            🇫🇷 VF
                        </button>
                    </div>
                </div>

                <div
                    v-for="(group, t) in seasonsByType"
                    :key="t"
                    class="section pt-2"
                >
                    <div class="mb-2">
                        <span class="badge"
                            ><span class="dot"></span>{{ t }}</span
                        >
                    </div>
                    <div class="tabs">
                        <button
                            v-for="s in group"
                            :key="s.url"
                            class="tab"
                            :class="{
                                active:
                                    selectedSeason &&
                                    selectedSeason.url === s.url,
                            }"
                            @click="pickSeason(s)"
                        >
                            {{ s.name }}
                        </button>
                    </div>
                </div>

                <div class="section pt-2">
                    <h2>Episodes</h2>
                    <div
                        v-if="loadingEps"
                        class="muted flex items-center gap-2"
                    >
                        <div
                            class="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"
                        ></div>
                        Loading episodes…
                    </div>
                    <div
                        v-else-if="episodes.length === 0 && selectedSeason"
                        class="text-center py-8"
                    >
                        <ClientOnly>
                            <Icon
                                name="heroicons:exclamation-triangle"
                                class="w-12 h-12 text-amber-500 mx-auto mb-3"
                            />
                        </ClientOnly>
                        <h4 class="font-semibold mb-2">
                            Aucun épisode disponible
                        </h4>
                        <p class="text-zinc-400 text-sm mb-4">
                            Cette saison ne contient actuellement aucun épisode
                            disponible.
                        </p>
                        <div class="flex justify-center gap-2">
                            <button
                                @click="pickSeason(selectedSeason)"
                                class="btn ghost text-sm"
                            >
                                Réessayer
                            </button>
                        </div>
                    </div>
                    <div
                        v-else-if="episodes.length > 0"
                        class="flex flex-wrap gap-2 mt-2"
                    >
                        <button
                            v-for="e in episodes"
                            :key="e.episode"
                            class="pill hover:border-zinc-600"
                            @click="play(e)"
                        >
                            Ep {{ e.episode }} ▶️
                        </button>
                    </div>
                </div>
            </template>
        </section>

        <Teleport to="body">
            <div
                v-if="showPlayer"
                class="scrim flex items-center justify-center p-4"
                @click.self="showPlayer = false"
            >
                <div class="card w-full max-w-4xl p-3">
                    <div class="flex items-center justify-between px-2 py-1">
                        <span class="muted">Simple player • HLS preferred</span>
                        <button
                            class="btn secondary"
                            @click="showPlayer = false"
                        >
                            Close ✖️
                        </button>
                    </div>
                    <div v-if="resolving" class="muted p-2 text-center">
                        <div class="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Resolving media… 🧭
                    </div>
                    <video
                        v-if="!resolving && playUrl"
                        ref="videoRef"
                        controls
                        autoplay
                        preload="metadata"
                        class="w-full rounded-lg border border-zinc-800"
                        controlsList="nodownload"
                        disablePictureInPicture
                        @error="handleVideoError"
                        @loadstart="() => debugLog('📺 Video loadstart')"
                        @loadedmetadata="() => debugLog('📺 Video metadata loaded')"
                        @canplay="() => debugLog('📺 Video can play')"
                        @playing="() => debugLog('📺 Video playing')"
                    ></video>
                    <div class="muted text-center py-8" v-else-if="!resolving">
                        <div class="mb-4">
                            <ClientOnly>
                                <Icon
                                    name="heroicons:exclamation-triangle"
                                    class="w-12 h-12 text-amber-500 mx-auto mb-3"
                                />
                            </ClientOnly>
                            <h4 class="font-semibold mb-2">
                                Aucun flux vidéo trouvé
                            </h4>
                            <p class="text-zinc-400 text-sm mb-4">
                                Impossible d'extraire le lien vidéo direct de cette source.
                                Essayez un autre épisode ou une autre source.
                            </p>
                            <div v-if="resolveError" class="text-rose-400 text-sm mt-2">
                                {{ resolveError }}
                            </div>
                        </div>
                    </div>
                    <div
                        v-if="resolvedList.length"
                        class="flex flex-wrap gap-2 p-2 overflow-auto"
                    >
                        <button
                            v-for="u in resolvedList"
                            :key="u.url"
                            class="btn ghost text-sm"
                            @click="
                                playUrl =
                                    u.proxiedUrl ||
                                    `/api/proxy?url=${encodeURIComponent(u.url)}&rewrite=1`
                            "
                        >
                            {{ u.type.toUpperCase() }}{{ u.quality ? ` ${u.quality}` : '' }} 🔗
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
