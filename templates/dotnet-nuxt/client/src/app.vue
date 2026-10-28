<script setup lang="ts">
import 'vue-sonner/style.css'
import { onMounted, ref, watch } from 'vue'
import { MenuIcon } from '@lucide/vue'
import { model, useBeverClient } from '@/bever/model'
import { applySession, session } from '@/bever/session'
import AppNav from '@/components/AppNav.vue'
import AppMark from '@/components/AppMark.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Toaster } from '@/components/ui/sonner'

const appName = useRuntimeConfig().public.appName as string
const route = useRoute()
const navOpen = ref(false)
watch(() => route.fullPath, () => { navOpen.value = false })

async function refreshSession() {
  if (!model.identity.enabled) return
  try {
    applySession(await useBeverClient().getSession?.())
  } catch {
    applySession(undefined)
  } finally {
    session.known = true
  }
}

onMounted(() => { void refreshSession() })
</script>

<template>
  <div class="flex min-h-svh bg-background text-foreground">
    <aside class="sticky top-0 hidden h-svh w-64 shrink-0 border-r bg-sidebar md:block">
      <AppNav :app-name="appName" />
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:hidden">
        <Button variant="ghost" size="icon" aria-label="Open navigation" @click="navOpen = true">
          <MenuIcon />
        </Button>
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold">
          <AppMark :name="appName" class="size-6 text-xs" />
          <span class="truncate">{{ appName }}</span>
        </NuxtLink>
      </header>

      <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <NuxtPage />
      </main>
    </div>

    <Sheet v-model:open="navOpen">
      <SheetContent side="left" class="w-72 bg-sidebar p-0">
        <SheetTitle class="sr-only">Navigation</SheetTitle>
        <SheetDescription class="sr-only">Pages of {{ appName }}</SheetDescription>
        <AppNav :app-name="appName" />
      </SheetContent>
    </Sheet>

    <ConfirmDialog />
    <Toaster position="bottom-right" />
  </div>
</template>
