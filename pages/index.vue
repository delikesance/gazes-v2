<script setup lang="ts">
import { ref, watch, computed, onMounted } from "vue";
import { useRoute, useRouter } from "nuxt/app";
import CarouselRow from "~/components/CarouselRow.vue";
import HeroBanner from "~/components/HeroBanner.vue";
import ContinueWatchingRow from "~/components/ContinueWatchingRow.vue";
import { useSearch } from "~/composables/useSearch";

// Set page metadata
useSeoMeta({
    title: "Accueil - Gazes",
    description: "Découvrez le meilleur de l'animation japonaise et mondiale",
});

type Item = { id: string; title: string; image: string };
type AnimeInfo = {
    synopsis: string;
    banner?: string;
    altTitle?: string;
    genres: string[];
};

const route = useRoute();
const router = useRouter();

// Hero section state
const hero = ref<Item | null>(null);
const heroDetails = ref<AnimeInfo | null>(null);
const loadingHero = ref(false);

// Curated genres for homepage rows
const genres = [
    "Action",
    "Aventure",
    "Comédie",
    "Drame",
    "Fantastique",
    "Horreur",
    "Romance",
    "Science-Fiction",
    "Sport",
];

// Search functionality with debouncing
const searchFn = async (term: string): Promise<Item[]> => {
    const response = await $fetch<{ items: Item[] }>("/api/catalogue", {
        params: { search: term },
    });
    return response?.items || [];
};

const { query, search, executeSearch, clearSearch } = useSearch(searchFn, {
    debounceMs: 300,
    minLength: 2,
});

// Initialize search query from URL
const initialQuery = String(route.query.q || "");
if (initialQuery) {
    query.value = initialQuery;
}

// Watch for URL query changes
watch(
    () => route.query.q,
    (newQuery) => {
        const queryString = String(newQuery || "");
        if (queryString !== query.value) {
            query.value = queryString;
        }
    },
);

// Update URL when search query changes
watch(query, (newQuery) => {
    const currentQuery = String(route.query.q || "");
    if (newQuery !== currentQuery) {
        router.replace({
            query: newQuery ? { q: newQuery } : {},
        });
    }
});

// Fetch hero content when not searching
const fetchHeroContent = async () => {
    if (hero.value) return;

    loadingHero.value = true;
    try {
        // Use general catalogue without genre filter since genre filtering doesn't work
        const response = await $fetch<{ items: Item[] }>("/api/catalogue", {
            params: {
                limit: 1,
            },
        });

        const heroItem = response?.items?.[0];
        if (heroItem) {
            hero.value = heroItem;
            await fetchHeroDetails(heroItem.id);
        } else {
            // Set a minimal hero to stop loading state
            hero.value = { id: "error", title: "Gazes", image: "" };
            heroDetails.value = {
                synopsis: "Découvrez le meilleur de l'animation japonaise et mondiale",
                genres: ["Animation"]
            };
        }
    } catch (error) {
        console.error("Failed to fetch hero content:", error);
        // Set a minimal hero to stop loading state
        hero.value = { id: "error", title: "Gazes", image: "" };
        heroDetails.value = {
            synopsis: "Découvrez le meilleur de l'animation japonaise et mondiale",
            genres: ["Animation"]
        };
    } finally {
        loadingHero.value = false;
    }
};

// Fetch detailed info for hero
const fetchHeroDetails = async (id: string) => {
    try {
        const response = await $fetch<AnimeInfo>(`/api/anime/${id}`);
        heroDetails.value = response;
    } catch (error) {
        console.error("Failed to fetch hero details:", error);
        heroDetails.value = null;
    }
};

// Computed properties
const isSearching = computed(
    () => !!query.value && query.value.trim().length >= 2,
);
const heroSubtitle = computed(() => {
    const genres = heroDetails.value?.genres?.filter(Boolean) || [];
    return genres.slice(0, 3).join(" • ");
});

const searchResultsTitle = computed(() => {
    if (search.loading.value) return "Recherche en cours...";
    if (search.error.value) return "Erreur de recherche";
    if (search.isEmpty.value) return "Aucun résultat";
    return `Résultats pour "${query.value}"`;
});

// Initialize hero content on mount if not searching
onMounted(() => {
    if (!isSearching.value) {
        fetchHeroContent();
    }
});

// Clear search handler
const handleClearSearch = () => {
    clearSearch();
    router.replace({ query: {} });
};

// Retry search handler
const handleRetrySearch = () => {
    if (query.value) {
        executeSearch(query.value);
    }
};
</script>

<template>
    <div>
        <!-- Search Results View -->
        <section v-if="isSearching" class="section px-5 md:px-20">
            <!-- Search Header -->
            <div class="flex items-center justify-between mb-6">
                <div>
                    <h1 class="text-2xl font-bold mb-2">
                        {{ searchResultsTitle }}
                    </h1>
                    <div class="flex items-center gap-4">
                        <button
                            @click="handleClearSearch"
                            class="btn ghost text-sm"
                        >
                            ← Retour à l'accueil
                        </button>
                        <div
                            v-if="search.loading.value"
                            class="flex items-center gap-2 text-sm text-zinc-400"
                        >
                            <div
                                class="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"
                            ></div>
                            Recherche...
                        </div>
                    </div>
                </div>
            </div>

            <!-- Search Results Content -->
            <div class="min-h-[400px]">
                <!-- Loading State -->
                <div
                    v-if="search.loading.value"
                    class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
                >
                     <div
                         v-for="i in 12"
                         :key="i"
                         class="w-40 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50 animate-pulse"
                     >
                         <div class="aspect-[3/4] bg-zinc-800" />
                         <div class="p-3">
                             <div class="h-4 bg-zinc-800 rounded mb-2" />
                             <div class="h-4 bg-zinc-800 rounded w-3/4" />
                         </div>
                     </div>
                </div>

                <!-- Error State -->
                <div v-else-if="search.error.value" class="text-center py-16">
                    <div class="mb-4">
                        <Icon
                            name="heroicons:exclamation-triangle"
                            class="w-16 h-16 text-amber-500 mx-auto mb-4"
                        />
                        <h3 class="text-xl font-semibold mb-2">
                            Erreur de recherche
                        </h3>
                        <p class="text-zinc-400 mb-4">
                            {{ search.error.value }}
                        </p>
                        <button @click="handleRetrySearch" class="btn primary">
                            Réessayer
                        </button>
                    </div>
                </div>

                <!-- Empty Results -->
                <div v-else-if="search.isEmpty.value" class="text-center py-16">
                    <div class="mb-4">
                        <Icon
                            name="heroicons:magnifying-glass"
                            class="w-16 h-16 text-zinc-500 mx-auto mb-4"
                        />
                        <h3 class="text-xl font-semibold mb-2">
                            Aucun résultat
                        </h3>
                        <p class="text-zinc-400 mb-4">
                            Aucun contenu trouvé pour "{{ query }}"
                        </p>
                        <div class="flex justify-center gap-3">
                            <button
                                @click="handleClearSearch"
                                class="btn secondary"
                            >
                                Effacer la recherche
                            </button>
                            <NuxtLink to="/catalogue" class="btn primary">
                                Parcourir le catalogue
                            </NuxtLink>
                        </div>
                    </div>
                </div>

                <!-- Search Results -->
                <div
                    v-else
                    class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
                >
                    <div v-for="item in search.results.value" :key="item.id" class="relative shrink-0">
                      <NuxtLink
                        :to="`/anime/${item.id}`"
                        class="group block w-[200px] h-[320px] flex-none shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                        :aria-label="item.title"
                      >
                        <article class="relative w-full h-full rounded-2xl overflow-hidden shadow-lg transition-transform duration-200 will-change-transform hover:-translate-y-1 hover:shadow-2xl motion-reduce:transition-none">

                          <!-- Image area -->
                          <div class="relative h-[240px] bg-black">
                            <img :src="item.image" :alt="item.title" class="h-full w-full object-cover" loading="lazy" decoding="async" fetchpriority="low" />

                            <!-- subtle overlay for text legibility -->
                            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none"></div>

                            <!-- play affordance (decorative) -->
                            <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 motion-reduce:transition-none" aria-hidden="true">
                              <div class="rounded-full bg-white/6 p-3 transition-transform duration-200 group-hover:scale-105">
                                <Icon name="heroicons:play" class="w-6 h-6 fill-white" />
                              </div>
                            </div>

                          </div>

                          <!-- Title + subtitle area -->
                          <div class="p-3 bg-black">
                            <h3 class="m-0 text-sm font-semibold text-white line-clamp-2">{{ item.title }}</h3>
                          </div>
                        </article>
                      </NuxtLink>
                    </div>
                </div>
            </div>
        </section>

        <!-- Homepage View -->
        <section v-else>
            <!-- Hero Banner -->
            <div class="relative">
                <!-- Loading Hero -->
                <div
                    v-if="loadingHero || !hero || !heroDetails"
                    class="h-[60vh] md:h-[80vh] lg:h-[90vh] bg-gradient-to-br from-violet-900/20 via-zinc-900 to-zinc-950 flex items-center justify-center"
                >
                    <div class="text-center">
                        <div
                            class="w-16 h-16 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"
                        ></div>
                        <h2 class="text-xl font-semibold mb-2">Chargement...</h2>
                        <p class="text-zinc-400">Préparation du contenu</p>
                    </div>
                </div>

                <!-- Actual Hero -->
                <HeroBanner
                    v-else
                    :title="hero.title"
                    :subtitle="heroSubtitle"
                    :image="heroDetails.banner || hero.image"
                    :primary-to="`/anime/${hero.id}`"
                    :secondary-to="`/anime/${hero.id}`"
                    :synopsis="heroDetails.synopsis"
                />
            </div>

            <!-- Continue Watching Section -->
            <Suspense>
                <ContinueWatchingRow title="Continuer à regarder" :max-items="20" />
                <template #fallback>
                    <section class="section">
                        <div class="flex justify-between items-center mb-4 px-20">
                            <h3 class="row-title">Continuer à regarder</h3>
                        </div>
                        <div class="relative">
                            <div class="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pl-20 pr-20 scroll-pl-20 scroll-pr-20">
                                <div
                                    v-for="i in 8"
                                    :key="i"
                                    class="snap-start shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse aspect-[9/12] w-[170px]"
                                />
                            </div>
                        </div>
                    </section>
                </template>
            </Suspense>

            <!-- Genre Carousels -->
            <div class="flex flex-col gap-10 mt-10">
                 <div v-for="genre in genres" :key="genre">
                     <Suspense>
                         <CarouselRow
                             :title="genre"
                             :genre="genre"
                             card-size="sm"
                         />
                         <template #fallback>
                             <section class="py-8">
                                 <div class="mb-6 flex items-center justify-between px-4 md:px-20">
                                     <h3 class="text-xl font-semibold text-white">{{ genre }}</h3>
                                 </div>
                                 <div class="relative">
                                     <div class="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-zinc-950 to-transparent" />
                                     <div class="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-zinc-950 to-transparent" />
                                     <div class="flex gap-4 overflow-x-auto scroll-smooth px-4 md:px-20">
                                         <div v-for="i in 8" :key="i" class="flex-shrink-0 w-40">
                                             <div class="aspect-[3/4] rounded-lg bg-zinc-800 animate-pulse" />
                                             <div class="mt-3 p-3">
                                                 <div class="h-4 bg-zinc-800 rounded mb-2" />
                                                 <div class="h-4 bg-zinc-800 rounded w-3/4" />
                                             </div>
                                         </div>
                                     </div>
                                 </div>
                             </section>
                         </template>
                     </Suspense>
                 </div>
            </div>

            <!-- Quick Actions -->
            <section class="section px-5 md:px-20 mt-16">
                <div class="text-center mb-8">
                    <h2>Découvrez plus de contenus</h2>
                    <p class="muted">Explorez nos différentes catégories</p>
                </div>

                 <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <NuxtLink
                        to="/series"
                        class="card p-6 text-center group hover:border-zinc-600 transition-colors"
                    >
                        <div
                            class="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-700/20 flex items-center justify-center group-hover:bg-violet-700/30 transition-colors"
                        >
                            <Icon
                                name="heroicons:tv"
                                class="w-8 h-8 text-violet-400"
                            />
                        </div>
                        <h3 class="mb-2">Séries</h3>
                        <p class="muted text-sm">
                            Plongez dans des histoires captivantes
                        </p>
                    </NuxtLink>

                    <NuxtLink
                        to="/movies"
                        class="card p-6 text-center group hover:border-zinc-600 transition-colors"
                    >
                        <div
                            class="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-700/20 flex items-center justify-center group-hover:bg-emerald-700/30 transition-colors"
                        >
                            <Icon
                                name="heroicons:film"
                                class="w-8 h-8 text-emerald-400"
                            />
                        </div>
                        <h3 class="mb-2">Films</h3>
                        <p class="muted text-sm">
                            Des chefs-d'œuvre cinématographiques
                        </p>
                    </NuxtLink>


                </div>
            </section>
        </section>
    </div>
</template>

<style scoped>
/* Custom loading spinner */
@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* Smooth transitions */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
.object-cover { image-rendering: -webkit-optimize-contrast; }
</style>
