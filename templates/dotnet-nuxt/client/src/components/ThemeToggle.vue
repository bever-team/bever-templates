<script setup lang="ts">
import { computed } from 'vue'
import { useColorMode } from '@vueuse/core'
import { MonitorIcon, MoonIcon, SunIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'

// Follows the system until chosen; cycles system, light, dark.
const mode = useColorMode({ emitAuto: true, storageKey: 'theme' })
const next = { auto: 'light', light: 'dark', dark: 'auto' } as const
const label = computed(() => ({ auto: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' })[mode.value as 'auto' | 'light' | 'dark'])
</script>

<template>
  <Button variant="ghost" size="icon" :aria-label="`${label}. Change theme`" :title="label" @click="mode = next[mode as 'auto' | 'light' | 'dark'] ?? 'auto'">
    <SunIcon v-if="mode === 'light'" />
    <MoonIcon v-else-if="mode === 'dark'" />
    <MonitorIcon v-else />
  </Button>
</template>
