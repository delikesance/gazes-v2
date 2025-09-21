<template>
    <section
        class="hero-banner relative w-full h-[60vh] md:h-[80vh] lg:h-[90vh] overflow-hidden flex items-end"
    >
        <!-- Background Image -->
        <img
            v-if="image"
            class="absolute inset-0 w-full h-full object-cover opacity-20"
            :src="image"
            :alt="title"
        />

        <!-- Gradient Overlay -->
        <div
            class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent"
        ></div>

        <!-- Content -->
        <div
            class="relative z-10 text-left flex flex-col gap-5 w-full px-5 md:px-20 pb-12 md:pb-16"
        >
            <div>
                <h1 class="text-3xl md:text-5xl font-black text-white mb-2">
                    {{ title }}
                </h1>
                <p v-if="subtitle" class="text-zinc-200 text-lg">
                    {{ subtitle }}
                </p>
            </div>

            <p
                v-if="synopsis"
                class="text-zinc-300 text-sm md:text-base max-w-3xl leading-relaxed"
            >
                {{ synopsis }}
            </p>

            <div class="flex gap-4 items-center mt-4">
                <NuxtLink
                    v-if="primaryTo"
                    :to="primaryTo"
                    class="bg-violet-700 hover:bg-violet-600 text-white border border-violet-700 hover:border-violet-600 px-8 py-3 rounded-full font-medium transition-all duration-200 flex items-center gap-2"
                >
                    <ClientOnly>
                        <Icon name="heroicons:play" class="w-4 h-4" />
                    </ClientOnly>
                    Regarder
                </NuxtLink>

                <NuxtLink
                    v-if="secondaryTo && secondaryTo !== primaryTo"
                    :to="secondaryTo"
                    class="bg-zinc-800/80 hover:bg-zinc-700/80 text-white border border-zinc-600 hover:border-zinc-500 px-8 py-3 rounded-full font-medium transition-all duration-200"
                >
                    Plus d'infos
                </NuxtLink>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
defineProps<{
    title: string;
    subtitle?: string;
    image?: string;
    primaryTo?: string;
    secondaryTo?: string;
    synopsis?: string;
}>();
</script>

<style scoped>
.hero-banner {
    /* Ensure proper aspect ratio and positioning */
    min-height: 60vh;
}

/* Better gradient for text readability */
.hero-banner::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(
        to top,
        rgba(9, 9, 11, 0.9) 0%,
        rgba(9, 9, 11, 0.6) 50%,
        transparent 100%
    );
    pointer-events: none;
    z-index: 5;
}
</style>
