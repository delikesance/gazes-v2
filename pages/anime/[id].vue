<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from "vue";
import Hls from "hls.js";
import { useFetch, useRoute } from "nuxt/app";
import { extractSeasonSlug } from "~/shared/utils/season";

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
type Episode = { episode: number; title?: string; url: string; urls?: string[] };

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
const selectedSeasonUrl = ref<string>("");
const episodes = ref<Episode[]>([]);
const loadingEps = ref(false);
const availableLanguages = ref<{ vostfr: boolean; vf: boolean }>({ vostfr: false, vf: false });
const checkingLanguages = ref(false);

// Computed property for anime seasons to ensure consistency
const animeSeasons = computed(() => {
    return info.value?.seasons?.filter(season => season.type?.toLowerCase() === 'anime') || [];
});

async function checkLanguageAvailability(seasonSlug: string): Promise<{ vostfr: boolean; vf: boolean }> {
    debugLog('🔍 Checking language availability for season:', seasonSlug);
    checkingLanguages.value = true;
    
    const results = { vostfr: false, vf: false };
    
    // Quick optimization: if the season URL already contains a language, prioritize that one
    const seasonUrl = selectedSeason.value?.url || '';
    const urlContainsVf = seasonUrl.includes('/vf');
    const urlContainsVostfr = seasonUrl.includes('/vostfr');
    
    if (urlContainsVf && !urlContainsVostfr) {
        debugLog('🚀 Season URL indicates VF only, testing VF first...');
        try {
            const vfData = await $fetch<{ episodes: Episode[] }>(`/api/anime/episodes/${id.value}/${seasonSlug}/vf`);
            const hasVfEpisodes = vfData?.episodes && vfData.episodes.length > 0;
            results.vf = hasVfEpisodes;
            debugLog(`✅ VF available:`, hasVfEpisodes, `(${vfData?.episodes?.length || 0} episodes)`);
            
            if (hasVfEpisodes) {
                // VF works, quickly test VOSTFR with shorter timeout
                try {
                    const vostfrData = await Promise.race([
                        $fetch<{ episodes: Episode[] }>(`/api/anime/episodes/${id.value}/${seasonSlug}/vostfr`),
                        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('VOSTFR timeout')), 3000))
                    ]);
                    results.vostfr = (vostfrData as any)?.episodes && (vostfrData as any).episodes.length > 0;
                    debugLog(`✅ VOSTFR available:`, results.vostfr, `(${(vostfrData as any)?.episodes?.length || 0} episodes)`);
                } catch (error: any) {
                    debugLog(`⚡ VOSTFR test skipped/failed (fast):`, error?.message || error);
                    results.vostfr = false;
                }
                checkingLanguages.value = false;
                return results;
            }
        } catch (error: any) {
            debugLog(`❌ VF test failed:`, error?.message || error);
            results.vf = false;
        }
    } else if (urlContainsVostfr && !urlContainsVf) {
        debugLog('🚀 Season URL indicates VOSTFR only, testing VOSTFR first...');
        try {
            const vostfrData = await $fetch<{ episodes: Episode[] }>(`/api/anime/episodes/${id.value}/${seasonSlug}/vostfr`);
            const hasVostfrEpisodes = vostfrData?.episodes && vostfrData.episodes.length > 0;
            results.vostfr = hasVostfrEpisodes;
            debugLog(`✅ VOSTFR available:`, hasVostfrEpisodes, `(${vostfrData?.episodes?.length || 0} episodes)`);
            
            if (hasVostfrEpisodes) {
                // VOSTFR works, quickly test VF
                try {
                    const vfData = await Promise.race([
                        $fetch<{ episodes: Episode[] }>(`/api/anime/episodes/${id.value}/${seasonSlug}/vf`),
                        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('VF timeout')), 3000))
                    ]);
                    results.vf = (vfData as any)?.episodes && (vfData as any).episodes.length > 0;
                    debugLog(`✅ VF available:`, results.vf, `(${(vfData as any)?.episodes?.length || 0} episodes)`);
                } catch (error: any) {
                    debugLog(`⚡ VF test skipped/failed (fast):`, error?.message || error);
                    results.vf = false;
                }
                checkingLanguages.value = false;
                return results;
            }
        } catch (error: any) {
            debugLog(`❌ VOSTFR test failed:`, error?.message || error);
            results.vostfr = false;
        }
    }
    
    // Fallback: test both languages in parallel with timeout for slow responses
    debugLog('🔄 Testing both languages in parallel with timeout...');
    const tests = await Promise.allSettled([
        Promise.race([
            $fetch<{ episodes: Episode[] }>(`/api/anime/episodes/${id.value}/${seasonSlug}/vostfr`).then(data => ({ lang: 'vostfr' as const, data })),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('VOSTFR timeout')), 5000))
        ]),
        Promise.race([
            $fetch<{ episodes: Episode[] }>(`/api/anime/episodes/${id.value}/${seasonSlug}/vf`).then(data => ({ lang: 'vf' as const, data })),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('VF timeout')), 5000))
        ])
    ]);
    
    for (const test of tests) {
        if (test.status === 'fulfilled') {
            const { lang, data } = test.value as { lang: 'vostfr' | 'vf', data: { episodes: Episode[] } };
            const hasEpisodes = data?.episodes && data.episodes.length > 0;
            results[lang] = hasEpisodes;
            debugLog(`✅ ${lang.toUpperCase()} available:`, hasEpisodes, `(${data?.episodes?.length || 0} episodes)`);
        } else {
            const errorMsg = String(test.reason?.message || test.reason || '');
            let lang = 'unknown';
            if (errorMsg.includes('vostfr') || errorMsg.includes('VOSTFR')) {
                lang = 'vostfr';
            } else if (errorMsg.includes('vf') || errorMsg.includes('VF')) {
                lang = 'vf';
            }
            
            debugLog(`⚡ ${lang.toUpperCase()} test failed/timeout:`, errorMsg);
            if (lang !== 'unknown') {
                results[lang as 'vostfr' | 'vf'] = false;
            }
        }
    }
    
    checkingLanguages.value = false;
    debugLog('🎯 Final language availability:', results);
    return results;
}

async function pickSeason(s: Season) {
    // Prevent loading if already loading or same season
    if (loadingEps.value || (selectedSeason.value?.url === s.url && episodes.value.length > 0)) {
        debugLog('🔄 Already loading or same season selected, skipping...');
        return;
    }
    
    debugLog('🎯 pickSeason called with:', s);
    selectedSeason.value = s;
    selectedSeasonUrl.value = s.url;
    loadingEps.value = true;
    episodes.value = [];
    
    try {
        const seasonSlug = extractSeasonSlug(s.url);
        
        debugLog('🎯 Season selected:', { name: s.name, url: s.url, seasonSlug });
        
        // Check which languages are available for this season (slower path)
        debugLog('🔄 Checking language availability...');
        // Check which languages are available for this season
        availableLanguages.value = await checkLanguageAvailability(seasonSlug);
        debugLog('🌐 Available languages:', availableLanguages.value);
        
        // Determine which language to use with better priority logic
        let targetLang = selectedLang.value;
        
        // If current language is not available, find the best available one
        if (!availableLanguages.value[selectedLang.value]) {
            if (availableLanguages.value.vostfr) {
                targetLang = "vostfr";
                debugLog(`🔄 Switching to VOSTFR (${selectedLang.value} not available)`);
            } else if (availableLanguages.value.vf) {
                targetLang = "vf";
                debugLog(`🔄 Switching to VF (${selectedLang.value} not available)`);
            } else {
                debugLog('❌ No languages available for this season');
                episodes.value = [];
                loadingEps.value = false;
                return;
            }
            selectedLang.value = targetLang;
        }
        
        debugLog(`� Loading episodes in ${targetLang.toUpperCase()}...`);
        
        // Load episodes for the determined language
        await loadEpisodesForLanguage(seasonSlug, targetLang);
        
        debugLog(`✅ Successfully loaded ${episodes.value.length} episodes for ${targetLang.toUpperCase()}`);
        
    } catch (error) {
        console.error('❌ Error in pickSeason:', error);
        episodes.value = [];
    } finally {
        loadingEps.value = false;
    }
}

async function loadEpisodesForLanguage(seasonSlug: string, lang: "vostfr" | "vf") {
    debugLog('📺 Loading episodes for:', { seasonSlug, lang });
    
    try {
        const response = await $fetch<{ episodes: Episode[] }>(
            `/api/anime/episodes/${id.value}/${seasonSlug}/${lang}`,
        );
        // Filter out episodes with invalid episode numbers (0 or negative)
        const allEpisodes = response?.episodes || [];
        episodes.value = allEpisodes.filter(ep => ep.episode > 0);
        debugLog(`✅ Loaded ${episodes.value.length} episodes for ${lang.toUpperCase()} (filtered from ${allEpisodes.length} total)`);
        debugLog(`📋 First 5 episodes:`, episodes.value.slice(0, 5));
    } catch (error) {
        console.error(`❌ Failed to load episodes for ${lang}:`, error);
        episodes.value = [];
        throw error; // Re-throw to let caller handle it
    }
}

async function switchLanguage(newLang: "vostfr" | "vf") {
    if (!selectedSeason.value || !availableLanguages.value[newLang] || selectedLang.value === newLang || loadingEps.value) {
        debugLog(`❌ Cannot switch to ${newLang}: not available, already selected, or loading in progress`);
        return;
    }
    
    selectedLang.value = newLang;
    loadingEps.value = true;
    episodes.value = [];
    
    try {
        const parts = (selectedSeason.value.url || "").split("/").filter(Boolean);
        const last = parts[parts.length - 1];
        const seasonSlug = last === "vf" || last === "vostfr"
            ? parts[parts.length - 2] || "saison1"
            : last || "saison1";
            
        await loadEpisodesForLanguage(seasonSlug, newLang);
    } finally {
        loadingEps.value = false;
    }
}

onMounted(() => {
    if (!selectedSeason.value) {
        const first = animeSeasons.value[0];
        if (first) {
            debugLog('🎬 Auto-selecting first anime season:', first);
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
    
    debugLog('🎯 Original URL candidates:', candidates);
    
    // Filter out blacklisted URLs first
    const nonBlacklisted = candidates.filter((u) => !isBlacklisted(u));
    const urlsToSort = nonBlacklisted.length > 0 ? nonBlacklisted : candidates;
    
    debugLog('🚫 After blacklist filtering:', urlsToSort);
    
    // Use our provider prioritization API to sort URLs by reliability
    try {
        const sortParams = new URLSearchParams();
        urlsToSort.forEach(url => sortParams.append('urls', url));
        
        debugLog('🔄 Requesting provider sorting for:', urlsToSort);
        const response = await $fetch(`/api/providers?action=sort&${sortParams.toString()}`) as any;
        
        if (response?.sortedUrls && response.sortedUrls.length > 0) {
            debugLog('🏆 Provider API returned sorted URLs:', response.sortedUrls);
            debugLog('📊 URL categorization:', response.categorizedUrls);
            debugLog('✅ Selected best provider URL:', response.sortedUrls[0]);
            return String(response.sortedUrls[0]); // Return the best provider URL
        } else {
            debugLog('⚠️ Provider API returned no sorted URLs:', response);
        }
    } catch (error) {
        debugLog('❌ Provider sorting failed, falling back to manual selection:', error);
    }
    
    // Fallback to original logic if API fails
    const preferred = urlsToSort.find((u) => !isBlacklisted(u)) || urlsToSort[0];
    debugLog('🔄 Fallback selection:', preferred);
    return String(preferred || ep.url);
}

async function play(ep: Episode) {
    // Navigate to dedicated watch page like Netflix
    const seasonSlug = extractSeasonSlug(selectedSeason.value?.url || '')
    const lang = selectedLang.value
    const epNumber = Number(ep.episode)
    await navigateTo(`/watch/${id.value}/${seasonSlug}/${lang}/${epNumber}`)
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
        hls.attachMedia(el as HTMLVideoElement);
        
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
                v-if="!info.seasons || info.seasons.length === 0 || animeSeasons.length === 0"
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
                    <div class="tabs flex flex-wrap gap-2">
                        <button
                            class="tab"
                            :disabled="!availableLanguages.vostfr || checkingLanguages"
                            :class="{ 
                                active: selectedLang === 'vostfr',
                                'opacity-50': checkingLanguages
                            }"
                            @click="switchLanguage('vostfr')"
                        >
                            <span v-if="checkingLanguages" class="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-1"></span>
                            🇯🇵 VOSTFR
                        </button>
                        <button
                            class="tab"
                            :disabled="!availableLanguages.vf || checkingLanguages"
                            :class="{ 
                                active: selectedLang === 'vf',
                                'opacity-50': checkingLanguages
                            }"
                            @click="switchLanguage('vf')"
                        >
                            <span v-if="checkingLanguages" class="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-1"></span>
                            🇫🇷 VF
                        </button>
                    </div>
                </div>

                <div class="mt-2">
                    <div class="flex flex-wrap gap-2">
                        <button
                            v-for="s in animeSeasons"
                            :key="s.url"
                            class="pill pill-lg"
                            :class="{
                                'selected': selectedSeasonUrl === s.url
                            }"
                            @click="pickSeason(s)"
                        >
                            {{ s.name }}
                        </button>
                    </div>
                </div>

                <div class="section pt-2">
                    <h2>Episodes</h2>
                    <div v-if="debug" class="bg-zinc-800 p-3 rounded mb-4 text-xs">
                        <div><strong>Debug Info:</strong></div>
                        <div>Selected Season: {{ selectedSeason?.name || 'None' }}</div>
                        <div>Selected Lang: {{ selectedLang }}</div>
                        <div>Episodes Count: {{ episodes.length }}</div>
                        <div>Loading: {{ loadingEps }}</div>
                        <div>Available Languages: {{ JSON.stringify(availableLanguages) }}</div>
                    </div>
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
                        class="flex flex-wrap gap-3 mt-4"
                    >
                        <button
                            v-for="e in episodes"
                            :key="e.episode"
                            class="pill pill-lg hover:border-zinc-600 text-left"
                            @click="play(e)"
                            :title="e.title || `Épisode ${e.episode}`"
                        >
                            <div class="flex flex-col items-start">
                                <span class="text-sm font-medium">
                                    {{ e.title || `Épisode ${e.episode}` }}
                                </span>
                                <span v-if="!e.title" class="text-xs opacity-70">
                                    {{ selectedSeason?.name || 'Episode' }}
                                </span>
                            </div>
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
