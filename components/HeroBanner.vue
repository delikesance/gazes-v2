<template>
  <section
    class="hero-banner px-20 w-full h-[60vh] md:h-[80vh] lg:h-[90vh] overflow-hidden flex items-center justify-center text-center -z-10">
    <img v-if="image" class="hero-media w-full opacity-20 absolute -z-20" :src="image" :alt="title" />
    <div class="h-full w-full absolute bg-gradient-to-t from-zinc-950 -z-10"></div>

    <div class="text-left flex flex-col gap-5 w-full">
      <div>
        <h1 class="text-3xl font-black">{{ title }}</h1>
        <p v-if="subtitle" class="text-zinc-400">{{ subtitle }}</p>
      </div>

      <p v-if="synopsis" class="text-sm max-w-3xl">{{ synopsis }}</p>

      <div class="flex gap-4 items-center mt-4">
        <NuxtLink v-if="primaryTo" :to="primaryTo" class="bg-purple-800/30 border border-purple-800 px-10 py-2 rounded-full">Regarder</NuxtLink>
      </div>
    </div>
  </section>

</template>

<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; image?: string; primaryTo?: string; secondaryTo?: string; synopsis?: string }>()
</script>
