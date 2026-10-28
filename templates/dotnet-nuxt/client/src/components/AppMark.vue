<script setup lang="ts">
import { computed } from 'vue'

// The app's initial in a rounded square: a neutral stand-in until you add your own logo.
const props = defineProps<{ name: string }>()
const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || 'A')
</script>

<template>
  <span aria-hidden="true" class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
    {{ initial }}
  </span>
</template>
