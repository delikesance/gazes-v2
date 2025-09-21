<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from "vue";
import CardPoster from "~/components/CardPoster.vue";
import { useSearch } from "~/composables/useSearch";

// Set page metadata
useSeoMeta({
    title: "Catalogue - Gazes",
    description: "Parcourez notre vaste collection d'animations",
});

type Item = { id: string; title: string; image: string };

const route = useRoute();
const router = useRouter();

// Filter state
const selectedGenres = ref<string[]>(
    Array.isArray(route.query.genre)
        ? (route.query.genre as string[])
        : route.query.genre
          ? [String(route.query.genre)]
          : [],
);

// Pagination state
const items = ref<Item[]>([]);
const loading = ref(false);
const initialLoading = ref(true);
const page = ref(1);
const hasMore = ref(true);
const error = ref<string | null>(null);
const sentinel = ref<HTMLDivElement | null>(null);
const retryCount = ref(0);

// Search with debouncing
const searchFn = async (term: string): Promise<Item[]> => {
    const response = await $fetch<{ items: Item[] }>("/api/catalogue", {
        params: {
            search: term,
            genre: selectedGenres.value,
            page: 1,
        },
    });
    return response?.items || [];
};

const {
    query: search,
    search: searchState,
    executeSearch,
    clearSearch,
} = useSearch(searchFn, {
    debounceMs: 300,
    minLength: 2,
});

// Initialize search from URL
const initialSearch = String(route.query.search || "");
if (initialSearch) {
    search.value = initialSearch;
}

const allGenres = [
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

// Computed
const isSearching = computed(
    () => !!search.value && search.value.trim().length >= 2,
);
const hasFilters = computed(() => selectedGenres.value.length > 0);
const totalFilters = computed(() => selectedGenres.value.length);
const isEmpty = computed(
    () =>
        !loading.value &&
        !initialLoading.value &&
        items.value.length === 0 &&
        !isSearching.value,
);
const searchEmpty = computed(
    () => searchState.isEmpty.value && searchState.hasSearched.value,
);

// URL synchronization
const updateQuery = () => {
    const query: Record<string, any> = {};
    if (search.value) query.search = search.value;
    if (selectedGenres.value.length) query.genre = selectedGenres.value;

    router.replace({ path: "/catalogue", query });
};

watch(
    [search, selectedGenres],
    () => {
        updateQuery();
    },
    { deep: true },
);

// Scroll-based infinite scroll (more reliable than intersection observer)
const handleScroll = () => {
    // Don't trigger if already loading, no more items, or searching
    if (loading.value || !hasMore.value || isSearching.value) return;
    
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    // Trigger when user is 5% from the bottom
    const threshold = documentHeight * 0.05;
    const distanceFromBottom = documentHeight - (scrollTop + windowHeight);
    
    if (distanceFromBottom <= threshold) {
        page.value += 1;
        fetchPage(page.value);
    }
};

// Intersection observer for infinite scroll (keeping as fallback but using scroll instead)
let observer: IntersectionObserver | null = null;

const setupIntersectionObserver = () => {
    // Use scroll-based detection instead of intersection observer
    window.addEventListener('scroll', handleScroll, { passive: true });
};

const cleanupObserver = () => {
    window.removeEventListener('scroll', handleScroll);
    if (observer && sentinel.value) {
        observer.unobserve(sentinel.value);
        observer.disconnect();
        observer = null;
    }
};

// Data fetching
const fetchPage = async (pageNum: number) => {
    if (loading.value || !hasMore.value || isSearching.value) return;

    loading.value = true;
    error.value = null;

    try {
        const response = await $fetch<{
            items: Item[];
            status?: number;
        }>("/api/catalogue", {
            params: {
                genre: selectedGenres.value,
                page: String(pageNum),
            },
        });

        // Handle response

        const status = response?.status ?? 200;
        if (status !== 200) {
            hasMore.value = false;
            return;
        }

        const newItems = response?.items || [];

        if (pageNum === 1) {
            items.value = newItems;
        } else {
            // Dedupe by id
            const seen = new Set(items.value.map((i) => i.id));
            const uniqueItems = newItems.filter(
                (item: Item) => !seen.has(item.id),
            );
            items.value.push(...uniqueItems);
        }

        hasMore.value = newItems.length > 0;
        retryCount.value = 0; // Reset retry count on success
    } catch (err) {
        console.error("Fetch error:", err);
        error.value =
            err instanceof Error ? err.message : "Failed to load content";
        hasMore.value = pageNum === 1 ? true : hasMore.value; // Allow retry on first page
    } finally {
        loading.value = false;
        initialLoading.value = false;
    }
};

const resetAndFetch = () => {
    // Clean up existing scroll listener before reset
    cleanupObserver();
    
    items.value = [];
    page.value = 1;
    hasMore.value = true;
    error.value = null;
    retryCount.value = 0;
    initialLoading.value = true;

    if (!isSearching.value) {
        fetchPage(1);
    }
};

// Retry mechanism
const retryFetch = () => {
    retryCount.value += 1;
    if (items.value.length === 0) {
        fetchPage(1);
    } else {
        fetchPage(page.value);
    }
};

// Genre filter handlers
const toggleGenre = (genre: string) => {
    const index = selectedGenres.value.indexOf(genre);
    if (index > -1) {
        selectedGenres.value.splice(index, 1);
    } else {
        selectedGenres.value.push(genre);
    }
};

const clearFilters = () => {
    selectedGenres.value = [];
};

const clearSearchOnly = () => {
    search.value = "";
    clearSearch();
};

const clearAll = () => {
    search.value = "";
    selectedGenres.value = [];
    clearSearch();
    router.replace({ path: "/catalogue" });
};

// Lifecycle
watch([selectedGenres], () => {
    resetAndFetch();
    // Re-setup scroll listener after genre change
    nextTick(() => {
        setupIntersectionObserver(); // This now sets up scroll listener
    });
}, { deep: true });

onMounted(() => {
    resetAndFetch();
    // Set up scroll listener after the component is fully mounted
    nextTick(() => {
        setupIntersectionObserver(); // This now sets up scroll listener
    });
});

onBeforeUnmount(() => {
    cleanupObserver();
});
</script>

<template>
    <div>
        <section class="section px-5 md:px-20">
            <!-- Header -->
            <div
                class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6"
            >
                <div>
                    <h1 class="mb-2">Catalogue</h1>
                    <p class="muted">
                        {{
                            isSearching
                                ? `Résultats pour "${search}"`
                                : "Découvrez notre vaste collection"
                        }}
                    </p>
                </div>

                <!-- Clear filters -->
                <div
                    v-if="hasFilters || search"
                    class="flex items-center gap-3"
                >
                    <span class="text-sm muted"
                        >{{ totalFilters }} filtre(s) actif(s)</span
                    >
                    <button @click="clearAll" class="btn ghost text-sm">
                        Tout effacer
                    </button>
                </div>
            </div>

            <!-- Search and Filters -->
            <div class="space-y-4 mb-6">
                <!-- Search Bar -->
                <div class="relative">
                    <input
                        v-model="search"
                        type="search"
                        class="input w-full sm:w-[420px] pl-10"
                        placeholder="Rechercher un anime, film..."
                    />
                    <Icon
                        name="heroicons:magnifying-glass"
                        class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500"
                    />
                    <button
                        v-if="search"
                        @click="clearSearch"
                        class="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-zinc-800 rounded"
                    >
                        <Icon name="heroicons:x-mark" class="w-4 h-4" />
                    </button>
                </div>

                <!-- Genre Pills -->
                <div class="flex flex-wrap items-center gap-3">
                    <span class="text-sm font-medium text-zinc-300"
                        >Genres:</span
                    >
                    <div class="pills">
                        <label
                            v-for="genre in allGenres"
                            :key="genre"
                            class="pill cursor-pointer select-none transition-all duration-200"
                            :class="{
                                'border-violet-600 bg-violet-600/20 text-violet-300':
                                    selectedGenres.includes(genre),
                                'hover:border-zinc-600':
                                    !selectedGenres.includes(genre),
                            }"
                        >
                            <input
                                type="checkbox"
                                :value="genre"
                                v-model="selectedGenres"
                                class="hidden"
                            />
                            <span>{{ genre }}</span>
                        </label>
                    </div>
                    <button
                        v-if="hasFilters"
                        @click="clearFilters"
                        class="text-xs text-zinc-500 hover:text-zinc-300 underline"
                    >
                        Effacer les genres
                    </button>
                </div>
            </div>

            <div class="divider" />

            <!-- Content Area -->
            <div class="min-h-[500px]">
                <!-- Search Results -->
                <template v-if="isSearching">
                    <!-- Search Loading -->
                    <div v-if="searchState.loading.value" class="space-y-4">
                        <div class="flex items-center gap-3 mb-4">
                            <div
                                class="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"
                            ></div>
                            <span class="muted">Recherche en cours...</span>
                        </div>
                        <div
                            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
                        >
                            <div
                                v-for="i in 12"
                                :key="i"
                                class="aspect-[9/12] bg-zinc-900/40 border border-zinc-800 rounded-xl animate-pulse"
                            />
                        </div>
                    </div>

                    <!-- Search Error -->
                    <div
                        v-else-if="searchState.error.value"
                        class="text-center py-16"
                    >
                        <Icon
                            name="heroicons:exclamation-triangle"
                            class="w-16 h-16 text-amber-500 mx-auto mb-4"
                        />
                        <h3 class="text-xl font-semibold mb-2">
                            Erreur de recherche
                        </h3>
                        <p class="muted mb-4">{{ searchState.error.value }}</p>
                        <button
                            @click="executeSearch(search)"
                            class="btn primary"
                        >
                            Réessayer
                        </button>
                    </div>

                    <!-- Search Empty -->
                    <div v-else-if="searchEmpty" class="text-center py-16">
                        <Icon
                            name="heroicons:magnifying-glass"
                            class="w-16 h-16 text-zinc-500 mx-auto mb-4"
                        />
                        <h3 class="text-xl font-semibold mb-2">
                            Aucun résultat
                        </h3>
                        <p class="muted mb-4">
                            Aucun contenu trouvé pour "{{ search }}"
                        </p>
                        <div class="flex justify-center gap-3">
                            <button
                                @click="clearSearchOnly"
                                class="btn secondary"
                            >
                                Effacer la recherche
                            </button>
                        </div>
                    </div>

                    <!-- Search Results -->
                    <div
                        v-else
                        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
                    >
                        <CardPoster
                            v-for="item in searchState.results.value"
                            :key="item.id"
                            :to="`/anime/${item.id}`"
                            :src="item.image"
                            :title="item.title"
                            size="sm"
                        />
                    </div>
                </template>

                <!-- Browse Results -->
                <template v-else>
                    <!-- Initial Loading -->
                    <div v-if="initialLoading" class="space-y-4">
                        <div class="flex items-center gap-3 mb-4">
                            <div
                                class="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"
                            ></div>
                            <span class="muted"
                                >Chargement du catalogue...</span
                            >
                        </div>
                        <div
                            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
                        >
                            <div
                                v-for="i in 18"
                                :key="i"
                                class="aspect-[9/12] bg-zinc-900/40 border border-zinc-800 rounded-xl animate-pulse"
                            />
                        </div>
                    </div>

                    <!-- Error State -->
                    <div
                        v-else-if="error && items.length === 0"
                        class="text-center py-16"
                    >
                        <Icon
                            name="heroicons:exclamation-triangle"
                            class="w-16 h-16 text-amber-500 mx-auto mb-4"
                        />
                        <h3 class="text-xl font-semibold mb-2">
                            Erreur de chargement
                        </h3>
                        <p class="muted mb-4">{{ error }}</p>
                        <div class="flex justify-center gap-3">
                            <button @click="retryFetch" class="btn primary">
                                Réessayer
                                <span v-if="retryCount > 0" class="ml-1"
                                    >({{ retryCount }})</span
                                >
                            </button>
                            <button @click="clearAll" class="btn secondary">
                                Réinitialiser les filtres
                            </button>
                        </div>
                    </div>

                    <!-- Empty State -->
                    <div v-else-if="isEmpty" class="text-center py-16">
                        <Icon
                            name="heroicons:film"
                            class="w-16 h-16 text-zinc-500 mx-auto mb-4"
                        />
                        <h3 class="text-xl font-semibold mb-2">
                            Aucun contenu
                        </h3>
                        <p class="muted mb-4">
                            {{
                                hasFilters
                                    ? "Aucun contenu ne correspond à vos filtres"
                                    : "Aucun contenu disponible pour le moment"
                            }}
                        </p>
                        <button
                            v-if="hasFilters"
                            @click="clearFilters"
                            class="btn primary"
                        >
                            Effacer les filtres
                        </button>
                    </div>

                    <!-- Content Grid -->
                    <template v-else>
                        <div
                            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
                        >
                            <CardPoster
                                v-for="item in items"
                                :key="item.id"
                                :to="`/anime/${item.id}`"
                                :src="item.image"
                                :title="item.title"
                                size="sm"
                            />
                        </div>

                        <!-- Load More Trigger -->
                        <div ref="sentinel" class="h-px mt-8"></div>

                        <!-- Loading More -->
                        <div
                            v-if="loading && !initialLoading"
                            class="text-center py-8"
                        >
                            <div class="flex items-center justify-center gap-3">
                                <div
                                    class="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"
                                ></div>
                                <span class="muted"
                                    >Chargement de plus de contenus...</span
                                >
                            </div>
                        </div>

                        <!-- Load Error -->
                        <div
                            v-if="error && items.length > 0"
                            class="text-center py-8"
                        >
                            <p class="muted mb-3">{{ error }}</p>
                            <button @click="retryFetch" class="btn secondary">
                                Réessayer
                            </button>
                        </div>

                        <!-- End of Results -->
                        <div
                            v-if="!hasMore && items.length > 0 && !loading"
                            class="text-center py-8"
                        >
                            <p class="muted">
                                Vous avez atteint la fin du catalogue
                            </p>
                        </div>
                    </template>
                </template>
            </div>
        </section>
    </div>
</template>

<style scoped>
/* Smooth filter transitions */
.pill {
    transition: all 0.2s ease;
}

/* Loading animations */
@keyframes pulse {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* Focus styles for accessibility */
.pill:focus-within {
    outline: 2px solid rgb(139 92 246 / 0.5);
    outline-offset: 2px;
}
</style>
