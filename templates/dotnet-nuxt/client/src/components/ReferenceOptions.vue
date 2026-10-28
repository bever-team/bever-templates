<script setup lang="ts">
import { ref } from 'vue'
import { CheckIcon, LoaderCircleIcon, SearchIcon } from '@lucide/vue'
import type { ReferenceSummary } from '@bever/sdk'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// The searchable option list inside a reference picker's popover or dialog.
defineProps<{
  label: string
  items: ReferenceSummary[]
  selectedId: string | null
  searchable: boolean
  loading: boolean
  loaded: boolean
  error: string | null
  hasMore: boolean
  bordered?: boolean
}>()
const search = defineModel<string>('search', { required: true })
const emit = defineEmits<{ (e: 'choose', item: ReferenceSummary): void, (e: 'load-more'): void }>()
const root = ref<HTMLElement | null>(null)

// Arrow keys move between the search box and the options.
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const options = [...(root.value?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]
  if (options.length === 0) return
  event.preventDefault()
  const index = options.indexOf(document.activeElement as HTMLElement)
  const next = event.key === 'ArrowDown' ? Math.min(index + 1, options.length - 1) : index - 1
  if (next < 0) root.value?.querySelector<HTMLElement>('input')?.focus()
  else options[next]?.focus()
}
</script>

<template>
  <div ref="root" class="flex flex-col" @keydown="onKeydown">
    <div v-if="searchable" :class="['flex items-center gap-2 px-3', bordered ? 'rounded-md border' : 'border-b']">
      <SearchIcon class="size-4 shrink-0 text-muted-foreground" />
      <Input v-model="search" type="search" :aria-label="`Search ${label.toLowerCase()}`" placeholder="Search…" class="h-9 border-0 px-0 shadow-none focus-visible:ring-0 dark:bg-transparent" autofocus />
    </div>
    <div role="listbox" :aria-label="label" :class="['max-h-72 overflow-y-auto p-1', bordered && searchable && 'mt-2']">
      <button
        v-for="item in items" :key="item.id" type="button" role="option" :aria-selected="item.id === selectedId"
        class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
        @click="emit('choose', item)"
      >
        <CheckIcon :class="['size-4 shrink-0', item.id === selectedId ? 'opacity-100' : 'opacity-0']" />
        <span class="truncate">{{ item.label || 'Untitled' }}</span>
      </button>
      <p v-if="loading" role="status" class="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"><LoaderCircleIcon class="size-4 animate-spin" />Loading…</p>
      <p v-else-if="error" role="alert" class="px-3 py-2 text-sm text-destructive">{{ error }}</p>
      <p v-else-if="loaded && items.length === 0" class="px-3 py-6 text-center text-sm text-muted-foreground">
        {{ search ? 'No matches.' : `No ${label.toLowerCase()} records are available to you.` }}
      </p>
      <Button v-if="hasMore && !loading" type="button" variant="ghost" size="sm" class="mt-1 w-full" data-test="load-more" @click="emit('load-more')">Load more</Button>
    </div>
  </div>
</template>
