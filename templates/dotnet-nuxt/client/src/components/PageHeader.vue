<script setup lang="ts">
import { ChevronRightIcon } from '@lucide/vue'

// A page title with an optional description, breadcrumb links, and actions on the right.
defineProps<{ title: string, description?: string, crumbs?: { label: string, to: string }[] }>()
</script>

<template>
  <div class="mb-6 flex flex-col gap-4 sm:mb-8">
    <nav v-if="crumbs?.length" aria-label="Breadcrumb">
      <ol class="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <li v-for="crumb in crumbs" :key="crumb.to" class="flex items-center gap-1.5">
          <NuxtLink :to="crumb.to" class="hover:text-foreground">{{ crumb.label }}</NuxtLink>
          <ChevronRightIcon class="size-3.5" aria-hidden="true" />
        </li>
        <li aria-current="page" class="max-w-[50vw] truncate text-foreground">{{ title }}</li>
      </ol>
    </nav>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h1 class="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{{ title }}</h1>
        <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
        <slot name="meta" />
      </div>
      <div v-if="$slots.default" class="flex shrink-0 flex-wrap items-center gap-2">
        <slot />
      </div>
    </div>
  </div>
</template>
