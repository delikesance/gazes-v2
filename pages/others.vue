<script setup lang="ts">
import { ref, computed } from 'vue'
import CarouselRow from '~/components/CarouselRow.vue'

// Set page metadata
useSeoMeta({
  title: 'Autres - Gazes',
  description: 'Découvrez nos autres contenus animés'
})

type Item = { id: string; title: string; image: string }

const loading = ref(false)
const others = ref<Item[]>([])

// Other content categories
const otherCategories = [
  'OVA',
  'Spéciaux',
  'Courts-métrages',
  'Documentaires',
  'Concerts',
  'Publicités'
]

// Fetch featured content for hero section
const { data: featuredData } = await useFetch<{ items: Item[] }>(`/api/catalogue`, {
  params: {
    genre: 'Aventure',
    type: 'special',
    limit: 1,
    random: '1'
  },
  key: 'others:featured'
})

const featuredContent = computed(() => featuredData.value?.items?.[0] || null)
</script>

<template>
  <div>
    <!-- Hero Section -->
    <section v-if="featuredContent" class="hero-section relative h-[50vh] md:h-[60vh] flex items-center justify-center overflow-hidden">
      <img
        :src="featuredContent.image"
        :alt="featuredContent.title"
        class="absolute inset-0 w-full h-full object-cover opacity-20"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent"></div>

      <div class="relative z-10 text-center px-5 md:px-20">
        <h1 class="text-4xl md:text-6xl font-black mb-4">Autres</h1>
        <p class="text-zinc-300 text-lg md:text-xl max-w-2xl mx-auto">
          Explorez des contenus uniques et exclusifs
        </p>
        <div class="mt-6">
          <NuxtLink
            to="/catalogue?type=special"
            class="btn primary"
          >
            Parcourir tous les contenus
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Content Categories -->
    <div class="flex flex-col gap-10 mt-10">
      <div v-for="category in otherCategories" :key="category">
        <Suspense>
          <CarouselRow
            :title="category"
            :genre="category"
            card-size="sm"
          />
          <template #fallback>
            <section class="section">
              <div class="flex justify-between items-center mb-4 px-20">
                <h3 class="row-title">{{ category }}</h3>
                <div class="flex items-center gap-5">
                  <button type="button">
                    <ClientOnly>
                      <Icon name="grommet-icons:form-previous" />
                    </ClientOnly>
                  </button>
                  <button type="button">
                    <ClientOnly>
                      <Icon name="grommet-icons:form-next" />
                    </ClientOnly>
                  </button>
                </div>
              </div>
              <div class="relative">
                <div aria-hidden class="pointer-events-none absolute inset-y-0 left-0 w-20 z-10 bg-gradient-to-r from-zinc-950 to-transparent" />
                <div aria-hidden class="pointer-events-none absolute inset-y-0 right-0 w-20 z-10 bg-gradient-to-l from-zinc-950 to-transparent" />
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
      </div>
    </div>

    <!-- Special Collections -->
    <section class="section px-5 md:px-20 mt-16">
      <div class="text-center mb-8">
        <h2>Collections spéciales</h2>
        <p class="muted">Découvrez nos sélections thématiques</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="card p-6 text-center">
          <div class="mb-4">
            <div class="w-16 h-16 mx-auto rounded-full bg-violet-700/20 flex items-center justify-center">
              <ClientOnly>
                <Icon name="heroicons:film" class="w-8 h-8 text-violet-400" />
              </ClientOnly>
            </div>
          </div>
          <h3 class="mb-3">OVA exclusifs</h3>
          <p class="muted mb-4">Épisodes spéciaux et contenus bonus</p>
          <NuxtLink
            to="/catalogue?type=ova"
            class="btn secondary"
          >
            Explorer
          </NuxtLink>
        </div>

        <div class="card p-6 text-center">
          <div class="mb-4">
            <div class="w-16 h-16 mx-auto rounded-full bg-emerald-700/20 flex items-center justify-center">
              <ClientOnly>
                <Icon name="heroicons:musical-note" class="w-8 h-8 text-emerald-400" />
              </ClientOnly>
            </div>
          </div>
          <h3 class="mb-3">Concerts & Événements</h3>
          <p class="muted mb-4">Performances et événements spéciaux</p>
          <NuxtLink
            to="/catalogue?type=concert"
            class="btn secondary"
          >
            Découvrir
          </NuxtLink>
        </div>

        <div class="card p-6 text-center">
          <div class="mb-4">
            <div class="w-16 h-16 mx-auto rounded-full bg-amber-700/20 flex items-center justify-center">
              <ClientOnly>
                <Icon name="heroicons:document-film" class="w-8 h-8 text-amber-400" />
              </ClientOnly>
            </div>
          </div>
          <h3 class="mb-3">Courts-métrages</h3>
          <p class="muted mb-4">Créations artistiques et expérimentales</p>
          <NuxtLink
            to="/catalogue?type=short"
            class="btn secondary"
          >
            Visionner
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Recent Additions -->
    <section class="section px-5 md:px-20 mt-16">
      <div class="text-center mb-8">
        <h2>Derniers ajouts</h2>
        <p class="muted">Contenus récemment ajoutés à notre collection</p>
      </div>

      <Suspense>
        <CarouselRow
          title="Nouveautés"
          genre="Spéciaux,OVA"
          card-size="md"
        />
        <template #fallback>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div
              v-for="i in 12"
              :key="i"
              class="rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse aspect-[9/12]"
            />
          </div>
        </template>
      </Suspense>
    </section>

    <!-- Info Section -->
    <section class="section px-5 md:px-20 mt-16">
      <div class="card p-8">
        <h2 class="text-center mb-6">À propos de nos contenus spéciaux</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 class="mb-3">Qu'est-ce qu'un OVA ?</h3>
            <p class="muted text-sm">
              Les OVA (Original Video Animation) sont des animations créées spécifiquement pour la distribution vidéo,
              souvent avec des budgets plus élevés et une liberté créative accrue.
            </p>
          </div>

          <div>
            <h3 class="mb-3">Contenus exclusifs</h3>
            <p class="muted text-sm">
              Découvrez des épisodes spéciaux, des making-of, des concerts, et d'autres contenus rares
              qu'on ne trouve nulle part ailleurs.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Browse All Section -->
    <section class="section px-5 md:px-20 mt-16 text-center">
      <div class="bg-zinc-900/40 backdrop-blur border border-zinc-800 rounded-xl p-8">
        <h2 class="mb-4">Explorez notre collection complète</h2>
        <p class="muted mb-6 max-w-2xl mx-auto">
          Des trésors cachés aux créations uniques, plongez dans un univers de contenus exclusifs et rares.
        </p>
        <NuxtLink
          to="/catalogue?type=special"
          class="btn primary"
        >
          Voir tous les contenus
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero-section {
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
}
</style>
