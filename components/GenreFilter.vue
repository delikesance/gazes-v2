<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'

type Props = {
  modelValue: string[]
  allGenres: string[]
  label?: string
  maxHeight?: number // px for scroll area
  collapsible?: boolean
  startOpen?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
  (e: 'clear'): void
}>()

const local = ref<string[]>([...props.modelValue])
const query = ref('')
const open = ref(props.collapsible ? !!props.startOpen : true)

watch(
  () => props.modelValue,
  (val) => {
    // keep local synced when parent changes
    local.value = [...val]
  },
  { deep: true }
)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.allGenres
  return props.allGenres.filter((g) => g.toLowerCase().includes(q))
})

const selectedCount = computed(() => local.value.length)

function toggle(g: string) {
  const idx = local.value.indexOf(g)
  if (idx >= 0) local.value.splice(idx, 1)
  else local.value.push(g)
  emit('update:modelValue', [...local.value])
}

function clear() {
  local.value = []
  emit('update:modelValue', [])
  emit('clear')
}

// keyboard a11y: space toggles focused checkbox label
function onKeyToggle(e: KeyboardEvent, g: string) {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    toggle(g)
  }
}

onMounted(() => {
  // If there is any selection, consider auto-open
  if (props.collapsible && selectedCount.value > 0) open.value = true
})
</script>

<template>
  <div class="genre-filter border border-zinc-800 rounded-xl bg-zinc-900/40">
    <!-- Header -->
    <button
      v-if="collapsible"
      class="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-900/60 rounded-t-xl"
      :aria-expanded="open"
      @click="open = !open"
    >
      <div class="flex items-center gap-2 text-sm">
        <Icon name="heroicons:sparkles" class="w-4 h-4 text-violet-400" />
        <span class="font-medium">{{ label || 'Genres' }}</span>
        <span v-if="selectedCount" class="ml-2 text-xs px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-300 border border-violet-700/40">
          {{ selectedCount }}
        </span>
      </div>
      <Icon
        :name="open ? 'heroicons:chevron-up' : 'heroicons:chevron-down'"
        class="w-4 h-4 text-zinc-400"
      />
    </button>

    <div v-show="!collapsible || open" class="p-3 sm:p-4">
      <!-- Search within genres -->
      <div class="relative mb-3">
        <input
          v-model="query"
          type="search"
          class="input input-with-icon w-full sm:w-80"
          placeholder="Rechercher un genre..."
        />
        <Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <button v-if="query" @click="query = ''" class="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-800 rounded">
          <Icon name="heroicons:x-mark" class="w-4 h-4" />
        </button>
      </div>

      <!-- Selected summary + clear -->
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-zinc-400">
          {{ selectedCount }} sélectionné(s)
        </span>
        <button v-if="selectedCount" class="text-xs text-zinc-400 hover:text-zinc-200 underline" @click="clear">Effacer</button>
      </div>

      <!-- Checkbox grid -->
      <div
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"
        :style="{ maxHeight: (maxHeight ?? 240) + 'px', overflow: 'auto' }"
      >
        <label
          v-for="g in filtered"
          :key="g"
          class="flex items-center gap-2 px-2 py-1.5 rounded border text-xs cursor-pointer select-none bg-zinc-900/40 border-zinc-800 hover:border-zinc-700"
          :class="{
            'border-violet-600 bg-violet-600/15 text-violet-200': local.includes(g)
          }"
          tabindex="0"
          @keydown="onKeyToggle($event, g)"
        >
          <input
            type="checkbox"
            class="accent-violet-600 rounded-sm"
            :value="g"
            :checked="local.includes(g)"
            @change="toggle(g)"
            @click.stop
          />
          <span class="truncate">{{ g }}</span>
        </label>
      </div>
    </div>
  </div>
  
</template>

<style scoped>
.genre-filter .input {
  background-color: rgba(24, 24, 27, 0.6);
}
</style>
