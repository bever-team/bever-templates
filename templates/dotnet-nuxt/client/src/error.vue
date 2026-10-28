<script setup lang="ts">
import type { NuxtError } from '#app'
import { CompassIcon, TriangleAlertIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'

const props = defineProps<{ error: NuxtError }>()
const notFound = props.error.statusCode === 404
useHead({ title: notFound ? 'Page not found' : 'Something went wrong' })
</script>

<template>
  <div class="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
    <div class="flex max-w-sm flex-col items-center gap-3 text-center">
      <span class="flex size-10 items-center justify-center rounded-lg bg-muted"><component :is="notFound ? CompassIcon : TriangleAlertIcon" class="size-5" /></span>
      <h1 class="text-xl font-semibold">{{ notFound ? 'Page not found' : 'Something went wrong' }}</h1>
      <p class="text-sm text-muted-foreground">{{ notFound ? 'The page you are looking for does not exist.' : 'Reload the page to try again.' }}</p>
      <Button class="mt-2" @click="clearError({ redirect: '/' })">Go home</Button>
    </div>
  </div>
</template>
