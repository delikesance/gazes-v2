<script setup lang="ts">
import { ref, onErrorCaptured } from "vue";

// Global error handling
const globalError = ref<string | null>(null);
const showGlobalError = ref<boolean>(false);

// Capture Vue errors
onErrorCaptured((error, instance, info) => {
    console.error("Vue error captured:", error, info);
    globalError.value = error.message || "An unexpected error occurred";
    showGlobalError.value = true;
    return false; // Prevent error from propagating
});

// Handle unhandled promise rejections
if (typeof window !== "undefined") {
    window.addEventListener("unhandledrejection", (event) => {
        console.error("Unhandled promise rejection:", event.reason);
        globalError.value = "A network or loading error occurred";
        showGlobalError.value = true;
    });
}

const dismissError = () => {
    showGlobalError.value = false;
    globalError.value = null;
};

const reloadPage = () => {
    if (typeof window !== "undefined") {
        window.location.reload();
    }
};
</script>

<template>
    <div>
        <!-- Global error boundary -->
        <Teleport to="body">
            <div
                v-if="showGlobalError"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="error-title"
            >
                <div
                    class="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full"
                >
                    <div class="flex items-start gap-3">
                        <div class="flex-shrink-0">
                            <ClientOnly>
                                <Icon
                                    name="heroicons:exclamation-triangle"
                                    class="w-6 h-6 text-amber-500"
                                />
                            </ClientOnly>
                        </div>
                        <div class="flex-1">
                            <h3
                                id="error-title"
                                class="text-lg font-semibold text-white mb-2"
                            >
                                Une erreur s'est produite
                            </h3>
                            <p class="text-zinc-300 text-sm mb-4">
                                {{ globalError }}
                            </p>
                            <div class="flex gap-3">
                                <button
                                    @click="reloadPage"
                                    class="btn primary text-sm"
                                >
                                    Recharger la page
                                </button>
                                <button
                                    @click="dismissError"
                                    class="btn secondary text-sm"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Main app content -->
        <NuxtLayout>
            <NuxtPage />
        </NuxtLayout>
    </div>
</template>

<style>
/* Global styles */
html {
    scroll-behavior: smooth;
}

/* Prevent flash of unstyled content */
html.dark {
    color-scheme: dark;
}

/* Focus styles for accessibility */
*:focus-visible {
    outline: 2px solid rgb(139 92 246);
    outline-offset: 2px;
}

/* Reduce motion for users who prefer it */
@media (prefers-reduced-motion: reduce) {
    html {
        scroll-behavior: auto;
    }

    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
    .btn {
        border-width: 2px;
    }

    .card {
        border-width: 2px;
    }
}

/* Print styles */
@media print {
    .no-print {
        display: none !important;
    }
}
</style>
