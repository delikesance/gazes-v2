<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  error: {
    statusCode: number
    statusMessage?: string
    message?: string
    stack?: string
  }
}

const props = defineProps<Props>()

// Error message mapping
const errorMessages = computed(() => {
  const { statusCode, statusMessage, message } = props.error

  const messages: Record<number, { title: string; description: string; action: string }> = {
    400: {
      title: 'Requête invalide',
      description: 'Votre demande contient des informations incorrectes.',
      action: 'Vérifiez votre saisie et réessayez.'
    },
    401: {
      title: 'Accès non autorisé',
      description: 'Vous devez être connecté pour accéder à cette page.',
      action: 'Connectez-vous et réessayez.'
    },
    403: {
      title: 'Accès interdit',
      description: 'Vous n\'avez pas les permissions nécessaires.',
      action: 'Contactez l\'administrateur si nécessaire.'
    },
    404: {
      title: 'Page introuvable',
      description: 'La page que vous recherchez n\'existe pas ou a été déplacée.',
      action: 'Vérifiez l\'URL ou retournez à l\'accueil.'
    },
    408: {
      title: 'Délai d\'attente dépassé',
      description: 'La requête a pris trop de temps à traiter.',
      action: 'Vérifiez votre connexion et réessayez.'
    },
    429: {
      title: 'Trop de requêtes',
      description: 'Vous avez fait trop de demandes en peu de temps.',
      action: 'Attendez un moment avant de réessayer.'
    },
    500: {
      title: 'Erreur serveur interne',
      description: 'Une erreur s\'est produite sur nos serveurs.',
      action: 'Nous travaillons à résoudre le problème. Réessayez plus tard.'
    },
    502: {
      title: 'Passerelle défaillante',
      description: 'Le serveur a reçu une réponse invalide.',
      action: 'Réessayez dans quelques instants.'
    },
    503: {
      title: 'Service indisponible',
      description: 'Le service est temporairement indisponible.',
      action: 'Nous effectuons peut-être une maintenance. Revenez bientôt.'
    },
    504: {
      title: 'Délai d\'attente de la passerelle',
      description: 'Le serveur n\'a pas répondu à temps.',
      action: 'Vérifiez votre connexion et réessayez.'
    }
  }

  return messages[statusCode] || {
    title: 'Une erreur s\'est produite',
    description: statusMessage || message || 'Une erreur inattendue s\'est produite.',
    action: 'Réessayez ou contactez le support si le problème persiste.'
  }
})

const isDevelopment = process.dev

// Navigation helpers
const goHome = () => {
  navigateTo('/')
}

const goBack = () => {
  if (process.client && window.history.length > 1) {
    history.back()
  } else {
    navigateTo('/')
  }
}

const reload = () => {
  if (process.client) {
    window.location.reload()
  }
}

// Get error icon based on status code
const errorIcon = computed(() => {
  const { statusCode } = props.error

  if (statusCode === 404) return 'heroicons:magnifying-glass'
  if (statusCode >= 400 && statusCode < 500) return 'heroicons:exclamation-triangle'
  if (statusCode >= 500) return 'heroicons:server'
  return 'heroicons:exclamation-circle'
})

const iconColor = computed(() => {
  const { statusCode } = props.error

  if (statusCode === 404) return 'text-blue-400'
  if (statusCode >= 400 && statusCode < 500) return 'text-amber-400'
  if (statusCode >= 500) return 'text-red-400'
  return 'text-zinc-400'
})
</script>

<template>
  <div class="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
    <div class="max-w-2xl w-full text-center">
      <!-- Error Icon -->
      <div class="mb-8">
        <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-zinc-900/50 flex items-center justify-center">
          <ClientOnly>
            <Icon :name="errorIcon" :class="['w-12 h-12', iconColor]" />
          </ClientOnly>
        </div>

        <!-- Status Code -->
        <div class="text-6xl font-black text-white mb-2">
          {{ error.statusCode }}
        </div>
      </div>

      <!-- Error Content -->
      <div class="mb-8">
        <h1 class="text-2xl md:text-3xl font-bold text-white mb-4">
          {{ errorMessages.title }}
        </h1>

        <p class="text-zinc-300 text-lg mb-4">
          {{ errorMessages.description }}
        </p>

        <p class="text-zinc-400">
          {{ errorMessages.action }}
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap justify-center gap-4 mb-8">
        <button
          @click="goHome"
          class="btn primary"
        >
          <ClientOnly>
            <Icon name="heroicons:home" class="w-4 h-4 mr-2" />
          </ClientOnly>
          Retour à l'accueil
        </button>

        <button
          @click="goBack"
          class="btn secondary"
        >
          <ClientOnly>
            <Icon name="heroicons:arrow-left" class="w-4 h-4 mr-2" />
          </ClientOnly>
          Page précédente
        </button>

        <button
          @click="reload"
          class="btn ghost"
        >
          <ClientOnly>
            <Icon name="heroicons:arrow-path" class="w-4 h-4 mr-2" />
          </ClientOnly>
          Recharger
        </button>
      </div>

      <!-- Quick Links -->
      <div class="border-t border-zinc-800 pt-8">
        <h2 class="text-lg font-semibold text-white mb-4">
          Liens utiles
        </h2>

        <div class="flex flex-wrap justify-center gap-6">
          <NuxtLink to="/catalogue" class="text-zinc-400 hover:text-white transition-colors">
            Catalogue
          </NuxtLink>
          <NuxtLink to="/series" class="text-zinc-400 hover:text-white transition-colors">
            Séries
          </NuxtLink>
          <NuxtLink to="/movies" class="text-zinc-400 hover:text-white transition-colors">
            Films
          </NuxtLink>
          <NuxtLink to="/others" class="text-zinc-400 hover:text-white transition-colors">
            Autres
          </NuxtLink>
        </div>
      </div>

      <!-- Development Error Details -->
      <details v-if="isDevelopment && error.stack" class="mt-8 text-left">
        <summary class="cursor-pointer text-zinc-400 hover:text-white mb-4">
          Détails techniques (développement uniquement)
        </summary>

        <div class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <h3 class="text-sm font-semibold text-white mb-2">Message d'erreur :</h3>
          <p class="text-xs text-zinc-300 mb-4 font-mono">
            {{ error.message }}
          </p>

          <h3 class="text-sm font-semibold text-white mb-2">Stack trace :</h3>
          <pre class="text-xs text-zinc-400 overflow-x-auto whitespace-pre-wrap font-mono">{{ error.stack }}</pre>
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped>
/* Ensure buttons have consistent styling */
.btn {
  @apply inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950;
}

.btn.primary {
  @apply bg-violet-700 text-white border-violet-700 hover:bg-violet-600 focus:ring-violet-500/50;
}

.btn.secondary {
  @apply bg-zinc-900/60 text-zinc-100 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/60 focus:ring-zinc-500/50;
}

.btn.ghost {
  @apply bg-transparent text-zinc-200 border-transparent hover:border-zinc-700 hover:bg-zinc-800/40 focus:ring-zinc-500/50;
}

/* Animation for error icon */
.w-24 {
  animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Details/Summary styling */
details summary {
  list-style: none;
}

details summary::-webkit-details-marker {
  display: none;
}

details summary::before {
  content: '▶';
  display: inline-block;
  width: 1em;
  margin-right: 0.5em;
  transition: transform 0.2s ease;
}

details[open] summary::before {
  transform: rotate(90deg);
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .text-6xl {
    font-size: 3rem;
  }

  .btn {
    @apply text-xs px-3 py-2;
  }
}
</style>
