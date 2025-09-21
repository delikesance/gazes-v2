<template>
    <section class="section">
        <div class="flex justify-between items-center mb-4 px-20">
            <h3 class="row-title">{{ title }}</h3>

            <div class="flex items-center gap-5">
                <button
                    type="button"
                    @click="scroll(-1)"
                    :disabled="!canScrollLeft"
                    class="carousel-nav-btn"
                    :class="{ 'opacity-50 cursor-not-allowed': !canScrollLeft }"
                    aria-label="Previous items"
                >
                    <ClientOnly>
                        <Icon name="grommet-icons:form-previous" />
                    </ClientOnly>
                </button>

                <button
                    type="button"
                    @click="scroll(1)"
                    :disabled="!canScrollRight"
                    class="carousel-nav-btn"
                    :class="{
                        'opacity-50 cursor-not-allowed': !canScrollRight,
                    }"
                    aria-label="Next items"
                >
                    <ClientOnly>
                        <Icon name="grommet-icons:form-next" />
                    </ClientOnly>
                </button>
            </div>
        </div>

        <div class="relative">
            <!-- Edge fades -->
            <div
                aria-hidden
                class="pointer-events-none absolute inset-y-0 left-0 w-20 z-10 transition-opacity duration-300"
                :class="
                    canScrollLeft
                        ? 'opacity-100 bg-gradient-to-r from-zinc-950 to-transparent'
                        : 'opacity-0'
                "
            />
            <div
                aria-hidden
                class="pointer-events-none absolute inset-y-0 right-0 w-20 z-10 transition-opacity duration-300"
                :class="
                    canScrollRight
                        ? 'opacity-100 bg-gradient-to-l from-zinc-950 to-transparent'
                        : 'opacity-0'
                "
            />

            <div
                ref="trackRef"
                class="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pl-20 pr-20 scroll-pl-20 scroll-pr-20 scrollbar-hide"
                @scroll="handleScroll"
                @touchstart="handleTouchStart"
                @touchmove="handleTouchMove"
                @touchend="handleTouchEnd"
                @mousedown="handleMouseDown"
                @mousemove="handleMouseMove"
                @mouseup="handleMouseEnd"
                @mouseleave="handleMouseEnd"
                :style="{ cursor: isDragging ? 'grabbing' : 'grab' }"
            >
                <!-- Loading skeleton -->
                <template v-if="loading && localItems.length === 0">
                    <div
                        v-for="i in skeletonCount"
                        :key="`skeleton-${i}`"
                        :class="[
                            'snap-start shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse aspect-[9/12]',
                            cardSizeConfig.width,
                        ]"
                    />
                </template>

                <!-- Actual content -->
                <template v-else>
                    <CardPoster
                        v-for="item in localItems"
                        :key="item.id"
                        :to="`/anime/${item.id}`"
                        :src="item.image"
                        :title="item.title"
                        :size="cardSize"
                        :class="['snap-start shrink-0', cardSizeConfig.width]"
                        @click="handleItemClick"
                    />
                </template>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useDesignSystem } from "~/composables/useDesignSystem";

type Item = { id: string; title: string; image: string };
type CardSize = "sm" | "md" | "lg";

const props = defineProps<{
    title: string;
    cardSize?: CardSize;
    genre?: string | string[];
    items?: Item[];
    skeletonCount?: number;
}>();

const { getCardSize, getCarouselScrollStep, CAROUSEL_CONFIG } =
    useDesignSystem();

// Refs and reactive state
const trackRef = ref<HTMLDivElement | null>(null);
const localItems = ref<Item[]>(props.items || []);
const loading = ref(false);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);
const isDragging = ref(false);

// Touch/Mouse drag support
const dragState = ref({
    startX: 0,
    startScrollLeft: 0,
    isPressed: false,
    hasMoved: false,
});

// Computed properties
const cardSizeConfig = computed(() => getCardSize(props.cardSize));
const scrollStep = computed(() => getCarouselScrollStep(props.cardSize));
const skeletonCount = computed(() => props.skeletonCount || 8);

// Scroll functionality
const scroll = (direction: 1 | -1) => {
    const track = trackRef.value;
    if (!track) return;

    const scrollAmount = scrollStep.value * direction;
    track.scrollBy({
        left: scrollAmount,
        behavior: "smooth",
    });
};

// Check scroll boundaries
const updateScrollState = () => {
    const track = trackRef.value;
    if (!track) return;

    canScrollLeft.value = track.scrollLeft > 0;
    canScrollRight.value =
        track.scrollLeft < track.scrollWidth - track.clientWidth - 1;
};

const handleScroll = throttle(() => {
    updateScrollState();
}, 16); // ~60fps

// Touch events
const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    startDrag(e.touches[0]?.clientX || 0);
};

const handleTouchMove = (e: TouchEvent) => {
    if (!dragState.value.isPressed || e.touches.length !== 1) return;
    e.preventDefault();
    moveDrag(e.touches[0]?.clientX || 0);
};

const handleTouchEnd = () => {
    endDrag();
};

// Mouse events
const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    startDrag(e.clientX);
};

const handleMouseMove = (e: MouseEvent) => {
    if (!dragState.value.isPressed) return;
    e.preventDefault();
    moveDrag(e.clientX);
};

const handleMouseEnd = () => {
    endDrag();
};

// Drag logic
const startDrag = (clientX: number) => {
    const track = trackRef.value;
    if (!track) return;

    dragState.value = {
        startX: clientX,
        startScrollLeft: track.scrollLeft,
        isPressed: true,
        hasMoved: false,
    };
    isDragging.value = true;
};

const moveDrag = (clientX: number) => {
    const track = trackRef.value;
    if (!track || !dragState.value.isPressed) return;

    const deltaX = clientX - dragState.value.startX;
    const newScrollLeft = dragState.value.startScrollLeft - deltaX;

    track.scrollLeft = newScrollLeft;
    dragState.value.hasMoved = Math.abs(deltaX) > 5;
};

const endDrag = () => {
    dragState.value.isPressed = false;
    isDragging.value = false;

    // Small delay to prevent click events if dragged
    if (dragState.value.hasMoved) {
        setTimeout(() => {
            dragState.value.hasMoved = false;
        }, 100);
    }
};

const handleItemClick = (e: Event) => {
    // Prevent navigation if we just finished dragging
    if (dragState.value.hasMoved) {
        e.preventDefault();
        e.stopPropagation();
    }
};

// Utility functions
function throttle<T extends (...args: any[]) => void>(
    func: T,
    delay: number,
): T {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastExecTime = 0;

    return ((...args: Parameters<T>) => {
        const currentTime = Date.now();

        if (currentTime - lastExecTime > delay) {
            func(...args);
            lastExecTime = currentTime;
        } else {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(
                () => {
                    func(...args);
                    lastExecTime = Date.now();
                },
                delay - (currentTime - lastExecTime),
            );
        }
    }) as T;
}

// Data fetching
const hasGenre = computed(() =>
    Array.isArray(props.genre) ? props.genre.length > 0 : !!props.genre,
);

// SSR-friendly fetch
if (hasGenre.value && !props.items) {
    loading.value = true;
    const key = `carousel:${Array.isArray(props.genre) ? props.genre.join(",") : String(props.genre)}`;

    try {
        const { data } = await useFetch<{ items: Item[] }>(`/api/catalogue`, {
            params: { genre: props.genre as any },
            key,
        });

        localItems.value = data.value?.items || [];
    } catch (error) {
        console.error("Failed to fetch carousel data:", error);
        localItems.value = [];
    } finally {
        loading.value = false;
    }
}

// Lifecycle
onMounted(async () => {
    await nextTick();
    updateScrollState();

    // Resize observer for responsive updates
    if (trackRef.value && typeof ResizeObserver !== "undefined") {
        const resizeObserver = new ResizeObserver(() => {
            updateScrollState();
        });
        resizeObserver.observe(trackRef.value);

        onBeforeUnmount(() => {
            resizeObserver.disconnect();
        });
    }
});

// Keyboard navigation
onMounted(() => {
    const handleKeydown = (e: KeyboardEvent) => {
        if (e.target !== trackRef.value) return;

        switch (e.key) {
            case "ArrowLeft":
                e.preventDefault();
                scroll(-1);
                break;
            case "ArrowRight":
                e.preventDefault();
                scroll(1);
                break;
        }
    };

    document.addEventListener("keydown", handleKeydown);

    onBeforeUnmount(() => {
        document.removeEventListener("keydown", handleKeydown);
    });
});
</script>

<style scoped>
.carousel-nav-btn {
    transition: all 0.2s ease;
    border-radius: 9999px;
    padding: 0.5rem;
}

.carousel-nav-btn:hover {
    transform: scale(1.1);
}

.carousel-nav-btn:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgb(139 92 246 / 0.5);
}

.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
    display: none;
}

/* Prevent text selection during drag */
.dragging {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
}
</style>
