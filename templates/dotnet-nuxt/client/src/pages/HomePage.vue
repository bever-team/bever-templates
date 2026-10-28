<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRightIcon, LockIcon, PlusIcon } from '@lucide/vue'
import { app, model } from '@/bever/model'
import { actionAt, createLabel } from '@/bever/presentation'
import { session } from '@/bever/session'
import PageHeader from '@/components/PageHeader.vue'
import SignInPanel from '@/components/SignInPanel.vue'
import StatePanel from '@/components/StatePanel.vue'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const appName = useRuntimeConfig().public.appName as string
const entities = computed(() => app.entities
  .filter((entity) => actionAt(entity, 'Read', 'Navigation'))
  .map((entity) => ({ entity, create: actionAt(entity, 'Create', 'ListingToolbar') })))
const needsSignIn = computed(() => session.known && entities.value.length === 0 && model.identity.enabled && !session.label)
const greeting = computed(() => session.label ? `Signed in as ${session.label}.` : 'Choose what to work on.')
</script>

<template>
  <div v-if="!session.known" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <Skeleton v-for="index in 3" :key="index" class="h-36 rounded-xl" />
  </div>
  <div v-else-if="needsSignIn" class="flex min-h-[60svh] items-center justify-center">
    <SignInPanel />
  </div>
  <div v-else>
    <PageHeader :title="appName" :description="greeting" />
    <StatePanel v-if="entities.length === 0" :icon="LockIcon" title="Nothing to show yet" description="This app has no pages you can open." />
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card v-for="{ entity, create } in entities" :key="entity.routeName" class="group relative transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle class="text-lg">
            <NuxtLink :to="`/${entity.routeName}`" class="after:absolute after:inset-0 focus-visible:outline-none">{{ entity.presentation.pluralLabel }}</NuxtLink>
          </CardTitle>
          <CardDescription>Browse and manage {{ entity.presentation.pluralLabel.toLowerCase() }}.</CardDescription>
        </CardHeader>
        <CardFooter class="mt-auto justify-between">
          <span class="flex items-center gap-1 text-sm font-medium text-muted-foreground group-hover:text-foreground">
            Open <ArrowRightIcon class="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
          <Button v-if="create" variant="outline" size="sm" class="relative z-10" as-child>
            <NuxtLink :to="entity.presentation.creating.mode === 'Page' ? `/${entity.routeName}/new` : { path: `/${entity.routeName}`, query: { create: '1' } }">
              <PlusIcon data-icon="inline-start" />{{ createLabel(entity, create) }}
            </NuxtLink>
          </Button>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>
