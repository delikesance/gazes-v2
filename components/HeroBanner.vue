<template>
    <section
        class="hero-banner relative w-full h-[60vh] md:h-[80vh] lg:h-[90vh] overflow-hidden flex items-center"
        :class="{ 'bg-gradient-to-br from-violet-900/40 via-zinc-900 to-zinc-950': !image }"
    >
        <!-- Background Image -->
        <img
            v-if="image"
            class="absolute inset-0 w-full h-full object-cover opacity-15"
            :src="image"
            :alt="title"
        />

        <!-- Gradient Overlay -->
        <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent"></div>

        <!-- Content Container -->
        <div class="relative z-10 w-full max-w-7xl mx-auto px-5 md:px-20">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <!-- Main Content -->
                <div class="text-left space-y-6">
                    <!-- Section Title -->
                    <div>
                        <h1 class="text-2xl md:text-4xl lg:text-5xl font-black text-white leading-tight mb-2">
                            {{ title }}
                        </h1>
                        <div class="w-16 h-0.5 bg-violet-500"></div>
                    </div>

                    <!-- Featured Anime Title -->
                    <div v-if="featuredTitle" class="space-y-2">
                        <p class="text-violet-300 text-sm font-medium uppercase tracking-wide">À la une</p>
                        <h2 class="text-2xl md:text-3xl font-bold text-white">
                            {{ featuredTitle }}
                        </h2>
                    </div>

                    <!-- Synopsis -->
                    <p
                        v-if="synopsis"
                        class="text-zinc-300 text-sm max-w-xl leading-relaxed line-clamp-10"
                    >
                        {{ synopsis }}
                    </p>

                    <!-- Action Buttons -->
                    <div class="flex flex-col sm:flex-row gap-3 pt-2">
                        <NuxtLink
                            v-if="primaryTo"
                            :to="primaryTo"
                            class="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-full font-medium transition-all duration-200"
                        >
                            <ClientOnly>
                                <Icon name="heroicons:play" class="w-4 h-4" />
                            </ClientOnly>
                            Explorer le catalogue
                        </NuxtLink>

                        <NuxtLink
                            v-if="featuredId"
                            :to="`/anime/${featuredId}`"
                            class="inline-flex items-center gap-2 bg-zinc-700/80 hover:bg-zinc-600/80 text-white px-6 py-3 rounded-full font-medium transition-all duration-200 border border-zinc-600"
                        >
                            <ClientOnly>
                                <Icon name="heroicons:eye" class="w-4 h-4" />
                            </ClientOnly>
                            Voir cet anime
                        </NuxtLink>
                    </div>
                </div>

                <!-- Featured Image -->
                <div class="hidden md:block">
                    <div class="max-w-xs md:max-w-sm lg:max-w-[280px] mx-auto">
                        <div class="aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border border-zinc-700/50 transition-all duration-300 hover:shadow-violet-500/20 hover:border-violet-500/30 relative group cursor-pointer">
                            <NuxtLink
                                v-if="featuredId"
                                :to="`/anime/${featuredId}`"
                                class="absolute inset-0 z-10"
                            ></NuxtLink>

                            <img
                                v-if="image"
                                :src="image"
                                :alt="title"
                                class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div v-else class="w-full h-full bg-gradient-to-br from-violet-900/40 to-zinc-900 flex items-center justify-center">
                                <Icon name="heroicons:film" class="w-12 h-12 text-zinc-400" />
                            </div>

                            <!-- Hover Overlay -->
                            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center rounded-2xl">
                                <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <div class="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30">
                                        <Icon name="heroicons:play" class="w-5 h-5 text-white ml-0.5" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
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
    featuredId?: string;
    featuredTitle?: string;
}>();
</script>

<style scoped>
.hero-banner {
    /* Ensure proper aspect ratio and positioning */
    min-height: 60vh;
}

/* Custom line clamp for synopsis */
.line-clamp-10 {
    display: -webkit-box;
    -webkit-line-clamp: 10;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>
