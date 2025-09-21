<template>
    <NuxtLink
        class="poster group relative block overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/30 aspect-[9/12] transition-all duration-200 hover:border-zinc-600 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        :to="to"
        :style="{ width: cardConfig.width }"
        :aria-label="`Watch ${title}`"
    >
        <NuxtImg
            :src="src"
            :alt="title"
            :sizes="cardConfig.sizes"
            class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
        />

        <!-- Gradient overlay -->
        <div
            class="absolute inset-0 z-10 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent"
        />

        <!-- Content overlay -->
        <div class="absolute inset-x-0 bottom-0 z-20 p-3 text-white">
            <h3
                class="font-medium leading-tight line-clamp-2"
                :class="titleClass"
                :title="title"
            >
                {{ title }}
            </h3>
        </div>

        <!-- Hover play indicator -->
        <div
            class="absolute inset-0 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
            <div class="bg-black/70 rounded-full p-3 backdrop-blur-sm">
                <ClientOnly>
                    <Icon name="heroicons:play" class="w-6 h-6 text-white" />
                </ClientOnly>
            </div>
        </div>
    </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDesignSystem, type CardSize } from "~/composables/useDesignSystem";

const props = defineProps<{
    to: string;
    src: string;
    title: string;
    size?: CardSize;
}>();

const { getCardSize, getResponsiveSizes } = useDesignSystem();

const cardConfig = computed(() => {
    const size = props.size || "md";
    const sizeConfig = getCardSize(size);
    const responsiveSizes = getResponsiveSizes(size);

    return {
        width: `${sizeConfig.widthPx}px`,
        sizes:
            Object.entries(responsiveSizes)
                .map(
                    ([breakpoint, width]) =>
                        `(min-width: ${breakpoint}) ${width}`,
                )
                .join(", ") + `, ${sizeConfig.widthPx}px`,
    };
});

const titleClass = computed(() => {
    const titleLength = props.title?.length || 0;

    if (titleLength > 50) return "text-xs";
    if (titleLength > 30) return "text-sm";
    return "text-sm md:text-base";
});
</script>

<style scoped>
.line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.poster {
    /* Ensure consistent aspect ratio */
    container-type: size;
}

/* Better focus styles */
.poster:focus {
    transform: scale(1.02);
}

/* Loading state */
.poster img[data-loading="true"] {
    background: linear-gradient(90deg, #3f3f46 25%, #52525b 50%, #3f3f46 75%);
    background-size: 200% 100%;
    animation: shimmer 2s infinite;
}

@keyframes shimmer {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}
</style>
