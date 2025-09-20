<template>
    <button class="bg-purple-700/30 px-5 py-2  border border-purple-700/60 rounded-full text-purple-100" @click="$emit('click')">
        <slot />
    </button>
</template>