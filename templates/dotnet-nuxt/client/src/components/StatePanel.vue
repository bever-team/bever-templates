<script setup lang="ts">
import type { Component } from 'vue'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

// Empty, error, and unavailable states share one calm layout.
defineProps<{ icon: Component, title: string, description?: string }>()
</script>

<template>
  <Empty class="rounded-xl border border-dashed py-14">
    <EmptyHeader>
      <EmptyMedia variant="icon"><component :is="icon" /></EmptyMedia>
      <EmptyTitle>{{ title }}</EmptyTitle>
      <EmptyDescription v-if="description">{{ description }}</EmptyDescription>
    </EmptyHeader>
    <EmptyContent v-if="$slots.default"><slot /></EmptyContent>
  </Empty>
</template>
