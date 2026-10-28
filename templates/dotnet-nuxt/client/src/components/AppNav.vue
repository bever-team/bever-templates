<script setup lang="ts">
import { computed } from 'vue'
import { HouseIcon, LogInIcon, Rows3Icon, UsersIcon } from '@lucide/vue'
import { app, model } from '@/bever/model'
import { actionAt } from '@/bever/presentation'
import { session } from '@/bever/session'
import AppMark from '@/components/AppMark.vue'
import AccountMenu from '@/components/AccountMenu.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { Button } from '@/components/ui/button'

defineProps<{ appName: string }>()

const route = useRoute()
// Only pages the visitor can use; signing in reveals the rest.
const entities = computed(() => app.entities.filter((entity) => actionAt(entity, 'Read', 'Navigation')))
const isActive = (path: string) => route.path === path || route.path.startsWith(`${path}/`)
const linkClass = 'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground'
</script>

<template>
  <div class="flex h-full flex-col">
    <NuxtLink to="/" class="flex h-16 items-center gap-3 px-5 font-semibold">
      <AppMark :name="appName" />
      <span class="truncate">{{ appName }}</span>
    </NuxtLink>

    <nav aria-label="Main" class="flex-1 overflow-y-auto px-3 py-2">
      <ul class="flex flex-col gap-0.5">
        <li>
          <NuxtLink to="/" :class="[linkClass, route.path === '/' && 'bg-sidebar-accent text-sidebar-foreground']" :aria-current="route.path === '/' ? 'page' : undefined">
            <HouseIcon class="size-4" />
            Home
          </NuxtLink>
        </li>
        <li v-for="entity in entities" :key="entity.routeName">
          <NuxtLink :to="`/${entity.routeName}`" :class="[linkClass, isActive(`/${entity.routeName}`) && 'bg-sidebar-accent text-sidebar-foreground']" :aria-current="isActive(`/${entity.routeName}`) ? 'page' : undefined">
            <Rows3Icon class="size-4" />
            {{ entity.presentation.pluralLabel }}
          </NuxtLink>
        </li>
      </ul>
      <ul v-if="session.administrator && model.roles.length > 0" class="mt-4 flex flex-col gap-0.5 border-t pt-4">
        <li>
          <NuxtLink to="/people" :class="[linkClass, isActive('/people') && 'bg-sidebar-accent text-sidebar-foreground']" :aria-current="isActive('/people') ? 'page' : undefined">
            <UsersIcon class="size-4" />
            People
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <div class="flex items-center gap-2 border-t p-3">
      <template v-if="model.identity.enabled && session.known">
        <AccountMenu v-if="session.label" class="min-w-0 flex-1" />
        <Button v-else as-child variant="outline" class="flex-1 justify-start">
          <NuxtLink :to="{ path: '/sign-in', query: route.path === '/sign-in' ? route.query : { redirect: route.fullPath } }">
            <LogInIcon data-icon="inline-start" />
            Sign in
          </NuxtLink>
        </Button>
      </template>
      <span v-else class="flex-1" />
      <ThemeToggle />
    </div>
  </div>
</template>
