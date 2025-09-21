<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from "vue";
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
        const u64 = btoa(unescape(encodeURIComponent(target)))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
        let referer: string | undefined;
        try {
            const u = new URL(target);
            referer = u.origin + "/";
        } catch {}
        const route = useRoute();
        const debug = route.query.debug === "1" || route.query.debug === "true";
        
        const { data, error } = await useFetch<any>("/api/player/resolve", {
            params: {
                u64,
                referer,
                ...(debug ? { debug: "1" } : {}),
            },
            timeout: 30000, // 30 second timeout
        });
        
        if (error.value) {
            resolveError.value = `Network error: ${error.value.message || 'Failed to connect'}`;
            return;
        }
        
        const ok = data.value?.ok;
        resolveError.value = ok
            ? ""
            : data.value?.message || "Failed to resolve media URL";
        const urls = data.value?.urls || [];
        resolvedList.value = urls;
        
        if (ok && urls.length > 0) {
            const hlsFirst = urls.find((u: any) => u.type === "hls") || urls[0];
            playUrl.value =
                hlsFirst.proxiedUrl ||
                `/api/proxy?url=${encodeURIComponent(hlsFirst.url)}&rewrite=1`;
        } else {
            // No fallback iframe - just show error
            playUrl.value = "";
            resolveError.value = resolveError.value || "No direct video streams found";
        }
    } catch (error: any) {
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

watch([showPlayer, playUrl], async () => {
    if (!showPlayer.value) {
        destroyHls();
        return;
    }
    const el = videoRef.value;
    if (!el || !playUrl.value) return;

    // If the URL is M3U8 and HLS.js is supported, use it; otherwise let the browser handle it
    if (isM3U8(playUrl.value) && Hls.isSupported()) {
        destroyHls();
        hls = new Hls({ enableWorker: true });
        hls.loadSource(playUrl.value);
        hls.attachMedia(el);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            el.play().catch(() => {
                /* ignore */
            });
        });
    } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari and some browsers support HLS natively
        el.src = playUrl.value;
        el.play().catch(() => {
            /* ignore */
        });
    } else {
        // Non-HLS fallback
        el.src = playUrl.value;
        el.play().catch(() => {
            /* ignore */
        });
    }
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
        resolveError.value = `Erreur de lecture vidéo: ${getVideoErrorMessage(error.code)}`;
    }
};

const getVideoErrorMessage = (errorCode: number): string => {
    switch (errorCode) {
        case 1:
            return "Lecture interrompue par l'utilisateur";
        case 2:
            return "Erreur réseau lors du téléchargement";
        case 3:
            return "Erreur de décodage du média";
        case 4:
            return "Format vidéo non supporté";
        default:
            return "Erreur inconnue";
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
                    <div v-if="resolving" class="muted p-2">
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
