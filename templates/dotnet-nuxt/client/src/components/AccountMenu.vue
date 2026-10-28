<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { ChevronsUpDownIcon, LogOutIcon } from '@lucide/vue'
import { useBeverClient } from '@/bever/model'
import { applySession, session } from '@/bever/session'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const initial = computed(() => session.label?.charAt(0).toUpperCase() ?? '?')

async function signOut() {
  try {
    await useBeverClient().logout?.()
    applySession(undefined)
    await navigateTo('/')
    toast.success('Signed out')
  } catch {
    toast.error('Could not sign out. Try again.')
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger class="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <span aria-hidden="true" class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{{ initial }}</span>
      <span class="min-w-0 flex-1 truncate">{{ session.label }}</span>
      <ChevronsUpDownIcon class="size-4 shrink-0 text-muted-foreground" />
    </DropdownMenuTrigger>
    <DropdownMenuContent side="top" align="start" class="w-56">
      <DropdownMenuLabel class="font-normal text-muted-foreground">
        <span class="block truncate">Signed in as {{ session.label }}</span>
        <span v-if="session.administrator" class="text-xs">Administrator</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem @select="signOut">
        <LogOutIcon />
        Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
