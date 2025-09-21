<template>
    <component
        :is="tag"
        :to="to"
        :href="href"
        :disabled="disabled || loading"
        :type="type"
        :class="buttonClasses"
        :aria-label="ariaLabel"
        :aria-disabled="disabled || loading"
        v-bind="$attrs"
        @click="handleClick"
    >
        <!-- Loading spinner -->
        <div
            v-if="loading"
            class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
        />

        <!-- Leading icon -->
        <ClientOnly v-if="iconLeft && !loading">
            <Icon :name="iconLeft" :class="iconClass" />
        </ClientOnly>

        <!-- Content -->
        <span
            v-if="$slots.default"
            :class="{ 'ml-2': iconLeft && !loading, 'mr-2': iconRight }"
        >
            <slot />
        </span>

        <!-- Trailing icon -->
        <ClientOnly v-if="iconRight">
            <Icon :name="iconRight" :class="iconClass" />
        </ClientOnly>
    </component>
</template>

<script setup lang="ts">
import { computed } from "vue";

export type ButtonVariant =
    | "primary"
    | "secondary"
    | "ghost"
    | "danger"
    | "success";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps {
    variant?: ButtonVariant;
    size?: ButtonSize;
    disabled?: boolean;
    loading?: boolean;
    iconLeft?: string;
    iconRight?: string;
    to?: string;
    href?: string;
    type?: "button" | "submit" | "reset";
    ariaLabel?: string;
    fullWidth?: boolean;
    rounded?: boolean;
}

const props = withDefaults(defineProps<ButtonProps>(), {
    variant: "primary",
    size: "md",
    disabled: false,
    loading: false,
    type: "button",
    fullWidth: false,
    rounded: false,
});

const emit = defineEmits<{
    click: [event: MouseEvent];
}>();

// Determine the component tag
const tag = computed(() => {
    if (props.to) return "NuxtLink";
    if (props.href) return "a";
    return "button";
});

// Base classes
const baseClasses =
    "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed";

// Variant classes
const variantClasses = computed(() => {
    const variants: Record<ButtonVariant, string> = {
        primary:
            "bg-violet-700 text-white border border-violet-700 hover:bg-violet-600 focus:ring-violet-500/50 active:bg-violet-800",
        secondary:
            "bg-zinc-900/60 text-zinc-100 border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/60 focus:ring-zinc-500/50",
        ghost: "bg-transparent text-zinc-200 border border-transparent hover:border-zinc-700 hover:bg-zinc-800/40 focus:ring-zinc-500/50",
        danger: "bg-red-700 text-white border border-red-700 hover:bg-red-600 focus:ring-red-500/50 active:bg-red-800",
        success:
            "bg-emerald-700 text-white border border-emerald-700 hover:bg-emerald-600 focus:ring-emerald-500/50 active:bg-emerald-800",
    };
    return variants[props.variant];
});

// Size classes
const sizeClasses = computed(() => {
    const sizes: Record<ButtonSize, string> = {
        xs: "px-2.5 py-1.5 text-xs",
        sm: "px-3 py-2 text-sm",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base",
    };
    return sizes[props.size];
});

// Border radius classes
const radiusClasses = computed(() => {
    if (props.rounded) return "rounded-full";
    return "rounded-lg";
});

// Icon size based on button size
const iconClass = computed(() => {
    const iconSizes: Record<ButtonSize, string> = {
        xs: "w-3 h-3",
        sm: "w-4 h-4",
        md: "w-4 h-4",
        lg: "w-5 h-5",
    };
    return iconSizes[props.size];
});

// Combined classes
const buttonClasses = computed(() => {
    return [
        baseClasses,
        variantClasses.value,
        sizeClasses.value,
        radiusClasses.value,
        {
            "w-full": props.fullWidth,
            "pointer-events-none": props.disabled || props.loading,
        },
    ];
});

// Click handler
const handleClick = (event: MouseEvent) => {
    if (props.disabled || props.loading) {
        event.preventDefault();
        return;
    }
    emit("click", event);
};
</script>

<style scoped>
/* Custom focus ring for better visibility */
.focus\:ring-2:focus {
    box-shadow: 0 0 0 2px var(--tw-ring-color);
}

/* Ensure proper contrast for disabled state */
.disabled\:opacity-50:disabled {
    opacity: 0.5;
}

/* Smooth hover transitions */
@media (hover: hover) {
    .transition-all {
        transition-property: all;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        transition-duration: 200ms;
    }
}

/* Loading animation */
@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.animate-spin {
    animation: spin 1s linear infinite;
}

/* Pressed state for touch devices */
@media (hover: none) {
    .active\:bg-violet-800:active {
        background-color: rgb(91 33 182);
    }

    .active\:bg-red-800:active {
        background-color: rgb(153 27 27);
    }

    .active\:bg-emerald-800:active {
        background-color: rgb(6 95 70);
    }
}
</style>
